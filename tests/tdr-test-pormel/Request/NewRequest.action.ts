import { BaseAction } from "../../config/BaseActions";
import { RequestPage } from "./request.page";
import { GoToRequestsAction } from "../Home/goToRequests.action";
import { createRequestMock, RequestMock } from "../../fixtures/mocks/request.mock";
import { getRandomFixtureFilePath } from "../../config/FileUtils";
import { expect } from "@playwright/test";

export class NewRequestAction extends BaseAction {
  // Helper: guarda artefactos de depuración
  private async saveDebug(name: string) {
    try {
      const fs = require('fs');
      const path = require('path');
      const outDir = path.resolve(process.cwd(), 'playwright-artifacts');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const pngPath = path.join(outDir, `${name}.png`);
      const htmlPath = path.join(outDir, `${name}.html`);
      await this.page.screenshot({ path: pngPath, fullPage: false }).catch(()=>{});
      const content = await this.page.content();
      fs.writeFileSync(htmlPath, content, { encoding: 'utf8' });
    } catch {}
  }

  // Helper: espera a que un botón de guardado esté habilitado y lo clickea
  private async clickFinalSave(expectDescription: string, timeoutMs = 20000) {
    const startUrl = this.page.url();
    const labelPattern = /(Guardar|Crear|Aceptar|Save)/i;
    const hardDeadline = Date.now() + timeoutMs;

    const primaryWrapper = this.page.locator('dfn[title*="Guardar"]').locator('button:has-text("Guardar")').first();
    const genericButtons = this.page.locator('button').filter({ hasText: labelPattern });

    let targetButton: any = null;
    const resolveButton = async () => {
      if (await primaryWrapper.count() > 0) return primaryWrapper;
      if (await genericButtons.count() > 0) {
        // prefer last (a menudo el que está en el footer del formulario)
        return genericButtons.last();
      }
      return null;
    };

    while (Date.now() < hardDeadline) {
      targetButton = await resolveButton();
      if (targetButton && await targetButton.count() > 0) {
        const enabled = await targetButton.evaluate((el: HTMLElement) => !(el as HTMLButtonElement).disabled && !el.getAttribute('aria-disabled'));
        if (enabled) break;
      }
      await this.page.waitForTimeout(300);
    }

    if (!targetButton || await targetButton.count() === 0) {
      await this.saveDebug('save-button-not-found');
      throw new Error('No se encontró ningún botón de guardado');
    }

    const requestCapture: { url: string; status: number; ok: boolean }[] = [];
    const listener = (response: any) => {
      try {
        const req = response.request();
        if (req.method() === 'POST' && /(solicitud|request|tdr)/i.test(req.url())) {
          requestCapture.push({ url: req.url(), status: response.status(), ok: response.ok() });
        }
      } catch {}
    };
    this.page.on('response', listener);

    console.log('[NewRequestAction] Clic en botón final de guardado');
    await targetButton.click({ force: true }).catch(()=>{});
    await this.saveDebug('after-save-click');

    // Esperar una respuesta POST relevante o un cambio de URL o desaparición del heading
    const waitPromises: Promise<any>[] = [];
    waitPromises.push(this.page.waitForResponse(r => {
      const req = r.request();
      return req.method() === 'POST' && /(solicitud|request|tdr)/i.test(req.url()) && r.status() < 500;
    }, { timeout: 10000 }).catch(()=>null));
    waitPromises.push(this.page.waitForURL(url => url.toString() !== startUrl && !/Nueva-solicitud/i.test(url.toString()), { timeout: 10000 }).catch(()=>null));
    waitPromises.push(this.page.getByRole('heading', { name: /Nueva solicitud/i }).waitFor({ state: 'detached', timeout: 10000 }).catch(()=>null));

    await Promise.race(waitPromises).catch(()=>{});

    // Pequeña espera adicional para finalización de lógica frontend
    await this.page.waitForTimeout(800);

    this.page.removeListener('response', listener);
    console.log('[NewRequestAction] Respuestas POST capturadas:', requestCapture);

    // Si seguimos en la página de nueva solicitud, intentar volver a lista.
    if (/Nueva-solicitud/i.test(this.page.url())) {
      console.warn('[NewRequestAction] URL sigue en formulario; navegando manualmente a Mis Solicitudes para verificar persistencia');
      const linkList = this.page.getByRole('link', { name: /Mis Solicitudes/i });
      if (await linkList.count() > 0) await linkList.first().click().catch(()=>{});
      else {
        const btnList = this.page.getByRole('button', { name: /Mis Solicitudes/i });
        if (await btnList.count() > 0) await btnList.first().click().catch(()=>{});
      }
      await this.page.waitForTimeout(1500);
    }

    // Verificar aparición de la descripción en listado.
    let found = false;
    for (let i=0;i<10 && !found;i++) {
      const loc = this.page.getByText(expectDescription, { exact: false });
      if (await loc.count() > 0 && await loc.first().isVisible().catch(()=>false)) { found = true; break; }
      await this.page.waitForTimeout(500);
    }
    if (!found) {
      await this.saveDebug('description-not-found-in-list');
      console.warn('[NewRequestAction] Descripción no encontrada en listado tras guardado');
      // Falla dura para que el test no pase falsamente
      throw new Error('La solicitud no aparece en la lista después de guardar');
    } else {
      console.log('[NewRequestAction] Solicitud localizada en la lista');
    }
  }

  // Helper: verifica que cada nombre de archivo aparezca en la UI tras la subida
  private async verifyFilesListed(filePaths: string[], timeoutPerFile = 7000) {
    for (const fp of filePaths) {
      const base = require('path').basename(fp);
      const start = Date.now();
      let found = false;
      while (Date.now() - start < timeoutPerFile && !found) {
        // Candidatos: texto plano, elementos con data-testid relacionada, items de lista
        const loc = this.page.locator(`text=${base}`);
        if (await loc.count() > 0 && await loc.first().isVisible().catch(()=>false)) { found = true; break; }
        // Buscar versiones recortadas (algunos UIs muestran solo parte del nombre)
        if (base.length > 12) {
          const partial = base.slice(0, 8);
          const partialLoc = this.page.locator(`text=${partial}`);
          if (await partialLoc.count() > 0 && await partialLoc.first().isVisible().catch(()=>false)) { found = true; break; }
        }
        await this.page.waitForTimeout(250);
      }
      if (!found) {
        console.warn(`[NewRequestAction] No se localizó visualmente el archivo '${base}' (puede requerir selector específico)`);
        await this.saveDebug(`missing-file-${base}`);
      } else {
        console.log(`[NewRequestAction] Archivo '${base}' visible tras subida`);
      }
    }
  }
  async createRequestWithFiles(overrides?: Partial<RequestMock>): Promise<RequestMock> {
    const mock = createRequestMock({ ...overrides });

    // Navigate to Requests
    const goToRequests = new GoToRequestsAction(this.page);
    await goToRequests.navigateToRequests();

    const rp = new RequestPage(this.page);

    // Open new request dialog
    await this.verifyIfLocatorIsVisible(rp.newRequestButton);
    await rp.newRequestButton.click();

    // Debug: save screenshot and modal html for inspection (helps identify dropdown structure)
    await this.saveDebug('new-request-modal-opened');

    // We keep only the MUI-specific selection strategy to reduce complexity.
    // The generic fallback selectors were removed because this app uses MUI selects.

    // Select in order and wait for dependent updates
    const selectMuiSelectByLabel = async (labelText: string, desired?: string, waitForChild?: string, timeout = 5000): Promise<string|null> => {
      try {
        const labelEl = this.page.locator(`label:has-text("${labelText}")`).first();
        if (await labelEl.count() === 0) return null;
        const container = labelEl.locator('..').first();
        const cb = container.locator('[role="combobox"]').first();
        if (await cb.count() === 0) return null;
        await cb.scrollIntoViewIfNeeded();

        // read aria attributes for debugging
        try {
          const ariaControls = await cb.getAttribute('aria-controls');
          const ariaExpanded = await cb.getAttribute('aria-expanded');
          console.log(`[NewRequestAction] combobox for '${labelText}' aria-controls='${ariaControls}' aria-expanded='${ariaExpanded}'`);
        } catch {}

        // Try clicking the visible combobox; if nothing opens, also try clicking a native/select input inside the container
        await cb.click({ force: true }).catch(() => {});
        const nativeInput = container.locator('select, input.MuiSelect-nativeInput').first();
        try {
          if (await nativeInput.count() > 0) {
            // click the native input as an alternative open action for some MUI variants
            await nativeInput.click({ force: true }).catch(() => {});
          }
        } catch {}
        // Wait briefly and prefer to detect expansion via aria-expanded (faster & less flaky).
        await this.page.waitForTimeout(40);
        try {
          // wait for aria-expanded to flip to true (common on MUI selects)
          const waitExpanded = async () => {
            for (let i = 0; i < 10; i++) {
              const ariaExpanded = await cb.getAttribute('aria-expanded').catch(() => null);
              if (ariaExpanded === 'true') return true;
              await this.page.waitForTimeout(50);
            }
            return false;
          };
          await waitExpanded().catch(() => {});

          const panelIdQuick = await cb.getAttribute('aria-controls').catch(() => null);
          const cbId = await cb.getAttribute('id').catch(() => null);
          if (panelIdQuick) {
            // use XPath lookup by id to avoid CSS escaping issues with ids that contain ':'
            const panelQuick = this.page.locator(`xpath=//*[@id="${panelIdQuick}"]`);
            await panelQuick.locator('[role="option"]').first().waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
          } else if (cbId) {
            // some MUI menus reference the combobox via aria-labelledby instead of aria-controls
            const panelByLabel = this.page.locator(`xpath=//*[@aria-labelledby="${cbId}"]`);
            await panelByLabel.locator('[role="option"]').first().waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
          } else {
            await this.page.locator('[role="option"]').first().waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
          }
        } catch {}

        const pickAttempt = async (): Promise<string | null> => {
          // prefer to search inside the panel referenced by aria-controls if present
          let options = this.page.locator('[role="option"]');
          let panel: any = null;
          try {
            const panelId = await cb.getAttribute('aria-controls');
            if (panelId) {
              panel = this.page.locator(`xpath=//*[@id="${panelId}"]`);
              if (await panel.count() > 0) {
                options = panel.locator('[role="option"]');
              }
            }
          } catch {}

          const texts: string[] = [];
          const count = await options.count();
          for (let i = 0; i < count; i++) {
            const t = (await options.nth(i).innerText()).trim();
            if (t && !/select|elegir|--/i.test(t)) texts.push(t);
          }
          if (texts.length === 0) {
            // Fallback 1: look for list-like items but only inside the select's container
            // to avoid picking unrelated global list items (e.g. breadcrumbs).
            const alt = container.locator('.v-list-item, .dropdown-item, li, a').filter({ hasText: /./ });
            for (let i = 0; i < await alt.count(); i++) {
              const t = (await alt.nth(i).innerText()).trim(); if (t && !/select|elegir|--/i.test(t)) texts.push(t);
            }
          }

          // Fallback 2: if still empty, search common popper/menu roots appended to body
          if (texts.length === 0) {
            const popperRoots = this.page.locator('.MuiPopover-root, .MuiPopper-root, .MuiMenu-paper, .MuiAutocomplete-popper, div[role="presentation"], .MuiMenu-list, .MuiList-root');
            for (let r = 0; r < await popperRoots.count(); r++) {
              const root = popperRoots.nth(r);
              try {
                const cand = root.locator('[role="option"], [role="menuitem"], li, a').filter({ hasText: /./ });
                for (let j = 0; j < await cand.count(); j++) {
                  const t = (await cand.nth(j).innerText()).trim(); if (t && !/select|elegir|--/i.test(t)) texts.push(t);
                }
              } catch {}
              if (texts.length > 0) break;
            }
          }

          // Fallback 3: quick reopen/retry loop - sometimes options are populated after an extra click
          if (texts.length === 0) {
            for (let retry = 0; retry < 3 && texts.length === 0; retry++) {
              try { await cb.click({ force: true }).catch(() => {}); } catch {}
              await this.page.waitForTimeout(150 + retry * 100);
              // try panel by aria-controls again
              try {
                const panelId = await cb.getAttribute('aria-controls').catch(() => null);
                if (panelId) {
                  const panel = this.page.locator(`xpath=//*[@id="${panelId}"]`);
                  const opts = panel.locator('[role="option"]').filter({ hasText: /./ });
                  for (let k = 0; k < await opts.count(); k++) {
                    const t = (await opts.nth(k).innerText()).trim(); if (t && !/select|elegir|--/i.test(t)) texts.push(t);
                  }
                }
              } catch {}
              if (texts.length > 0) break;
              // re-scan popper roots
              const popperRoots2 = this.page.locator('.MuiPopover-root, .MuiPopper-root, .MuiMenu-paper, .MuiAutocomplete-popper, div[role="presentation"], .MuiMenu-list, .MuiList-root');
              for (let r = 0; r < await popperRoots2.count(); r++) {
                const root = popperRoots2.nth(r);
                try {
                  const cand = root.locator('[role="option"], [role="menuitem"], li, a').filter({ hasText: /./ });
                  for (let j = 0; j < await cand.count(); j++) {
                    const t = (await cand.nth(j).innerText()).trim(); if (t && !/select|elegir|--/i.test(t)) texts.push(t);
                  }
                } catch {}
                if (texts.length > 0) break;
              }
            }
          }

          console.log(`[NewRequestAction] options for '${labelText}': ${JSON.stringify(texts.slice(0, 20))}`);

          if (texts.length === 0) { await this.page.keyboard.press('Escape').catch(()=>{}); return null; }
          let pick: string | null = null;
          if (desired && texts.includes(desired)) pick = desired;
          else pick = texts[Math.floor(Math.random() * texts.length)];

          // prefer scoping the role lookup to the panel if available to avoid global matches
          let optByRole = this.page.getByRole('option', { name: pick || '' }).first();
          try {
            if (panel) optByRole = panel.getByRole('option', { name: pick || '' }).first();
          } catch {}
          if (await optByRole.count() > 0) { await optByRole.click({ force: true }).catch(()=>{}); }
          else {
            for (let i = 0; i < await options.count(); i++) {
              const t = (await options.nth(i).innerText()).trim(); if (t === pick) { await options.nth(i).click({ force: true }).catch(()=>{}); break; }
            }
          }
          return pick;
        };

        // Try selection and if desired provided, retry up to 2 times if the combobox value
        // after selection doesn't contain the desired text.
        let pick = await pickAttempt();
        if (desired && pick) {
          for (let attempt = 0; attempt < 2; attempt++) {
            await this.page.waitForTimeout(150);
            const current = (await cb.innerText()).trim();
            if (current.includes(desired)) break;
            console.log(`[NewRequestAction] desired '${desired}' not reflected after pick='${pick}' (current='${current}'), retrying (${attempt+1})`);
            // re-open and try again
            await cb.click({ force: true }).catch(() => {});
            await this.page.waitForTimeout(150);
            pick = await pickAttempt();
          }
        }

        if (waitForChild) {
          // Wait until the dependent child select has options using locator.waitFor (faster than manual polling).
          try {
            const childLabelEl = this.page.locator(`label:has-text("${waitForChild}")`).first();
            if (await childLabelEl.count() > 0) {
              const childContainer = childLabelEl.locator('..').first();
              const childCb = childContainer.locator('[role="combobox"]').first();
              if (await childCb.count() > 0) {
                const panelId = await childCb.getAttribute('aria-controls').catch(() => null);
                if (panelId) {
                  const panel = this.page.locator(`#${panelId}`);
                  await panel.locator('[role="option"]').first().waitFor({ state: 'visible', timeout }).catch(() => {});
                } else {
                  await childCb.locator('[role="option"]').first().waitFor({ state: 'visible', timeout }).catch(() => {});
                }
              } else {
                // maybe native select
                const childSelect = childLabelEl.locator('select').first();
                if (await childSelect.count() > 0) {
                  await childSelect.locator('option').first().waitFor({ state: 'visible', timeout }).catch(() => {});
                }
              }
            }
          } catch {}
        }

        console.log(`[NewRequestAction] selected (mui) '${pick}' for '${labelText}'`);
        return pick;
      } catch (e) { console.warn('[NewRequestAction] selectMuiSelectByLabel error', e); return null; }
    };

  // Do not pass a 'desired' value so the helper picks a random available option each run.
  const unidadSelected = await selectMuiSelectByLabel('Unidad', undefined, 'Area', 7000);
  const areaSelected = await selectMuiSelectByLabel('Área', undefined, 'Sociedad', 7000);
  const sociedadSelected = await selectMuiSelectByLabel('Sociedad', undefined, 'Tipo de servicio', 7000);
  const tipoSelected = await selectMuiSelectByLabel('Tipo de servicio', undefined, undefined, 7000);

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
  try { await this.saveDebug('date-picker-opened'); } catch {}

        // Find the calendar header text (e.g. "agosto 2025") inside the open popper
        let popper = this.page.locator('.MuiPickerPopper-paper').first();
        // Wait for popper to be visible briefly. If not found, try any popper/dialog root
        if (await popper.count() === 0) popper = this.page.locator('div[role="dialog"].MuiPopper-root').first();

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
          try {
            let nextBtn = rp.nextMonthPicker;
            if (nextBtn && (await nextBtn.count()) === 0) nextBtn = this.page.locator(genericNextSelector).first();
            // re-evaluate in case locator changes
            if (await nextBtn.count() > 0) {
              await nextBtn.first().click().catch(() => {});
              await this.page.waitForTimeout(250);
            } else {
              break;
            }
          } catch (e) { break; }
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
          const iso = isoTarget;
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

  // Instead of a fixed 10s wait, wait for each field to stabilize with a bounded polling loop.
    const verifyField = async (labelText: string, expected: string | null): Promise<boolean> => {
      if (!expected) return false;
      try {
        const labelEl = this.page.locator(`label:has-text("${labelText}")`).first();
        if (await labelEl.count() === 0) return false;
        const container = labelEl.locator('..').first();
        const cb = container.locator('[role="combobox"]').first();
        if (await cb.count() > 0) {
          const value = (await cb.innerText()).trim();
          return value.includes(expected);
        }
        // fallback: look for the expected text visible on the page
        return (await this.page.getByText(expected).count()) > 0;
      } catch (e) {
        return false;
      }
    };

    const waitForFieldReady = async (labelText: string, expected: string | null, timeoutMs = 7000): Promise<boolean> => {
      if (!expected) return false;
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          if (await verifyField(labelText, expected)) return true;
        } catch {}
        await this.page.waitForTimeout(200);
      }
      return false;
    };

    const unidadOk = await waitForFieldReady('Unidad', unidadSelected, 7000);
    const areaOk = await waitForFieldReady('Área', areaSelected, 7000);
    const sociedadOk = await waitForFieldReady('Sociedad', sociedadSelected, 7000);
    const tipoOk = await waitForFieldReady('Tipo de servicio', tipoSelected, 7000);
    let descOk = false;
    try {
      const descEl = this.page.getByLabel('Descripción').first();
      if (await descEl.count() > 0) {
        // wait shortly for the textarea to contain the value we filled
        const start = Date.now();
        while (Date.now() - start < 3000) {
          const val = (await descEl.inputValue()).trim();
          if (val === mock.descripcion) { descOk = true; break; }
          await this.page.waitForTimeout(150);
        }
      } else {
        descOk = (await this.page.getByText(mock.descripcion).count()) > 0;
      }
    } catch { descOk = false; }

    try {
      const dateInput = this.page.locator('input[type="date"]').first();
      if (await dateInput.count() > 0) {
        const v = await dateInput.inputValue();
        if (v !== mock.fecha) console.warn('[NewRequestAction] date field value differs', { actual: v, expected: mock.fecha });
      }
    } catch {}

    if (!unidadOk || !areaOk || !sociedadOk || !tipoOk || !descOk) {
      console.warn('[NewRequestAction] Field verification failed', { unidadOk, areaOk, sociedadOk, tipoOk, descOk });
    } else {
      console.log('[NewRequestAction] All fields verified after 10s wait');
    }
    // ===== NUEVA LÓGICA DE ADJUNTOS VIA MODAL =====
    const requiredTypes = ['TDR','BASES','ANEXO'];
    const includeOptional = Math.random() < 0.5; // 50% opcional
    const optionalType = 'OTROS';
    const allPlanned = includeOptional ? [...requiredTypes, optionalType] : [...requiredTypes];
    const attachedSummary: { tipo: string; file: string; success: boolean }[] = [];

    const openAttachmentModal = async () => {
      // Intentar localizar un botón "Agregar" que no sea el primero (usado para abrir la solicitud) o un botón específico de adjuntos.
      // Estrategia: probar candidatos en orden.
      const candidates = [
        this.page.getByRole('button', { name: /Agregar archivo|Adjuntar archivo|Añadir archivo/i }),
        this.page.getByRole('button', { name: /^Agregar$/ }).nth(1), // segundo "Agregar"
        this.page.getByRole('button', { name: /^Agregar$/ }).last()
      ];
      for (const c of candidates) {
        if (await c.count() > 0) {
          await c.first().click().catch(()=>{});
          // esperar a que aparezca un dialog (combobox dentro de un contenedor modal)
          for (let i=0;i<15;i++) {
            const combo = this.page.locator('div[role="combobox"]').last();
            if (await combo.count() > 0) return true;
            await this.page.waitForTimeout(150);
          }
        }
      }
      return false;
    };

    const selectAttachmentType = async (tipo: string) => {
      // Buscar el último combobox visible (modal recién abierto)
      const combo = this.page.locator('div[role="combobox"]').last();
      if (await combo.count() === 0) return false;
      await combo.click({ force: true }).catch(()=>{});
      // esperar opciones
      let optionClicked = false;
      for (let i=0;i<10 && !optionClicked;i++) {
        const opt = this.page.getByRole('option', { name: new RegExp(`^${tipo}$`, 'i') });
        if (await opt.count() > 0) {
          await opt.first().click().catch(()=>{});
          optionClicked = true;
          break;
        }
        await this.page.waitForTimeout(150);
      }
      if (!optionClicked) {
        // Fallback: buscar texto directo
        const txt = this.page.getByText(new RegExp(`^${tipo}$`, 'i')).last();
        if (await txt.count() > 0) { await txt.click().catch(()=>{}); optionClicked = true; }
      }
      return optionClicked;
    };

    const uploadSingleFileInModal = async (filePath: string) => {
      // Localizar input[type=file] dentro de un label con texto "Subir archivo"
      const labelBtn = this.page.locator('label:has-text("Subir archivo")').last();
      if (await labelBtn.count() === 0) {
        console.warn('[NewRequestAction] No se encontró label "Subir archivo"');
        return false;
      }
      const input = labelBtn.locator('input[type="file"]');
      if (await input.count() === 0) {
        console.warn('[NewRequestAction] Input file no presente dentro del label de subida');
        return false;
      }
      try {
        await input.setInputFiles(filePath);
        console.log('[NewRequestAction] Archivo asignado al input:', filePath);
        return true;
      } catch (e) {
        console.warn('[NewRequestAction] Falló setInputFiles en modal', e);
        return false;
      }
    };

    const saveAttachmentModal = async () => {
      // Buscar botón Guardar dentro del modal (el último visible con ese nombre)
      const btn = this.page.getByRole('button', { name: /^Guardar$/ }).last();
      if (await btn.count() === 0) return false;
      // esperar a que esté habilitado
      for (let i=0;i<20;i++) {
        const enabled = await btn.first().evaluate((el: HTMLElement)=> !(el as HTMLButtonElement).disabled && !el.getAttribute('aria-disabled'));
        if (enabled) break;
        await this.page.waitForTimeout(200);
      }
      await btn.first().click().catch(()=>{});
      // esperar cierre del modal (desaparición de combobox o input file)
      for (let i=0;i<30;i++) {
        const stillOpen = await this.page.locator('label:has-text("Subir archivo") input[type="file"]').count();
        if (stillOpen === 0) return true;
        await this.page.waitForTimeout(200);
      }
      return true; // tolerante
    };

    for (const tipo of allPlanned) {
      const filePath = getRandomFixtureFilePath();
      console.log(`[NewRequestAction] Iniciando adjunto tipo '${tipo}' con archivo '${filePath}'`);
      const opened = await openAttachmentModal();
      if (!opened) {
        console.warn('[NewRequestAction] No se abrió el modal de adjuntos');
        attachedSummary.push({ tipo, file: filePath, success: false });
        continue;
      }
      const typeSet = await selectAttachmentType(tipo);
      if (!typeSet) {
        console.warn(`[NewRequestAction] No se pudo seleccionar tipo '${tipo}'`);
        await this.saveDebug(`tipo-no-seleccionado-${tipo}`);
        attachedSummary.push({ tipo, file: filePath, success: false });
        // intentar cerrar modal presionando ESC
        await this.page.keyboard.press('Escape').catch(()=>{});
        continue;
      }
      const uploaded = await uploadSingleFileInModal(filePath);
      if (!uploaded) {
        console.warn(`[NewRequestAction] Falló subida de archivo para tipo '${tipo}'`);
        await this.saveDebug(`subida-fallida-${tipo}`);
        attachedSummary.push({ tipo, file: filePath, success: false });
        await this.page.keyboard.press('Escape').catch(()=>{});
        continue;
      }
      const saved = await saveAttachmentModal();
      if (!saved) {
        console.warn(`[NewRequestAction] No se guardó el adjunto tipo '${tipo}'`);
        await this.saveDebug(`adjunto-no-guardado-${tipo}`);
      }
      attachedSummary.push({ tipo, file: filePath, success: saved });
      // pequeña espera antes del siguiente
      await this.page.waitForTimeout(400);
    }

    // Validar que los obligatorios se hayan adjuntado con éxito
    const missingRequired = requiredTypes.filter(r => !attachedSummary.find(a => a.tipo === r && a.success));
    if (missingRequired.length > 0) {
      await this.saveDebug('adjuntos-requeridos-faltantes');
      throw new Error(`Faltan adjuntar tipos requeridos: ${missingRequired.join(', ')}`);
    }
    console.log('[NewRequestAction] Resumen adjuntos:', attachedSummary);

    await this.saveDebug('before-final-save');
    await this.clickFinalSave(mock.descripcion).catch(err => { throw err; });

    await expect(this.page.getByText(mock.descripcion)).toBeVisible({ timeout: 30_000 });
    return mock;
  }
}
