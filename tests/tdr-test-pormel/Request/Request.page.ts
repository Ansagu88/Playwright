import { BasePage } from "../../config/BasePage";
import { getRandomFixtureFilePath } from "../../config/FileUtils";

export class RequestPage extends BasePage {
    // Use a getter so the locator is evaluated at call time and match multiple label variants
    
    requestList = this.page.getByRole('button', { name: 'Mis Solicitudes' });
    newRequestButton = this.page.getByRole('button', { name: 'Agregar' });
    downloadFormatButton = this.page.getByRole('button', { name: 'Descargar formatos activos' });
    exportButton = this.page.getByRole('button', { name: 'Exportar' });
    filterButton = this.page.locator('xpath=//*[@id="root"]/div/div/main/div/div/div/div/div[1]/div[2]/button[1]');
    volcanButtonHome = this.page.getByRole('img', { name: 'Volcan Logo' });
    searchRequest = this.page.getByRole('textbox', { name: 'Buscar por identificador de' });
    nextPageButton = this.page.getByTestId('next-page-button');
    firstPageButton = this.page.getByTestId('first-page-button');
    rowsPerPageSelect = this.page.getByTestId('rows-per-page-select').getByText('20');
    menuStatusDiv = this.page.locator('#menu-status div').first();
    applyButton = this.page.getByRole('button', { name: 'Aplicar' });
    clearButton = this.page.getByRole('button', { name: 'Limpiar' });
    datePicker = this.page.getByTestId('datepicker-icon');

    /**
     * Crea una nueva solicitud y sube un archivo aleatorio desde fixtures/files.
     * Este método es un ejemplo de uso de `getRandomFixtureFilePath()`.
     */
    async createNewRequestWithRandomFile(): Promise<string> {
        await this.page.getByRole('button', { name: 'Agregar' }).click();
        // seleccionar comboboxs, etc. (ajusta según tu flujo real)
        await this.page.getByRole('combobox', { name: 'Tipo de archivo' }).click();
        await this.page.getByRole('button', { name: 'Guardar' }).click();

        const filePath = getRandomFixtureFilePath();
        // intenta subir usando el mismo locator que tenías
        const uploadButton = this.page.getByRole('button', { name: 'Subir archivo' });
        try {
            await uploadButton.setInputFiles(filePath);
        } catch (e) {
            // fallback: busca input[type=file]
            const input = this.page.locator('input[type="file"]');
            if (await input.count() > 0) {
                await input.first().setInputFiles(filePath);
            } else {
                throw e;
            }
        }

        // completar selección de tipo TDR y cerrar
        await this.page.getByRole('combobox', { name: 'Tipo de archivo TDR' }).click();
        await this.page.getByRole('button', { name: 'Cancelar' }).click();

        return filePath.split(/[/\\]/).pop() || filePath;
    }
    
    
    async goto(url: string): Promise<void> {
        await super.goto(url);
    }
    
    async verifyMicrosoftDomain(): Promise<void> {
        await this.page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15_000 });
    }
}





