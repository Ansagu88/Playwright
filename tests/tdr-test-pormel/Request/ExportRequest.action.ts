import { BaseAction } from "../../config/BaseActions";
import path from 'path';
import fs from 'fs/promises';
import { GoToRequestsAction } from '../Home/goToRequests.action';
import { RequestPage } from './request.page';

export class ExportRequestAction extends BaseAction {

  /**
   * Navigate to Requests, trigger the export and verify the downloaded file is Excel (.xlsx or .xls).
   * Returns the saved path.
   */
  async exportRequests(): Promise<string> {
    const goToRequests = new GoToRequestsAction(this.page);
    await goToRequests.navigateToRequests();

    const requestPage = new RequestPage(this.page);

    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      requestPage.exportButton.click(),
    ]);

    const suggested = download.suggestedFilename();
    if (suggested) {
      // Accept .xls or .xlsx
      if (!suggested.match(/\.xls(x)?$/i)) {
        // continue, we'll validate by header too
      }
    }

    const filename = suggested || `export-${Date.now()}.xlsx`;
    const savePath = path.join(tmpDir, filename);
    await download.saveAs(savePath);

    const buffer = await fs.readFile(savePath);
    const header = buffer.slice(0, 4);

    const xlsxSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK.. (ZIP container for .xlsx)
    const xlsSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0]); // old BIFF compound file

    const isXlsx = header.equals(xlsxSignature);
    const isXls = header.equals(xlsSignature);

    if (!isXlsx && !isXls) {
      try { await fs.unlink(savePath); } catch (e) { /* ignore */ }
      throw new Error(`Exported file is not a recognized Excel file. Header: ${header.toString('hex')}`);
    }

    return savePath;
  }

}
