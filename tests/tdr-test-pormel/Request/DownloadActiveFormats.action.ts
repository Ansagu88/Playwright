import { BaseAction } from "../../config/BaseActions";
import { expect } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import { GoToRequestsAction } from '../Home/goToRequests.action';
import { RequestPage } from './Request.page';

export class DownloadActiveFormatsAction extends BaseAction {

    /**
     * Navigate to Requests, trigger the download of active formats and
     * verify the downloaded file is a ZIP. Returns the saved path.
     */
    async downloadActiveFormats(): Promise<string> {
        // 1) Navigate to Requests using the existing action
        const goToRequests = new GoToRequestsAction(this.page);
        await goToRequests.navigateToRequests();

        // 2) Instantiate the Request page object
        const requestPage = new RequestPage(this.page);

        // 3) Prepare temporary directory to save the download
        const tmpDir = path.join(process.cwd(), 'tmp');
        await fs.mkdir(tmpDir, { recursive: true });

        // 4) Wait for the download to start when clicking the button
        const [download] = await Promise.all([
            this.page.waitForEvent('download'),
            requestPage.downloadFormatButton.click(),
        ]);

        // 5) Verify suggested filename ends with .zip (if provided)
        const suggested = download.suggestedFilename();
        if (suggested) {
            expect(suggested).toMatch(/\.zip$/i);
        }

        // 6) Save the file and validate ZIP magic bytes (PK\x03\x04)
        const filename = suggested || `download-${Date.now()}.zip`;
        const savePath = path.join(tmpDir, filename);
        await download.saveAs(savePath);

        const buffer = await fs.readFile(savePath);
        const signature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
        const fileHeader = buffer.slice(0, 4);
        if (!fileHeader.equals(signature)) {
            // cleanup a bit before throwing
            try { await fs.unlink(savePath); } catch (e) { /* ignore */ }
            throw new Error('Downloaded file does not have ZIP signature');
        }

        // 7) Return path of the saved file (caller/test may remove it)
        return savePath;
    }
}
