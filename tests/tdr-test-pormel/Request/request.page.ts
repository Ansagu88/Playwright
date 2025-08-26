import { BasePage } from "../../config/BasePage";

export class RequestPage extends BasePage {
  // Use a getter so the locator is evaluated at call time and match multiple label variants

  requestList = this.page.getByRole('button', { name: 'Mis Solicitudes' });
  newRequestButton = this.page.getByRole('button', { name: 'Agregar' });
  downloadFormatButton = this.page.getByRole('button', { name: 'Descargar formatos activos' });
  saveButton = this.page.getByRole('button', { name: 'Guardar' });
  cancelButton = this.page.getByRole('button', { name: 'Cancelar' });
  exportButton = this.page.getByRole('button', { name: 'Exportar' });
  filterButton = this.page.locator('xpath=//*[@id="root"]/div/div/main/div/div/div/div/div[1]/div[2]/button[1]');
  volcanButtonHome = this.page.getByRole('img', { name: 'Volcan Logo' });
  searchRequest = this.page.getByRole('textbox', { name: 'Buscar por identificador de' });
  unidadButton = this.page.getByTestId(':rs:');
  areaButton = this.page.getByTestId(':ru:');
  sociedadButton = this.page.getByTestId(':r10:');
  tipoServicioButton = this.page.getByTestId(':r12:');
  
  nextPageButton = this.page.getByTestId('next-page-button');
  firstPageButton = this.page.getByTestId('first-page-button');
  rowsPerPageSelect = this.page.getByTestId('rows-per-page-select').getByText('20');
  menuStatusDiv = this.page.locator('#menu-status div').first();
  applyButton = this.page.getByRole('button', { name: 'Aplicar' });
  clearButton = this.page.getByRole('button', { name: 'Limpiar' });
  datePicker = this.page.getByTestId('datepicker-icon');

}






