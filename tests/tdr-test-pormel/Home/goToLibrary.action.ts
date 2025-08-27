import { HomePage } from "./home.page";
import { BaseAction } from "../../config/BaseActions";
import { AuthUtils } from "../../config/AuthUtils";

export class GoToLibraryAction extends BaseAction{
    private readonly homePage = new HomePage(this.page);

    async navigateToLibrary() {
        // Ensure user is logged in
        await AuthUtils.ensureLoggedIn(this.page);

        // Verify that the library/menu book icon is visible
        await this.verifyIfLocatorIsVisible(this.homePage.menuBookIcon);

        // Click on library/book icon
        await this.homePage.menuBookIcon.click();

        // Verify that the library/book icon is visible (or library area is loaded)
        await this.verifyIfLocatorIsNotVisible(this.homePage.menuBookIcon);
    }
}
