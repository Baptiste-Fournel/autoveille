import type { EmailMessage, VisibleContent } from '../../src/application/ports/listingExtractor.js';
import type { MailboxUnavailable } from '../../src/application/ports/mailboxUnavailable.js';
import type { PollMailboxDependencies } from '../../src/application/sources/pollMailbox.js';
import type { Settings } from '../../src/domain/settings/types.js';
import { type FakeClock, fakeClock } from '../fakes/fakeClock.js';
import { fakeGeocoder } from '../fakes/fakeGeocoder.js';
import { type FakeListingExtractor, fakeListingExtractor, type PreparedReading } from '../fakes/fakeListingExtractor.js';
import { type FakeLogger, fakeLogger } from '../fakes/fakeLogger.js';
import { type FakeMailboxReader, fakeMailboxReader } from '../fakes/fakeMailboxReader.js';
import { type FakeNotificationChannel, fakeNotificationChannel } from '../fakes/fakeNotificationChannel.js';
import { type FakePersistence, fakePersistence } from '../fakes/fakePersistence.js';
import { type FakeRedirectResolver, fakeRedirectResolver } from '../fakes/fakeRedirectResolver.js';
import { settingsWithDealerMailbox } from './dealerMailbox.js';

export interface AlertInMailbox {
  readonly uid: number;
  readonly email: EmailMessage & { readonly date: string };
  readonly reading?: PreparedReading;
  readonly visible?: VisibleContent;
}

export interface MailWorldOptions {
  readonly settings?: Settings;
  readonly uidValidity?: number;
  readonly unreadableUids?: readonly number[];
  readonly refusal?: MailboxUnavailable;
  readonly destinations?: Readonly<Record<string, string>>;
  readonly telegramFailure?: Error;
}

export type MailWorld = FakePersistence &
  PollMailboxDependencies & {
    readonly mailboxReader: FakeMailboxReader;
    readonly extractor: FakeListingExtractor;
    readonly redirectResolver: FakeRedirectResolver;
    readonly channel: FakeNotificationChannel;
    readonly logger: FakeLogger;
    readonly clock: FakeClock;
  };

export const DEALER_TELEGRAM = { telegramToken: '123456:telegram-de-la-concession', telegramChatId: '987654321' } as const;

const sourceOf = (alert: AlertInMailbox): string => `email lu à l’UID ${alert.uid}`;

const preparedFor = <T>(alerts: readonly AlertInMailbox[], entry: (alert: AlertInMailbox) => readonly [string, T] | undefined) =>
  Object.fromEntries(
    alerts.flatMap((alert) => {
      const prepared = entry(alert);
      return prepared === undefined ? [] : [prepared];
    }),
  );

export const mailWorld = (alerts: readonly AlertInMailbox[], options: MailWorldOptions = {}): MailWorld => {
  const persistence = fakePersistence();
  persistence.settings.save(options.settings ?? settingsWithDealerMailbox());
  return {
    ...persistence,
    subscriptions: persistence.pushSubscriptions,
    mailboxReader: fakeMailboxReader({
      uidValidity: options.uidValidity ?? 1,
      emails: alerts.map((alert) => ({ uid: alert.uid, receivedAt: alert.email.date, source: sourceOf(alert) })),
      unreadableUids: options.unreadableUids,
      refusal: options.refusal,
    }),
    extractor: fakeListingExtractor({
      emails: preparedFor(alerts, (alert) => [sourceOf(alert), alert.email]),
      readings: preparedFor(alerts, (alert) =>
        alert.reading === undefined || alert.email.messageId === undefined ? undefined : [alert.email.messageId, alert.reading],
      ),
      visible: preparedFor(alerts, (alert) =>
        alert.visible === undefined ? undefined : [alert.email.html ?? alert.email.text ?? '', alert.visible],
      ),
    }),
    redirectResolver: fakeRedirectResolver(options.destinations),
    channel: fakeNotificationChannel({ telegramFailure: options.telegramFailure }),
    logger: fakeLogger(),
    clock: fakeClock(),
    geocoder: fakeGeocoder(),
    address: { configuredBaseUrl: 'https://veille.example.com', port: 3000 },
  };
};
