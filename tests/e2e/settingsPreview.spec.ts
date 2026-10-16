import { expect, signedInOnThisPhone, test } from './support/dealerPhone.js';
import { originOf, SETTINGS_PREVIEW } from './worlds.js';

test.use({ baseURL: originOf(SETTINGS_PREVIEW) });

test.describe('réglages', () => {
  test('ramener le rayon autour de Bordeaux de 100 km au minimum, 25 km, fait passer le compteur de 7 à 4 annonces sur 7 jours avant même d’enregistrer : Libourne, Langon et Arcachon sortent du rayon', async ({
    page,
    traffic,
  }) => {
    // Given
    await signedInOnThisPhone(page);
    await page.goto('/#/reglages');
    const counter = page.locator('#preview-count b');
    await expect(counter).toHaveText('7 annonces sur 7 jours');
    const radius = page.getByRole('slider', { name: 'Rayon autour de la ville' });

    // When
    await radius.press('Home');

    // Then
    await expect(page.getByText('25 km', { exact: true })).toBeVisible();
    await expect(counter).toHaveText('4 annonces sur 7 jours');
    await expect(page.locator('#preview-count span')).toHaveText('avec ces réglages, sur 10 annonces reçues');
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
    expect(
      traffic
        .requested()
        .filter(({ url }) => url.pathname === '/api/settings')
        .map(({ method }) => method),
    ).toEqual(['GET']);
  });
});
