import { BaseAction } from "../../config/BaseActions";
import { RequestPage } from "./Request.page";
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

    // Robust selector: mock-first, fallback to choosing a random visible option in the UI
    // Also handles native <select> and custom dropdowns and waits for dependent selects to update.
    const selectWithFallback = async (
      labels: string[],
      desiredValue?: string,
      waitForChildLabel?: string,
      timeout = 5000
    ): Promise<string | null> => {
      const start = Date.now();

      const readNativeOptions = async (el: any) => {
        try {
          const opts = await el.locator('option').allTextContents();
          return opts.map((t: string) => t.trim()).filter((t: string) => !!t && !/select|elegir|--/i.test(t));
        } catch { return [] as string[]; }
      };

      for (const label of labels) {
        try {
          const byLabel = this.page.getByLabel(label).first();
          if (await byLabel.count() > 0) {
            // detect native select
            const tag = await byLabel.evaluate((el: HTMLElement) => el.tagName.toLowerCase());
            if (tag === 'select') {
              const choices = await readNativeOptions(byLabel);
              let pick: string | null = null;
              if (desiredValue && choices.find((c: string) => c === desiredValue)) pick = desiredValue;
              else if (choices.length) pick = choices[Math.floor(Math.random() * choices.length)];
              if (pick) {
                await byLabel.selectOption({ label: pick }).catch(() => {});
                console.log(`[NewRequestAction] selected (native) '${pick}' for '${label}'`);
                // optionally wait for child select to update
                if (waitForChildLabel) await waitForChildOptionsChange(waitForChildLabel, timeout);
                return pick;
              }
            }
          }
        } catch (e) { /* ignore and fallback */ }

        try {
          const combo = this.page.getByRole('combobox', { name: label }).first();
          if (await combo.count() > 0) {
            await combo.click();
            // try to find a listbox or role=option elements
            let opts = this.page.getByRole('listbox').first();
            let optionLocator = opts.locator('[role="option"]');
            try { await opts.waitFor({ state: 'visible', timeout: 1000 }); } catch {}
            let texts: string[] = [];
            try {
              const count = await optionLocator.count();
              for (let i = 0; i < count; i++) {
                const t = (await optionLocator.nth(i).innerText()).trim();
                if (t && !/select|elegir|--/i.test(t)) texts.push(t);
              }
            } catch {
              // fallback: global options
              const globalOpts = this.page.locator('[role="option"]');
              const gc = await globalOpts.count();
              for (let i = 0; i < gc; i++) {
                const t = (await globalOpts.nth(i).innerText()).trim();
                if (t && !/select|elegir|--/i.test(t)) texts.push(t);
              }
            }

            if (texts.length === 0) {
              // close dropdown and continue to next label
              await this.page.keyboard.press('Escape').catch(() => {});
            } else {
              // pick desired or random
              let pick: string | null = null;
              if (desiredValue && texts.find(t => t === desiredValue)) pick = desiredValue;
              else pick = texts[Math.floor(Math.random() * texts.length)];
              // click the option
              const optIndex = texts.findIndex(t => t === pick);
              if (optIndex >= 0) {
                await optionLocator.nth(optIndex).click().catch(async () => {
                  // try clicking a global option that has the text
                  await this.page.getByRole('option', { name: pick || '' }).first().click().catch(() => {});
                });
                console.log(`[NewRequestAction] selected (combo) '${pick}' for '${label}'`);
                if (waitForChildLabel) await waitForChildOptionsChange(waitForChildLabel, timeout);
                return pick;
              }
            }
          }
        } catch (e) { /* ignore & try next strategy */ }

        try {
          // last resort: click the label element and look for options
          const labelEl = this.page.locator(`label:has-text("${label}")`).first();
          if (await labelEl.count() > 0) {
            await labelEl.click().catch(() => {});
            const opts = this.page.getByRole('option');
            const c = await opts.count();
            if (c > 0) {
              const texts: string[] = [];
              for (let i = 0; i < c; i++) texts.push((await opts.nth(i).innerText()).trim());
              const pick = desiredValue && texts.find(t => t === desiredValue) ? desiredValue : texts[Math.floor(Math.random() * texts.length)];
              await opts.filter({ hasText: pick || '' }).first().click().catch(() => {});
              console.log(`[NewRequestAction] selected (label fallback) '${pick}' for '${label}'`);
              if (waitForChildLabel) await waitForChildOptionsChange(waitForChildLabel, timeout);
              return pick || null;
            }
          }
        } catch {}
      }

      // if nothing matched within labels
      console.warn(`[NewRequestAction] could not find select for labels: ${labels.join(', ')}`);
      return null;
    };

    // Wait helper: detect when child select/options change after parent selection
    const waitForChildOptionsChange = async (childLabel: string, timeout = 5000) => {
      try {
        const child = this.page.getByLabel(childLabel).first();
        if (await child.count() > 0) {
          const before = await child.locator('option').count().catch(() => 0);
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const after = await child.locator('option').count().catch(() => 0);
            if (after !== before && after > 0) return;
            await this.page.waitForTimeout(200);
          }
        }
      } catch {}
    };

    // Select in order and wait for dependent updates
    const unidadSelected = await selectWithFallback(['Unidad'], mock.unidad, 'Area', 7000);
    const areaSelected = await selectWithFallback(['Area', 'Área'], mock.area, 'Sociedad', 7000);
    const sociedadSelected = await selectWithFallback(['Sociedad'], mock.sociedad, 'Tipo de servicio', 7000);
    const tipoSelected = await selectWithFallback(['Tipo de servicio', 'Tipo de Servicios', 'Tipo de solicitud'], mock.tipoServicios, undefined, 7000);

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

    // Date
    try { const dateInput = this.page.locator('input[type="date"]'); if (await dateInput.count() > 0) await dateInput.first().fill(mock.fecha); } catch {}

    // Upload 3 random files
    const files: string[] = [];
    for (let i = 0; i < 3; i++) files.push(getRandomFixtureFilePath());
    try {
      const fi = this.page.locator('input[type="file"]');
      if (await fi.count() > 0) { try { await fi.first().setInputFiles(files); } catch { for (const f of files) await fi.first().setInputFiles(f); } }
      else { const up = this.page.getByRole('button', { name: /Subir archivo|Adjuntar|Cargar archivo|Upload file/i }); if (await up.count() > 0) { await up.first().click(); const after = this.page.locator('input[type="file"]'); if (await after.count() > 0) await after.first().setInputFiles(files); } }
    } catch {}

    // Submit - try a few button labels
    for (const n of ['Guardar','Crear','Aceptar','Save']) {
      const b = this.page.getByRole('button', { name: n });
      if (await b.count() > 0) { await b.first().click(); break; }
    }

    await expect(this.page.getByText(mock.descripcion)).toBeVisible({ timeout: 30_000 });
    return mock;
  }
}
