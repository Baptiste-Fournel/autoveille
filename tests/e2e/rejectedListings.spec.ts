import { expect, signedInOnThisPhone, test, toast } from './support/dealerPhone.js';
import { originOf, REJECTED_LISTINGS } from './worlds.js';

test.use({ baseURL: originOf(REJECTED_LISTINGS) });

test.describe('écartées par les filtres', () => {
  test('la BMW M3 E46 écartée pour ses 128 000 km, retrouvée dans le groupe « Trop de km », est gardée quand même et rejoint les annonces à traiter', async ({
    page,
  }) => {
    // Given
    await signedInOnThisPhone(page);
    await page.goto('/#/annonces');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('6 annonces à traiter');
    const statusTabs = page.locator('.filterbar').first();
    const bmw = page.locator('article.listing').filter({ hasText: 'BMW M3 E46' });

    // When
    await statusTabs.getByRole('button', { name: /^Écartées par les filtres/ }).click();
    await page
      .locator('.kinds')
      .getByRole('button', { name: /^Trop de km/ })
      .click();
    const reason = await bmw.locator('ul.reasons').textContent();
    await bmw.getByRole('button', { name: 'Garder quand même' }).click();
    await expect(toast(page)).toContainText('Annonce gardée');
    const rejectedForMileageAfterward = await page.locator('article.listing h3').allTextContents();
    await statusTabs.getByRole('button', { name: /^À traiter/ }).click();

    // Then
    expect(reason).toBe('128 000 km, au-dessus de 100 000 km');
    expect(rejectedForMileageAfterward).toEqual([]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('7 annonces à traiter');
    await expect(bmw.getByRole('button', { name: 'Ouvrir l’annonce et copier le message' })).toBeVisible();
  });
});
