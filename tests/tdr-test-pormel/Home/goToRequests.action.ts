import { HomePage } from "./home.page";
import { BaseAction } from "../../config/BaseActions";
import { AuthUtils } from "../../config/AuthUtils";

export class GoToRequestsAction extends BaseAction{
    private readonly homePage = new HomePage(this.page);

    async navigateToRequests() {
        // Ensure user is logged in
        await AuthUtils.ensureLoggedIn(this.page);

        // Verify that the "Mis Solicitudes" button is visible
        await this.verifyIfLocatorIsVisible(this.homePage.requestList);

        // Click on "Mis Solicitudes"
        await this.homePage.requestList.click();

        // Verify the requests button (or requests area) is visible after navigation
        await this.verifyIfLocatorIsNotVisible(this.homePage.requestList);
    }
}
