import { test, expect } from '@playwright/test';



test.describe('Home Page Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navegar directamente al home ya que la sesión está almacenada
    await page.goto('https://axis-core-container.dev.volcan.pormel.tech');
    console.log('URL actual:', page.url());

  });

  test('Verificar título "Términos de referencia"', async ({ page }, testInfo) => {
    // Aumentar timeout de la prueba (60s)
    test.setTimeout(60000);

    // Navegar y asegurar estado de red idle
    await page.goto('https://axis-core-container.dev.volcan.pormel.tech/home');
    await page.waitForLoadState('networkidle');

    // Log URL por si redirige a login
    console.log('URL actual:', page.url());

    // Si la URL no contiene /home, guardar evidencia y fallar con mensaje claro
    if (!page.url().includes('/home')) {
      console.error('No se alcanzó /home, URL final:', page.url());
      await page.screenshot({ path: `tmp/url-mismatch-${Date.now()}.png`, fullPage: true });
      const html = await page.content();
      require('fs').writeFileSync(`tmp/url-mismatch-${Date.now()}.html`, html);
      throw new Error(`La prueba esperaba /home pero la URL final fue: ${page.url()}`);
    }

    // Use a robust selector that waits for the H1 with the visible text. Increase timeout.
    await page.waitForSelector('h1:has-text("Términos de referencia")', { state: 'visible', timeout: 45000 });
    const titulo = page.locator('h1:has-text("Términos de referencia")');
    console.log('Buscando título en la página...');

    try {
      await expect(titulo).toBeVisible({ timeout: 45000 });
      console.log('Título verificado OK');
    } catch (e) {
      console.error('No se encontró el título tras esperar, guardando evidencia...');
      await page.screenshot({ path: `tmp/fail-${Date.now()}.png`, fullPage: true });
      const html = await page.content();
      require('fs').writeFileSync(`tmp/fail-${Date.now()}.html`, html);
      throw e;
    }
  });

});