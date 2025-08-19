import { BasePage } from "../../config/BasePage";

export class HomePage extends BasePage {
    homeImage = this.page.getByRole('img', { name: 'Volcan Logo' });
    requestList = this.page.getByRole('button', { name: 'Mis Solicitudes' });
    approvals = this.page.getByText('Mis Aprobaciones');
    menuBookIcon = this.page.getByTestId('MenuBookOutlinedIcon');
    notificationBtn = this.page.getByTestId('notificatioBtn');
    showUnreadCheckbox = this.page.getByRole('checkbox', { name: 'Mostrar solo no leídas' });
    showAllCheckbox = this.page.getByRole('checkbox', { name: 'Mostrar solo no leídas' });
    notificationButton = this.page.locator('div').filter({ hasText: /^NotificacionesMostrar solo no leídas$/ }).getByRole('button');
    settingsIcon = this.page.getByTitle('Configuración').getByRole('img');
    bookIcon = this.page.locator('.sc-eJfVlx');
    anotherBookIcon = this.page.locator('.sc-eJfVlx');
    userProfile = this.page.getByTestId('userProfile').getByText('U');
    userEmail = this.page.getByText('Usuario de Aplicacionesadminqa@pormel.net');

};
   