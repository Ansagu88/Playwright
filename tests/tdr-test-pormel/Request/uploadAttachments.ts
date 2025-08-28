import { Page } from '@playwright/test';
import { getRandomFixtureFilePath } from '../../config/FileUtils';

export interface AttachmentResult { tipo: string; file: string; success: boolean }
export interface UploadAttachmentsResult { summary: AttachmentResult[]; missingRequired: string[] }
export interface UploadAttachmentsOptions {
  requiredTypes?: string[]; optionalTypes?: string[]; includeOptional?: boolean;
  throwOnMissingRequired?: boolean; pauseBetween?: number; saveDebug?: (n:string)=>any;
  customFileProvider?: ()=>string; maxOpenModalWaitMs?: number;
}

// Helpers mínimos internos
const isVisible = async (loc: ReturnType<Page['locator']>) => (await loc.count())>0 && await loc.first().isVisible().catch(()=>false);
const waitEnabled = async (btn: any, timeout=3500) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const ok = await btn.first()
      .evaluate((el:HTMLElement)=>!(el as HTMLButtonElement).disabled && !el.getAttribute('aria-disabled'))
      .catch(()=>false);
    if (ok) return true;
    await btn.page().waitForTimeout(110);
  }
  return false;
};

export async function uploadAttachments(page: Page, opt?: UploadAttachmentsOptions | ((n:string)=>any)): Promise<UploadAttachmentsResult> {
  const opts: UploadAttachmentsOptions = typeof opt === 'function' ? { saveDebug: opt } : (opt||{});
  const required = opts.requiredTypes ?? ['TDR','BASES','ANEXO'];
  const optional = opts.optionalTypes ?? ['OTROS'];
  const planned = (opts.includeOptional ?? false) ? [...required, ...optional] : [...required];
  const pause = opts.pauseBetween ?? 200;
  const saveDebug = opts.saveDebug; const fileOf = opts.customFileProvider ?? getRandomFixtureFilePath;
  const maxWait = opts.maxOpenModalWaitMs ?? 2000; const throwOnMissing = opts.throwOnMissingRequired ?? true;
  const summary: AttachmentResult[] = [];

  const buttons = [
    page.getByRole('button', { name: /Agregar archivo|Adjuntar archivo|Añadir archivo/i }).first(),
    page.getByRole('button', { name: /^Agregar$/ }).nth(1),
    page.getByRole('button', { name: /^Agregar$/ }).last()
  ];

  const openModal = async () => {
    for (const b of buttons) {
      if (!await isVisible(b)) continue;
      await b.first().click().catch(()=>{});
      const combo = page.locator('div[role="combobox"]').last();
      try {
        await combo.waitFor({ state:'visible', timeout: maxWait });
        return true;
      } catch {}
    }
    return false;
  };

  const pickType = async (tipo: string) => {
    const combo = page.locator('div[role="combobox"]').last();
    if (await combo.count()===0) return false;
    await combo.click({ force:true }).catch(()=>{});
    const optExact = page.getByRole('option',{ name: new RegExp(`^${tipo}$`,'i') });
    try {
      await optExact.first().waitFor({ state:'visible', timeout:1500 });
      await optExact.first().click().catch(()=>{});
      return true;
    } catch {}
    const txt = page.getByText(new RegExp(`^${tipo}$`,'i')).last();
    if (await txt.count()>0) {
      await txt.click().catch(()=>{});
      return true;
    }
    return false;
  };

  const uploadFile = async (filePath: string) => {
    const input = page.locator('label:has-text("Subir archivo") input[type="file"]').last();
    if (await input.count()===0) return false;
    try {
      await input.setInputFiles(filePath);
      return true;
    } catch { return false; }
  };

  const saveModal = async () => {
    const btn = page.getByRole('button', { name:/^Guardar$/ }).last();
    if (await btn.count()===0) return false;
    await waitEnabled(btn);
    await btn.first().click().catch(()=>{});
    try { await page.locator('label:has-text("Subir archivo") input[type="file"]').last().waitFor({ state:'detached', timeout:2500 }); } catch {}
    return true;
  };

  const process = async (tipo: string) => {
    const file = fileOf();
    const record = (success:boolean)=> summary.push({ tipo, file, success });
    if (!await openModal()) { record(false); return; }
    if (!await pickType(tipo)) { await saveDebug?.(`tipo-no-seleccionado-${tipo}`); record(false); await page.keyboard.press('Escape').catch(()=>{}); return; }
    if (!await uploadFile(file)) { await saveDebug?.(`subida-fallida-${tipo}`); record(false); await page.keyboard.press('Escape').catch(()=>{}); return; }
    const saved = await saveModal();
    if (!saved) await saveDebug?.(`adjunto-no-guardado-${tipo}`);
    record(saved);
    if (pause>0) await page.waitForTimeout(pause);
  };
  for (const tipo of planned) await process(tipo);

  const missingRequired = required.filter(r => !summary.find(a=>a.tipo===r && a.success));
  if (missingRequired.length) { await saveDebug?.('adjuntos-requeridos-faltantes'); if (throwOnMissing) throw new Error(`Faltan adjuntar tipos requeridos: ${missingRequired.join(', ')}`); }
  return { summary, missingRequired };
}
