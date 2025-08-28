import { BaseAction } from "../../config/BaseActions";
import { RequestPage } from "./request.page";
import { GoToRequestsAction } from "../Home/goToRequests.action";
import { createRequestMock, RequestMock } from "../../fixtures/mocks/request.mock";
import { expect } from "@playwright/test";
import { uploadAttachments } from "./uploadAttachments";

export class NewRequestAction extends BaseAction {

  async createRequestWithFiles(overrides?: Partial<RequestMock>): Promise<RequestMock> {
    const mock = createRequestMock({ ...overrides });

    // Navigate to Requests
    const goToRequests = new GoToRequestsAction(this.page);
    await goToRequests.navigateToRequests();

    const rp = new RequestPage(this.page);

    // Open new request dialog
    await this.verifyIfLocatorIsVisible(rp.newRequestButton);
    await rp.newRequestButton.click();

    // Esperar a que desaparezcan skeletons básicos (best effort)
    await this.page.waitForSelector('.MuiSkeleton-root', { state: 'detached', timeout: 12000 }).catch(()=>{});

    const pickFirstOption = async (label: string, childLabel?: string, timeout=8000): Promise<string|null> => {
      const deadline = Date.now() + timeout;
      const labelEl = this.page.locator(`label:has-text("${label}")`).first();
      await labelEl.waitFor({ state: 'visible', timeout }).catch(()=>{});
      const container = labelEl.locator('..').first();
      const cb = container.locator('[role="combobox"]').first();
      if (await cb.count() === 0) return null;
      let chosen: string|null = null;
      for (let attempt=0; attempt<4 && !chosen && Date.now()<deadline; attempt++) {
        await cb.click({ force: true }).catch(()=>{});
        await this.page.waitForTimeout(80);
        const opts = this.page.locator('[role="option"]').filter({ hasText: /./ });
        const count = await opts.count();
        const texts: string[] = [];
        for (let i=0;i<Math.min(count,20);i++) {
          const t = (await opts.nth(i).innerText()).trim();
            if (t && !/seleccion|elegir|--/i.test(t)) texts.push(t);
        }
        if (texts.length) {
          chosen = texts[0];
          const opt = opts.filter({ hasText: new RegExp(`^${texts[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`) }).first();
          await opt.click({ force: true }).catch(()=>{});
        } else {
          await this.page.keyboard.press('Escape').catch(()=>{});
          await this.page.waitForTimeout(100);
        }
      }
      if (childLabel && chosen) {
        // pequeño wait para que cargue el hijo
        await this.page.waitForTimeout(250);
      }
      return chosen;
    };

    const unidadSelected = await pickFirstOption('Unidad','Área');
    const areaSelected = await pickFirstOption('Área','Sociedad');
    const sociedadSelected = await pickFirstOption('Sociedad','Tipo de servicio');
    const tipoSelected = await pickFirstOption('Tipo de servicio');

    console.log(`[NewRequestAction] selections -> unidad:${unidadSelected} area:${areaSelected} sociedad:${sociedadSelected} tipo:${tipoSelected}`);

    // Description
    try {
      const desc = this.page.getByLabel("Descripción");
      if (await desc.count() > 0) await desc.fill(mock.descripcion);
      else {
        const tb = this.page.getByRole("textbox", { name: /Descripción|Descripcion|Descripción/ });
        if (await tb.count() > 0) await tb.fill(mock.descripcion);
      }
    } catch {}

    // Datepicker: select a date at least 8 days in the future using the page's MUI datepicker
    try {
      const target = new Date();
      target.setDate(target.getDate() + 8);
      const isoTarget = target.toISOString().slice(0, 10); // yyyy-mm-dd
      const day = String(target.getDate());
      const targetMonth = target.getMonth(); // 0-based
      const targetYear = target.getFullYear();

      const monthNamesEs = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

      let dateSet = false;

      const dp = rp.datePicker;
      if (await dp.count() > 0) {
        await dp.first().click().catch(() => {});
        await this.page.waitForTimeout(300);


        // Find the calendar header text (e.g. "agosto 2025") inside the open popper
        let popper = this.page.locator('.MuiPickerPopper-paper').first();
        // Wait for popper to be visible briefly. If not found, try any popper/dialog root
        if (await popper.count() === 0) {
          const altPopper = this.page.locator('div[role="dialog"].MuiPopper-root').first();
          if (await altPopper.count() > 0) popper = altPopper;
        }

        // Read current month/year and compute how many 'next' clicks needed
        let currentMonth = null as number | null;
        let currentYear = null as number | null;
        try {
          const header = await this.page.locator('.MuiPickersCalendarHeader-label').first().innerText().catch(() => '');
          const headerNorm = header.trim().toLowerCase();
          for (let m = 0; m < monthNamesEs.length; m++) {
            if (headerNorm.includes(monthNamesEs[m])) { currentMonth = m; break; }
          }
          const yMatch = headerNorm.match(/\d{4}/);
          if (yMatch) currentYear = parseInt(yMatch[0], 10);
        } catch {}

        // Compute how many months we should advance (if header found). If header not found,
        // attempt a small number of advances conservatively.
        let monthsToAdvance = 0;
        if (currentMonth !== null && currentYear !== null) {
          monthsToAdvance = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
        } else {
          // conservative: try up to 4 next clicks if we couldn't read header
          monthsToAdvance = 4;
        }

        // Prefer page object locator `rp.nextMonthPicker` if present (more reliable),
        // otherwise fall back to generic selectors.
        const genericNextSelector = 'button[aria-label="Next month"], button[aria-label="Siguiente mes"], button[title="Next month"], button[title="Mes siguiente"], .MuiPickersArrowSwitcher-root button[aria-label]';
        for (let i = 0; i < Math.min(6, monthsToAdvance); i++) {
          let nextBtn = rp.nextMonthPicker;
          if (nextBtn && (await nextBtn.count()) === 0) nextBtn = this.page.locator(genericNextSelector).first();
          if (await nextBtn.count() > 0) {
            await nextBtn.first().click().catch(() => {});
            await this.page.waitForTimeout(250);
          } else {
            break;
          }
        }

        // After navigation attempts, find an enabled day button inside the popper and click it
        try {
          // Scope search to the popper if present
          const popperRoot = await this.page.locator('.MuiPickerPopper-paper').first();
          let dayLocator = popperRoot.locator(`button:has-text("${day}")`);
          // Filter out disabled days via aria-disabled or disabled class
          const enabledDay = dayLocator.filter({ hasNot: this.page.locator('[aria-disabled="true"], .Mui-disabled') }).first();
          if (await enabledDay.count() > 0) {
            await enabledDay.click({ force: true }).catch(()=>{});
            // wait for popper to close
            await this.page.waitForTimeout(250);
            // Wait until the popper disappears or becomes hidden
            try { await this.page.waitForSelector('.MuiPickerPopper-root', { state: 'detached', timeout: 3000 }); } catch {}
            // Verify visible input shows the selected date in DD/MM/YYYY format
            const dd = String(target.getDate()).padStart(2, '0');
            const mm = String(target.getMonth() + 1).padStart(2, '0');
            const display = `${dd}/${mm}/${target.getFullYear()}`;
            // look for an input with placeholder DD/MM/YYYY or the value itself
            const inputByPlaceholder = this.page.locator('input[placeholder="DD/MM/YYYY"]').first();
            if (await inputByPlaceholder.count() > 0) {
              try {
                const val = (await inputByPlaceholder.inputValue()).trim();
                if (val === '' || val === 'DD/MM/YYYY') {
                  // some MUI variants update a hidden input; try a short wait for value
                  await this.page.waitForTimeout(300);
                }
                const finalVal = (await inputByPlaceholder.inputValue()).trim();
                if (finalVal === display) {
                  console.log('[NewRequestAction] date selected via datepicker', isoTarget);
                  dateSet = true;
                } else {
                  // also check for any input containing the display value
                  const anyInput = this.page.locator(`input[value="${display}"]`).first();
                  if (await anyInput.count() > 0) { console.log('[NewRequestAction] date selected via datepicker (value input)', isoTarget); dateSet = true; }
                }
              } catch {}
            } else {
              const anyInput = this.page.locator(`input[value="${display}"]`).first();
              if (await anyInput.count() > 0) { console.log('[NewRequestAction] date selected via datepicker (value input)', isoTarget); dateSet = true; }
            }
          } else {
            // fallback: search the entire document for an enabled button with the day text and click it
            const clicked = await this.page.evaluate((d) => {
              const norm = (s: string) => s.replace(/\u00a0/g, ' ').trim();
              const nodes = Array.from(document.querySelectorAll('.MuiPickerPopper-paper button, .MuiDateCalendar-root button, button'));
              for (const n of nodes) {
                const txt = n.textContent ? norm(n.textContent) : '';
                if (txt === String(d)) {
                  const el = n as HTMLElement;
                  const ariaDisabled = el.getAttribute('aria-disabled');
                  const cls = el.className || '';
                  if (ariaDisabled === 'true' || /disabled|Mui-disabled/i.test(cls)) continue;
                  try { el.click(); return true; } catch {}
                }
              }
              return false;
            }, day);
            if (clicked) {
              try { await this.page.waitForSelector('.MuiPickerPopper-root', { state: 'detached', timeout: 3000 }); } catch {}
              console.log('[NewRequestAction] date selected via exhaustive DOM click', isoTarget);
              dateSet = true;
            } else {
              console.warn('[NewRequestAction] could not set date via datepicker (day not found, exhaustive search failed)');
            }
          }
        } catch (e) { console.warn('[NewRequestAction] error clicking day in popper', e); }
      } else {
        console.warn('[NewRequestAction] datepicker icon not found');
      }
      if (!dateSet) {
        // Final fallback: set the visible input value via JS and dispatch events so React/MUI picks it up.
        try {
          const dd = String(target.getDate()).padStart(2, '0');
          const mm = String(target.getMonth() + 1).padStart(2, '0');
          const display = `${dd}/${mm}/${target.getFullYear()}`;
          const didSet = await this.page.evaluate(({display, iso}) => {
            // try visible input with placeholder
            const inputs = Array.from(document.querySelectorAll('input'));            
            const possible = inputs.find(i => (i.getAttribute('placeholder') || '').includes('DD/MM') || (i as HTMLInputElement).value.includes('/')) || inputs[0];
            if (!possible) return false;
            try {
              (possible as HTMLInputElement).focus();
              (possible as HTMLInputElement).value = display;
              const ev = new Event('input', { bubbles: true });
              possible.dispatchEvent(ev);
              const ev2 = new Event('change', { bubbles: true });
              possible.dispatchEvent(ev2);
              (possible as HTMLInputElement).blur();
              // also set any hidden ISO input if present
              const hiddenIso = document.querySelector('input[type="hidden"][value*="-"]') as HTMLInputElement | null;
              if (hiddenIso) { hiddenIso.value = iso; hiddenIso.dispatchEvent(new Event('input', { bubbles: true })); hiddenIso.dispatchEvent(new Event('change', { bubbles: true })); }
              return true;
      } catch (e) { return false; }
          }, { display, iso: isoTarget });

          if (didSet) {
            // close popper by pressing Escape and clicking outside
            await this.page.keyboard.press('Escape').catch(()=>{});
            await this.page.mouse.click(10, 10).catch(()=>{});
            await this.page.waitForTimeout(300);
            // verify visible input contains the display value
            const visible = await this.page.locator(`input[placeholder="DD/MM/YYYY"]`).first();
            if (await visible.count() > 0) {
              const val = (await visible.inputValue()).trim();
              if (val === display) { console.log('[NewRequestAction] date set via JS fallback', isoTarget); dateSet = true; }
            } else {
              const any = this.page.locator(`input[value="${display}"]`).first();
              if (await any.count() > 0) { console.log('[NewRequestAction] date set via JS fallback (value input)', isoTarget); dateSet = true; }
            }
          }
        } catch (e) { console.warn('[NewRequestAction] JS fallback for datepicker failed', e); }
        if (!dateSet) console.warn('[NewRequestAction] datepicker interaction could not confirm selection for', isoTarget);
      }
    } catch (e) { console.warn('[NewRequestAction] datepicker interaction error', e); }

    // (Verificación detallada eliminada para simplificar y acelerar)
    // ===== LÓGICA DE ADJUNTOS VIA HELPER (configurable) =====
    const includeOptional = process.env.INCLUDE_OPTIONAL_ATTACH === '1';
  // (debug antes de adjuntos omitido)
    const { summary: attachedSummary, missingRequired } = await uploadAttachments(this.page, {
      includeOptional,
      pauseBetween: 160,          // ligero throttle para estabilidad
  // no-op saveDebug eliminado
      throwOnMissingRequired: true
    });
    if (missingRequired.length) {
      console.warn('[NewRequestAction] Tipos requeridos faltantes tras helper:', missingRequired);
    }
    console.log('[NewRequestAction] Resumen adjuntos (helper):', attachedSummary);

    // Guardado final directo y mínimo
    const saveBtn = this.page.locator('dfn[title*="Guardar"] button, button:has-text("Guardar"), button:has-text("Crear")').first();
    await saveBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(()=>{});
    if (await saveBtn.count() === 0) throw new Error('Botón Guardar no encontrado');
    // esperar habilitado rápido (poll corto)
    for (let i=0;i<40;i++) {
      const enabled = await saveBtn.evaluate((el:HTMLElement)=>!(el as HTMLButtonElement).disabled && !el.getAttribute('aria-disabled')).catch(()=>false);
      if (enabled) break;
      await this.page.waitForTimeout(150);
    }
    await saveBtn.click({ force: true }).catch(()=>{});
    // esperar aparición de descripción o cambio de URL
    await Promise.race([
      this.page.getByText(mock.descripcion).first().waitFor({ state: 'visible', timeout: 15000 }).catch(()=>null),
      this.page.waitForURL(u=>!/Nueva-solicitud/i.test(u.toString()), { timeout: 12000 }).catch(()=>null)
    ]).catch(()=>{});

    await expect(this.page.getByText(mock.descripcion)).toBeVisible({ timeout: 30_000 });
    return mock;
  }
}
