import { alertEmail } from './dealerInbox.js';
import { loadFixture } from './fixtures.js';
import type { StoredImapMessage } from './simulatedImapClient.js';

export const PORSCHE_911_ON_LEBONCOIN = 'https://www.leboncoin.fr/ad/voitures/2811001234';

export const AUDI_RS6_ON_LEBONCOIN = 'https://www.leboncoin.fr/ad/voitures/2811005678';

export const BMW_M3_ON_LEBONCOIN = 'https://www.leboncoin.fr/ad/voitures/2811009999';

const PORSCHE_PRICE_IN_THE_FIRST_ALERT = '89 900 €';

export interface PorscheGirondeAlert {
  readonly uid: number;
  readonly receivedAt: string;
  readonly porschePrice?: string;
}

export const porscheGirondeAlert = ({ uid, receivedAt, porschePrice }: PorscheGirondeAlert): StoredImapMessage =>
  alertEmail({
    uid,
    from: 'leboncoin <no-reply@leboncoin.fr>',
    subject: '3 nouvelles annonces correspondent à votre recherche « Porsche Gironde »',
    receivedAt,
    messageId: `<alerte-porsche-gironde-${uid}@leboncoin.fr>`,
    html: loadFixture('emails/leboncoin/trois-annonces-en-tableau.html').replace(
      PORSCHE_PRICE_IN_THE_FIRST_ALERT,
      porschePrice ?? PORSCHE_PRICE_IN_THE_FIRST_ALERT,
    ),
  });
