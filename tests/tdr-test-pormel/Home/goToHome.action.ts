import { HomePage } from "./home.page";
import { BaseAction } from "../../config/BaseActions";
import { AuthUtils } from "../../config/AuthUtils";

export class GoToHomeAction extends BaseAction{
    private readonly homePage = new HomePage(this.page);

    async navigateToHome() {
        // First we need to login to be able to go to home
        await AuthUtils.ensureLoggedIn(this.page);

        //Verify that the "Inicio" menu's is visible
        await this.verifyIfLocatorIsVisible(this.homePage.homeImage);

        //Click in "Inicio"
        await this.homePage.homeImage.click();

        //Verify that the "Inicio" image is visible
        // await this.verifyIfLocatorIsVisible(this.homePage.homeImage);
        await this.page.waitForTimeout(10000);
    }
}