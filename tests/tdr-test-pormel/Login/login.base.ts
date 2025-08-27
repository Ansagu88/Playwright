import { userMock } from "../../fixtures/mocks/user.mock";
import { BasePage } from "../../config/BasePage";

export class LoginPage extends BasePage {
    // Use a getter so the locator is evaluated at call time and match multiple label variants
    get identifyMeButton() {
        return this.page.getByRole('button', { name: /Identificarme|Iniciar sesión|Sign in with Microsoft|Microsoft/i });
    }
    signInText = this.page.locator('#loginHeader');
    stateSignInText = this.page.locator('[data-bind="text: str[\'STR_Kmsi_Title\']"]'); 
    emailInput = this.page.locator('#i0116'); 
    passwordInput = this.page.locator('#i0118');
    nextButton = this.page.locator('#idSIButton9');
    yesButton = this.page.locator('input#idSIButton9');
    usernameText = this.getLocatorByText(userMock.name);
    usernameBloked = this.getLocatorByText("Your sign-in was blocked");
    enterPasswordText = this.getLocatorByText('Enter password');

    async goto(url: string): Promise<void> {
        await super.goto(url);
    }

    async verifyMicrosoftDomain(): Promise<void> {
        await this.page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15_000 });
    }
}