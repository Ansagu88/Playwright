import { Page } from '@playwright/test';
import { getRandomFixtureFilePath, getRandomFixtureFileName } from '../../config/FileUtils';

/**
 * Acción de ejemplo: abre el diálogo de nueva solicitud y sube un archivo aleatorio
 */
export async function uploadRandomFixtureFile(page: Page) {
	// Ejemplo: asumimos que el botón 'Agregar' ya fue clickeado por el test y el input está visible
	const filePath = getRandomFixtureFilePath();
	const fileName = getRandomFixtureFileName();

	// Localiza el input/file chooser. En tu app actual usas un botón con rol 'button' y luego setInputFiles
	// Aquí usamos el mismo selector que aparece en Request.page.ts (botón con nombre 'Subir archivo')
	const uploadButton = page.getByRole('button', { name: 'Subir archivo' });

	// Si el botón es realmente un <input type="file"> no necesitarás click, pero muchas apps usan botón que
	// abre un input oculto. Playwright permite setInputFiles sobre el elemento que es input o sobre el locator que apunta al input.
	// Intentamos setInputFiles directamente sobre el botón/locator; si falla, busca un input[type=file] dentro del DOM.
	try {
		await uploadButton.setInputFiles(filePath);
		console.log(`Archivo subido: ${fileName}`);
		return fileName;
	} catch (e) {
		// fallback: busca un input[type=file]
		const input = page.locator('input[type="file"]');
		if (await input.count() > 0) {
			await input.first().setInputFiles(filePath);
			console.log(`Archivo subido (fallback): ${fileName}`);
			return fileName;
		}
		throw e;
	}
}

