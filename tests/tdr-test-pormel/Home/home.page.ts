import { BasePage } from "../../config/BasePage";

export class HomePage extends BasePage {
    homeImage = this.page.locator('//*[@id="root"]/div/div/header/div[1]/div[1]/div[1]/img');
    menuItemHome = this.page.getByTestId('menu-item-Inicio');
}