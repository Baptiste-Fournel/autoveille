import { SETUP_CODE } from '../support/authentication.js';
import { DEALER_MAILBOX } from '../support/dealerMailbox.js';
import { expect, test, toast } from './support/dealerPhone.js';
import { FIRST_VISIT, originOf } from './worlds.js';

const NEW_PASSWORD = 'veille-concession-2026';

const SELF_HOSTED_FIGTREE = /^\/assets\/figtree-[\w-]+\.woff2$/;

const LOADED_FONT_FAMILIES =
  "document.fonts.ready.then((fonts) => [...fonts].filter((font) => font.status === 'loaded').map((font) => font.family))";

const SERVICE_WORKER_ACTIVE = 'navigator.serviceWorker.ready.then((registration) => registration.active !== null)';

const APPLICATION_BUNDLE = /\/assets\/index-[\w-]+\.js$/;

const DARK_PAPER = 'rgb(21, 23, 26)';

const PAGE_PARSED_AND_STYLED = `document.readyState !== 'loading' && getComputedStyle(document.body).backgroundColor === '${DARK_PAPER}'`;

const BEFORE_THE_APPLICATION_STARTS =
  "({ theme: document.documentElement.getAttribute('data-theme'), started: document.getElementById('app')?.childElementCount !== 0 })";

interface Gate {
  readonly passed: Promise<void>;
  readonly open: () => void;
}

const closedGate = (): Gate => {
  let open = (): void => undefined;
  const passed = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { passed, open: () => open() };
};

test.use({ baseURL: originOf(FIRST_VISIT) });

test.describe('mise en route, une seule fois', () => {
  test('un téléphone réglé en clair, où le concessionnaire a choisi le thème sombre : la page est déjà sombre avant même que l’application ne démarre', async ({
    page,
  }) => {
    // Given
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => window.localStorage.setItem('av_theme', 'dark'));
    const slowNetwork = closedGate();
    await page.route(APPLICATION_BUNDLE, async (route) => {
      await slowNetwork.passed;
      await route.continue();
    });

    // When
    await page.goto('/', { waitUntil: 'commit' });
    await expect.poll(() => page.evaluate(PAGE_PARSED_AND_STYLED)).toBe(true);
    const beforeTheApplication = await page.evaluate(BEFORE_THE_APPLICATION_STARTS);
    slowNetwork.open();

    // Then
    expect(beforeTheApplication).toEqual({ theme: 'dark', started: false });
    await expect(page.getByRole('button', { name: 'Commencer' })).toBeVisible();
    await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', '#15171A');
  });

  test('ajoutée à l’écran d’accueil, l’application s’ouvre même sans réseau : la page, ses styles et sa police viennent du service worker', async ({
    page,
    context,
  }) => {
    // Given
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Commencer' })).toBeVisible();
    expect(await page.evaluate(SERVICE_WORKER_ACTIVE)).toBe(true);
    await context.setOffline(true);

    // When
    const reopened = await page.reload();

    // Then
    expect(reopened?.fromServiceWorker()).toBe(true);
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    expect(await page.evaluate(LOADED_FONT_FAMILIES)).toContain('Figtree');
  });

  test('le concessionnaire saisit le code donné à l’installation et choisit son mot de passe, puis la carte Mise en route coche son nom et la boîte mail des alertes', async ({
    page,
    traffic,
  }) => {
    // Given
    await page.goto('/');
    const tabs = page.locator('nav.tabbar');

    // When
    await page.getByLabel('Code de première connexion').fill(SETUP_CODE);
    await page.getByLabel('Nouveau mot de passe (8 caractères minimum)').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Commencer' }).click();
    const setupCard = page.locator('section.setup');
    await expect(setupCard.getByRole('heading', { name: 'Mise en route 0/4' })).toBeVisible();
    await setupCard.getByRole('link', { name: 'Réglages' }).click();
    await page.getByRole('textbox', { name: 'Prénom' }).fill('Camille');
    await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Durand');
    await page.getByRole('textbox', { name: 'Téléphone' }).fill('06 39 98 12 34');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(toast(page)).toHaveText('Réglages enregistrés');
    await tabs.getByRole('link', { name: 'Sites' }).click();
    await page.getByLabel('Adresse Gmail dédiée').fill(DEALER_MAILBOX.user);
    await page.getByLabel('Mot de passe d’application').fill(DEALER_MAILBOX.pass);
    await page.getByRole('button', { name: 'Tester la connexion' }).click();
    await expect(page.getByText('Connexion réussie, 0 email(s) dans la boîte.')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(toast(page)).toHaveText('Boîte mail enregistrée');
    await tabs.getByRole('link', { name: 'Annonces' }).click();

    // Then
    await expect(setupCard.getByRole('heading', { name: 'Mise en route 2/4' })).toBeVisible();
    await expect(setupCard.locator('li.done')).toHaveText(['Votre nom et votre téléphone', 'La boîte mail des alertes']);
    await expect(setupCard.locator('li:not(.done) .label')).toHaveText([
      'Les alertes sur les sites (0/4)',
      'Les notifications sur cet appareil',
    ]);
    const fontsLoaded = traffic.requested().filter(({ url }) => SELF_HOSTED_FIGTREE.test(url.pathname));
    expect(fontsLoaded.map(({ url }) => url.origin)).toContain(originOf(FIRST_VISIT));
  });
});
