import { test } from '@playwright/test';
import { GoToHomeAction } from "./goToHome.action";

test('go to home test', async ({ page }) => {
    const goToHomeAction = new GoToHomeAction(page);
    await goToHomeAction.navigateToHome()
});