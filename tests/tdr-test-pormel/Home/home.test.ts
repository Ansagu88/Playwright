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

test('navigate test', async ({ page }) => {
  
  const goToHomeAction = new GoToHomeAction(page);
  const goToRequestsAction = new GoToRequestsAction(page);
  const goToApprovalsAction = new GoToApprovalsAction(page);
  const goToLibraryAction = new GoToLibraryAction(page);

  await goToRequestsAction.navigateToRequests();
  await goToHomeAction.navigateToHome();

  await goToApprovalsAction.navigateToApprovals();
  await goToHomeAction.navigateToHome();
  
  await goToLibraryAction.navigateToLibrary();
  await goToHomeAction.navigateToHome();
  
  await page.waitForTimeout(10000);


});