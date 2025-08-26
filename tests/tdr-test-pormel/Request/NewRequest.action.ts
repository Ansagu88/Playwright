import { BaseAction } from "../../config/BaseActions";
import { RequestPage } from "./request.page";
import { GoToRequestsAction } from "../Home/goToRequests.action";
import { createRequestMock, RequestMock } from "../../fixtures/mocks/request.mock";
import { getRandomFixtureFilePath } from "../../config/FileUtils";
import { expect } from "@playwright/test";

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

    // Debug: save screenshot and modal html for inspection (helps identify dropdown structure)
    const saveDebug = async (name: string) => {
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
      } catch (e) { /* ignore debug errors */ }
    };

    await saveDebug('new-request-modal-opened');

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

        await cb.click({ force: true }).catch(() => {});
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
          if (panelIdQuick) {
            // use XPath lookup by id to avoid CSS escaping issues with ids that contain ':'
            const panelQuick = this.page.locator(`xpath=//*[@id="${panelIdQuick}"]`);
            await panelQuick.locator('[role="option"]').first().waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
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
            const alt = this.page.locator('.v-list-item, .dropdown-item, li').filter({ hasText: /./ });
            for (let i = 0; i < await alt.count(); i++) {
              const t = (await alt.nth(i).innerText()).trim(); if (t && !/select|elegir|--/i.test(t)) texts.push(t);
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
        try { await saveDebug('date-picker-opened'); } catch {}

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

  // Wait 10s and verify fields before uploading files
    await this.page.waitForTimeout(10_000);

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

    const unidadOk = await verifyField('Unidad', unidadSelected);
    const areaOk = await verifyField('Área', areaSelected);
    const sociedadOk = await verifyField('Sociedad', sociedadSelected);
    const tipoOk = await verifyField('Tipo de servicio', tipoSelected);
    let descOk = false;
    try {
      const descEl = this.page.getByLabel('Descripción').first();
      if (await descEl.count() > 0) descOk = (await descEl.inputValue()).trim() === mock.descripcion;
      else descOk = (await this.page.getByText(mock.descripcion).count()) > 0;
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
    // Ensure file input is available. Some UIs require an intermediate save/continue
    // to expose the file uploader. If the input is not present, try clicking a
    // provisional save/continue button and wait for the input to appear.
    try {
      const fileInput = this.page.locator('input[type="file"]');
      if (await fileInput.count() === 0) {
  const provisionalButtons = ['Guardar', 'Guardar y continuar', 'Continuar', 'Adjuntar', 'Agregar', 'Agregar archivo', 'Añadir', 'Añadir archivo', 'Save', 'Save and continue'];
        for (const label of provisionalButtons) {
          const btn = this.page.getByRole('button', { name: label });
          if (await btn.count() > 0) {
            console.log(`[NewRequestAction] clicking provisional button '${label}' to enable uploader`);
            await btn.first().click().catch(() => {});
            const start = Date.now();
            while (Date.now() - start < 5000) {
              const cnt = await fileInput.count();
              console.log(`[NewRequestAction] waiting for file input, count=${cnt}`);
              if (cnt > 0) break;
              await this.page.waitForTimeout(200);
            }
            break;
          }
        }
      }
    } catch (e) { /* ignore */ }
    try {
      // If still no file input, try clicking upload-like buttons explicitly (Agregar/Agregar archivo/Subir...)
      const fileInput = this.page.locator('input[type="file"]');
      if (await fileInput.count() === 0) {
        const uploadButtons = this.page.getByRole('button', { name: /Agregar|Agregar archivo|Añadir|Añadir archivo|Subir archivo|Adjuntar|Upload file/i });
        if (await uploadButtons.count() > 0) {
          console.log('[NewRequestAction] clicking upload-like button to reveal file input');
          await uploadButtons.first().click().catch(() => {});
          const start = Date.now();
          while (Date.now() - start < 5000) {
            const cnt = await fileInput.count();
            console.log('[NewRequestAction] waiting for file input after upload button, count=', cnt);
            if (cnt > 0) break;
            await this.page.waitForTimeout(200);
          }
        }
      }
    } catch (e) { /* ignore */ }
    // Upload 3 random files
    const files: string[] = [];
    for (let i = 0; i < 3; i++) files.push(getRandomFixtureFilePath());
    try {
      const fi = this.page.locator('input[type="file"]');
      console.log('[NewRequestAction] file input count before upload:', await fi.count());
      if (await fi.count() > 0) {
        try {
          await fi.first().setInputFiles(files);
          console.log('[NewRequestAction] setInputFiles succeeded with', files);
        } catch (e) {
          console.warn('[NewRequestAction] setInputFiles failed, trying per-file', e);
          for (const f of files) {
            try { await fi.first().setInputFiles(f); console.log('[NewRequestAction] set single file', f);} catch (err) { console.warn('[NewRequestAction] single setInputFiles failed for', f, err); }
          }
        }
      } else {
        const up = this.page.getByRole('button', { name: /Subir archivo|Adjuntar|Cargar archivo|Upload file/i });
        if (await up.count() > 0) {
          await up.first().click();
          const after = this.page.locator('input[type="file"]');
          const start = Date.now();
          while (Date.now() - start < 5000) {
            const cnt = await after.count();
            console.log('[NewRequestAction] file input count after clicking upload button:', cnt);
            if (cnt > 0) break;
            await this.page.waitForTimeout(200);
          }
          if (await after.count() > 0) {
            try { await after.first().setInputFiles(files); console.log('[NewRequestAction] setInputFiles after clicking upload button'); } catch (e) { console.warn('[NewRequestAction] setInputFiles after clicking upload button failed', e); }
          } else {
            console.warn('[NewRequestAction] no file input found after clicking upload button');
          }
        }
      }
    } catch {}

    // After files are attached, execute save/submit once.
    // This centralizes the final submit to happen after upload is complete.
    for (const n of ['Guardar','Crear','Aceptar','Save']) {
      const b = this.page.getByRole('button', { name: n });
      if (await b.count() > 0) { await b.first().click(); break; }
    }

    await expect(this.page.getByText(mock.descripcion)).toBeVisible({ timeout: 30_000 });
    return mock;
  }
}
