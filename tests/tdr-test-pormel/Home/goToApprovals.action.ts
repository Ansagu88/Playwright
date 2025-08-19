import { HomePage } from "./home.page";
import { BaseAction } from "../../config/BaseActions";
import { AuthUtils } from "../../config/AuthUtils";

export class GoToApprovalsAction extends BaseAction{
    private readonly homePage = new HomePage(this.page);

    async navigateToApprovals() {
        // Ensure user is logged in
        await AuthUtils.ensureLoggedIn(this.page);

        // Verify that the "Mis Aprobaciones" element is visible
        await this.verifyIfLocatorIsVisible(this.homePage.approvals);

        // Click on "Mis Aprobaciones"
        await this.homePage.approvals.click();

        // Verify that approvals area is visible after navigation
        await this.verifyIfLocatorIsVisible(this.homePage.approvals);
    }
}
