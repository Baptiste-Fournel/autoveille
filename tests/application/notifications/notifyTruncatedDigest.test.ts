import { describe, expect, it } from 'vitest';
import { notifyTruncatedDigest } from '../../../src/application/notifications/notifyTruncatedDigest.js';
import { DEALER_PHONE, ingestWorld } from '../../support/ingestWorld.js';
import { withGarageTelegram } from '../../support/telegramSettings.js';

const MORE_ON_LA_CENTRALE = 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE&customerType=PART';

describe('notification d’un email d’alerte tronqué', () => {
  it('La Centrale annonce 61 véhicules et en montre 3 : une seule notification signale les 58 autres, sur le téléphone et sur Telegram', async () => {
    // Given
    const world = ingestWorld({ settings: withGarageTelegram() });

    // When
    await notifyTruncatedDigest(world.dependencies, { siteLabel: 'La Centrale', announced: 61, received: 3, moreUrl: MORE_ON_LA_CENTRALE });

    // Then
    expect(world.channel.pushes()).toEqual([
      {
        endpoint: DEALER_PHONE.endpoint,
        notification: {
          title: 'La Centrale : 61 nouvelles annonces',
          body: '3 arrivées dans l’application, 58 autres sont à voir sur le site.',
          url: 'https://veille.garage-du-lac.fr/#/sources',
        },
      },
    ]);
    expect(world.channel.telegrams().map((sent) => sent.text)).toEqual([
      `La Centrale : 61 nouvelles annonces\n3 arrivées dans l’application, 58 autres sont à voir sur le site.\n${MORE_ON_LA_CENTRALE}`,
    ]);
  });
});
