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
  await page.waitForTimeout(5000); // espera 5 segundos en la página de requests
  const goToHomeAction = new GoToHomeAction(page);
  await goToHomeAction.navigateToHome();
  await page.waitForTimeout(5000); // espera 5 segundos en home antes de volver a solicitudes
  await goToRequests.navigateToRequests();
  await page.waitForTimeout(5000); // espera 5 segundos en la página de requests
  await goToHomeAction.navigateToHome();
  await page.waitForTimeout(5000); // espera 5 segundos en la página de home
});