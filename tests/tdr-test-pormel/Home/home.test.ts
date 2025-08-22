import { test } from '@playwright/test';
import { GoToHomeAction } from "./goToHome.action";
import { GoToRequestsAction } from './goToRequests.action';
import { GoToApprovalsAction } from './goToApprovals.action';
import {GoToLibraryAction} from './goToLibrary.action';


test('go to home test', async ({ page }) => {
    const goToHomeAction = new GoToHomeAction(page);
    await goToHomeAction.navigateToHome()
});

test('go to requests test', async ({ page }) => {
  const goToRequests = new GoToRequestsAction(page);
  await goToRequests.navigateToRequests();
  await page.waitForTimeout(5000); // espera 5 segundos en la página de requests
  const goToHomeAction = new GoToHomeAction(page);
  await goToHomeAction.navigateToHome()

});

test('go to approval test', async ({ page }) => {
  const goToApproval = new GoToApprovalsAction(page);
  await goToApproval.navigateToApprovals();
  await page.waitForTimeout(5000); // espera 5 segundos en la página de approval
});

test('go to library test', async ({ page }) => {
  const goToLibrary = new GoToLibraryAction(page);
  await goToLibrary.navigateToLibrary();
  await page.waitForTimeout(5000); // espera 5 segundos en la página de library
});
