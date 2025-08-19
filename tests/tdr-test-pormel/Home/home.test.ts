import { test } from '@playwright/test';
import { GoToHomeAction } from "./goToHome.action";
import { GoToRequestsAction } from './goToRequests.action';


test('go to home test', async ({ page }) => {
    const goToHomeAction = new GoToHomeAction(page);
    await goToHomeAction.navigateToHome()
});

test('go to requests test', async ({ page }) => {
  const goToRequests = new GoToRequestsAction(page);
  await goToRequests.navigateToRequests();
  const goToHomeAction = new GoToHomeAction(page);
  await goToHomeAction.navigateToHome();
});