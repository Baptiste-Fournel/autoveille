import { expect, signedInOnThisPhone, test, toast } from './support/dealerPhone.js';
import { DAILY_ROUTINE, originOf } from './worlds.js';

const PORSCHE_LISTING = 'https://www.leboncoin.fr/ad/voitures/2811001234';

const COPIED_MESSAGE = 'navigator.clipboard.readText()';

test.use({ baseURL: originOf(DAILY_ROUTINE) });

test.describe('au quotidien, une annonce traitée de bout en bout', () => {
  test('la Porsche 911 Carrera 4S de Mérignac : le message copié est envoyé sur Leboncoin, « Oui, envoyé » la range dans « Contactées », puis « Le vendeur a répondu » dans « Ont répondu »', async ({
    page,
    context,
  }) => {
    // Given
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signedInOnThisPhone(page);
    await page.goto('/#/annonces');
    const porsche = page.locator('article.listing').filter({ hasText: 'Porsche 911 Carrera 4S' });
    const proposedMessage = await porsche.getByRole('textbox', { name: 'Message à envoyer' }).inputValue();
    const statusTabs = page.locator('.filterbar').first();
    const weekLine = page.locator('.headline .week');
    await expect(weekLine).toHaveText('7 derniers jours : 7 annonces retenues, 1 contactée, 0 réponse.');

    // When
    const leboncoinTab = context.waitForEvent('page');
    await porsche.getByRole('button', { name: 'Ouvrir l’annonce et copier le message' }).click();
    const leboncoin = await leboncoinTab;
    await leboncoin.waitForLoadState();
    const listingOpened = leboncoin.url();
    await leboncoin.close();
    await page.bringToFront();
    const copied = await page.evaluate(COPIED_MESSAGE);
    await porsche.getByRole('button', { name: 'Oui, envoyé' }).click();
    await expect(toast(page)).toContainText('Passée en « contactée »');
    const toHandleAfterSending = await page.locator('article.listing h3').allTextContents();
    await statusTabs.getByRole('button', { name: /^Contactées/ }).click();
    await porsche.getByRole('button', { name: 'Le vendeur a répondu' }).click();
    await expect(toast(page)).toContainText('Noté : le vendeur a répondu');
    await page.reload();
    await statusTabs.getByRole('button', { name: /^Ont répondu/ }).click();

    // Then
    expect(listingOpened).toBe(PORSCHE_LISTING);
    expect(proposedMessage).toContain('911 Carrera 4S');
    expect(copied).toBe(proposedMessage);
    expect(toHandleAfterSending).not.toContain('Porsche 911 Carrera 4S');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ont répondu');
    await expect(weekLine).toHaveText('7 derniers jours : 7 annonces retenues, 2 contactées, 1 réponse.');
    await expect(page.locator('article.listing h3')).toHaveText(['Porsche 911 Carrera 4S']);
  });
});
