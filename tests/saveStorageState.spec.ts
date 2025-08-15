import { test } from '@playwright/test';

test('Guardar estado de sesión', async ({ page }) => {
  // Navegar a la página de inicio de sesión
  await page.goto('https://axis-core-container.dev.volcan.pormel.tech');

  // Hacer clic en el botón "Iniciar sesión con Microsoft"
  await page.click('button:has-text("Iniciar sesión con Microsoft")');

  // Ingresar el email y presionar siguiente
  await page.fill('input[type="email"]', 'user1qa@pormel.net');
  await page.click('#idSIButton9');

  // Ingresar la contraseña y presionar iniciar sesión
  await page.fill('input[type="password"]', 'D.682573544766uq');
  await page.click('#idSIButton9');

  // Guardar el estado de la sesión en un archivo JSON
  await page.context().storageState({ path: 'storageState.json' });
});