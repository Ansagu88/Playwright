import { userMock } from "../fixtures/mocks/user.mock";
import { Page } from "@playwright/test";
import { LoginAction } from "../tdr-test-pormel/Login/login.actions";

export class AuthUtils {
  static async ensureLoggedIn(page: Page) {
    await page.goto(userMock.url);

    try {
      const menu = page.getByText('Términos de referencia');
      const isLoggedIn = await menu.isVisible();

      if (!isLoggedIn) {
        const loginAction = new LoginAction(page);
        await loginAction.login();
      } else {
        console.log("✅ User is already logged in.");
      }
    } catch (error) {
      console.error("❌ Error checking login status:", error);
      console.log("🔁 Attempting to login as fallback...");
      const loginAction = new LoginAction(page);
      await loginAction.login();
    }
  }
}