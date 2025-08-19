import { Page, Locator, expect } from "@playwright/test";

export class BaseAction {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    protected async verifyIfLocatorIsVisible(locator: Locator){
        await expect(locator).toBeVisible({ timeout: 30_000 });
    }

    protected async verifyIfLocatorIsNotVisible(locator: Locator){
        await expect(locator).toBeHidden({ timeout: 30_000 });
    }

    protected async verifyIfLocatorIsEnabled(locator: Locator){
        await expect(locator).toBeEnabled({ timeout: 30_000 });
    }

    protected async verifyIfLocatorIsNotEnabled(locator: Locator){
        await expect(locator).not.toBeEnabled({ timeout: 30_000 });
    }

    protected async verifyIfLocatorIsChecked(locator: Locator){
        await expect(locator).toBeChecked({ timeout: 30_000 });
    }

    // protected async verifyIfLocatorIsReadyForClick(locator: Locator) {
    //     await expect(locator).toBeVisible({ timeout: 30_000 });
    //     await expect(locator).toBeEnabled({ timeout: 30_000 });
    //     await locator.click({ trial: true });
    // }

    protected async waitForSuccessfulResponseAfterAction(
        urlPart: string,
        action: () => Promise<void>,
        {
            timeout = 30000,
            expectedStatusCodes = [200, 201, 204],
        }: {
            timeout?: number;
            expectedStatusCodes?: number[];
        } = {}
    ): Promise<void> {
        const responses: { url: string; status: number; body?: string }[] = [];

        const responsePromise = this.page.waitForResponse(async (response) => {
            const url = response.url();
            const status = response.status();
            const match = url.includes(urlPart) && expectedStatusCodes.includes(status);

            if (url.includes(urlPart)) {
                const contentType = response.headers()['content-type'] || '';
                let body = '';
                try {
                    if (contentType.includes('application/json')) {
                        body = JSON.stringify(await response.json());
                    } else {
                        body = await response.text();
                    }
                } catch (e) {
                    console.error('Error reading response body:', e);
                    body = '[The body could not be read]';
                }

                responses.push({ url, status, body });
            }

            return match;
        }, { timeout });

        try {
            await action();
        } catch (error) {
            throw new Error(`The triggered action failed before receiving an expected response: ${error}`);
        }

        try {
            await responsePromise;
        } catch (error) {
            console.error('[ERROR] Timeout waiting for expected response.');
            const recentResources = await this.page.evaluate(() =>
                performance.getEntriesByType('resource')
                    .slice(-10)
                    .map((entry: any) =>
                        `${entry.name} - ${entry.initiatorType} - ${entry.responseEnd}`
                    )
            );

            const errorLog = responses.map(r =>
                `→ ${r.url} [${r.status}] Body:\n${r.body}\n`
            ).join('\n');

            console.error(
                `Timeout waiting for response with URL containing "${urlPart}" ` +
                `and status ${expectedStatusCodes.join(', ')}.\n` +
                `Latest responses observed:\n${recentResources.join('\n')}\n\n` +
                `Details of the responses that contained "${urlPart}":\n + "${errorLog}"`
            );
            throw error;
        }
    }

    async waitForAlertText(text: string, timeout = 30000) {
        await this.page.waitForFunction(
            (expectedText) => {
                const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
                return alerts.some(el => el.textContent?.includes(expectedText));
            },
            text,
            { timeout }
        );
    }
    
    // protected async expectVisibleWithDebug(locator: Locator, debugLabel: string) {
    //     try {
    //         await expect(locator).toBeVisible({ timeout: 30_000 });
    //     } catch (error) {
    //         await this.printVisibleContent(debugLabel);
    //         throw error;
    //     }
    // }

    protected async printVisibleContent(debugLabel: string) {
        // Defensive: avoid reading page when closed
        try {
            // `isClosed` may not exist on older Playwright versions, guard it
            // @ts-ignore
            if (typeof this.page.isClosed === 'function' && this.page.isClosed()) {
                console.error(`⚠️ [${debugLabel}] - Page is already closed, cannot capture content`);
                return;
            }
        } catch (err) {
            console.error(`⚠️ [${debugLabel}] - Error checking if page is closed:`, err);
            return;
        }

        try {
            const bodyText = await this.page.locator('body').innerText();
            const buttonTexts = await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
                return buttons
                    .map(btn => btn instanceof HTMLInputElement ? btn.value : (btn as HTMLElement).innerText || '')
                    .filter(text => !!text);
            });

            const visibleContent = `${bodyText}\n[Buttons: ${buttonTexts.join(', ')}]`;
            console.error(`⚠️ [${debugLabel}] - Visible content at failure:\n${visibleContent}`);
        } catch (err) {
            console.error(`⚠️ [${debugLabel}] - Could not capture page content:`, err);
        }
    }
}