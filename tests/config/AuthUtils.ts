import { userMock } from "../fixtures/mocks/user.mock";
import { Page } from "@playwright/test";
import { LoginAction } from "../tdr-test-pormel/Login/login.actions";

export class AuthUtils {
  static async ensureLoggedIn(page: Page) {
    await page.goto(userMock.url);

    // Quick check: if there is an auth/session cookie in the context, assume logged in
    try {
      const cookies = await page.context().cookies();
      const hasAuthCookie = cookies.some(c => c.name.includes('auth') || c.name.includes('session'));
      if (hasAuthCookie) {
        console.log('✅ Auth cookie present; assuming logged in.');
        return;
      }
    } catch (err) {
      console.warn('⚠️ Could not read cookies for quick auth check:', err);
      
    }

    // If we reached here, no auth cookie was found. Perform the login flow directly.
    try {
      console.log('ℹ️ No auth cookie detected; running login flow.');
      const loginAction = new LoginAction(page);
      await loginAction.login();
    } catch (error) {
      console.error("❌ Error while attempting login fallback:", error);
      throw error;
    }
  }
}