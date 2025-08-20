import { LoginPage } from "./login.base";
import { BaseAction } from "../../config/BaseActions";
import { userMock } from "../../fixtures/mocks/user.mock";



export class LoginAction extends BaseAction {
    protected readonly loginPage = new LoginPage(this.page);

    async login() {
        await this.loginPage.goto(userMock.url);

        await this.verifyIfLocatorIsReadyForClick(this.loginPage.identifyMeButton);
        await this.loginPage.identifyMeButton.click();

        await this.loginPage.verifyMicrosoftDomain();
        await this.expectVisibleWithDebug(this.loginPage.signInText, 'sign-in-text-not-visible');

        await this.loginPage.emailInput.fill(userMock.email);
        await this.verifyIfLocatorIsReadyForClick(this.loginPage.nextButton);
        await this.loginPage.nextButton.click();

        await this.loginPage.passwordInput.fill(userMock.password);
        await this.verifyIfLocatorIsReadyForClick(this.loginPage.nextButton);
        await this.loginPage.nextButton.click();

        const emailLocator = await this.loginPage.getLocatorByText(userMock.email);
        const isEmailVisible = await emailLocator.isVisible().catch(() => false);

        const isUsernameBlockedVisible = await this.loginPage.usernameBloked
            .then(locator => locator.isVisible().catch(() => false))
            .catch(() => false);

        if (isEmailVisible && !isUsernameBlockedVisible) {
            const enterPasswordVisible = await this.loginPage.enterPasswordText
                .then(locator => locator.isVisible().catch(() => false))
                .catch(() => false);

            if (enterPasswordVisible) {
                await this.loginPage.passwordInput.fill(userMock.password);
                await this.verifyIfLocatorIsReadyForClick(this.loginPage.nextButton);
                await this.loginPage.nextButton.click();
            }
        }

        try {
            const staySignedInPrompt = this.page.getByText("Stay signed in?");
            await staySignedInPrompt.waitFor({ state: "visible", timeout: 10_000 });

            const yesButton = this.loginPage.yesButton;
            await yesButton.waitFor({ state: "visible", timeout: 10_000 });
            await this.verifyIfLocatorIsReadyForClick(yesButton);
            await yesButton.click();

        } catch (e) {
            console.warn("⚠️ Prompt 'Stay signed in?' no apareció o fue salteado.", e);
            await this.printVisibleContent('staySignedIn-not-visible');        
        }

        // await this.expectVisibleWithDebug(await this.loginPage.usernameText, 'username-not-visible');
    }
}