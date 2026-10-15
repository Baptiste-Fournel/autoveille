import webpush from 'web-push';
import type { Store, VehicleRow } from '../db.js';
import type { DigestGap, Notifier } from '../pipeline.js';
import type { RawListing } from '../types.js';
import { fmtInt } from '../listings/normalize.js';

export interface NotifyConfig {
  baseUrl: string | (() => string);
  vapidPublicKey: string;
  vapidPrivateKey: string;
  contactEmail: string;
}

export function pushAvailable(cfg: NotifyConfig): boolean {
  return Boolean(cfg.vapidPublicKey && cfg.vapidPrivateKey);
}

function summary(vehicle: VehicleRow, raw: RawListing): { title: string; body: string } {
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || raw.title;
  const bits = [vehicle.year ? String(vehicle.year) : '', vehicle.km !== null ? `${fmtInt(vehicle.km)} km` : '', vehicle.price !== null ? `${fmtInt(vehicle.price)} €` : ''].filter(Boolean);
  const where = [raw.city, vehicle.distance_km !== null ? `à ${Math.round(vehicle.distance_km)} km` : ''].filter(Boolean).join(', ');
  return { title: `Nouvelle annonce : ${name}`, body: `${bits.join(', ')}${where ? ' • ' + where : ''} • ${raw.siteLabel}` };
}

export class AppNotifier implements Notifier {
  constructor(private readonly store: Store, private readonly cfg: NotifyConfig, private readonly fetchImpl: typeof fetch = fetch) {
    if (pushAvailable(cfg)) {
      webpush.setVapidDetails(cfg.contactEmail ? `mailto:${cfg.contactEmail}` : 'https://autoveille.local', cfg.vapidPublicKey, cfg.vapidPrivateKey);
    }
  }

  baseUrl(): string { return typeof this.cfg.baseUrl === 'function' ? this.cfg.baseUrl() : this.cfg.baseUrl; }

  async newVehicle(vehicle: VehicleRow, raw: RawListing, _message: string): Promise<void> {
    const settings = this.store.getSettings();
    const { title, body } = summary(vehicle, raw);
    const url = `${this.baseUrl()}/#/annonce/${vehicle.id}`;
    const tasks: Promise<unknown>[] = [];
    if (settings.notifications.push && pushAvailable(this.cfg)) tasks.push(this.sendPush({ title, body, url, vehicleId: vehicle.id }));
    if (settings.notifications.telegramToken && settings.notifications.telegramChatId) {
      tasks.push(this.sendTelegram(settings.notifications.telegramToken, settings.notifications.telegramChatId, `${title}\n${body}\n${url}`));
    }
    await Promise.all(tasks);
  }

  async priceDrop(vehicle: VehicleRow, raw: RawListing, from: number, to: number): Promise<void> {
    const settings = this.store.getSettings();
    const name = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || raw.title;
    const title = `Prix baissé : ${name}`;
    const body = `${fmtInt(from)} € → ${fmtInt(to)} €${vehicle.status === 'contacte' ? ' • vendeur déjà contacté' : ''} • ${raw.siteLabel}`;
    const url = `${this.baseUrl()}/#/annonce/${vehicle.id}`;
    const tasks: Promise<unknown>[] = [];
    if (settings.notifications.push && pushAvailable(this.cfg)) tasks.push(this.sendPush({ title, body, url, vehicleId: vehicle.id }));
    if (settings.notifications.telegramToken && settings.notifications.telegramChatId) {
      tasks.push(this.sendTelegram(settings.notifications.telegramToken, settings.notifications.telegramChatId, `${title}\n${body}\n${url}`));
    }
    await Promise.all(tasks);
  }

  async digest(gap: DigestGap): Promise<void> {
    const settings = this.store.getSettings();
    const missing = gap.announced - gap.received;
    const title = `${gap.siteLabel} : ${gap.announced} nouvelles annonces`;
    const body = `${gap.received} ${gap.received > 1 ? 'arrivées' : 'arrivée'} dans l’application, ${missing} ${missing > 1 ? 'autres sont à voir' : 'autre est à voir'} sur le site.`;
    // The notification opens the Sites screen, where the link to the full list on the site waits.
    const url = `${this.baseUrl()}/#/sources`;
    const tasks: Promise<unknown>[] = [];
    if (settings.notifications.push && pushAvailable(this.cfg)) tasks.push(this.sendPush({ title, body, url }));
    if (settings.notifications.telegramToken && settings.notifications.telegramChatId) {
      tasks.push(this.sendTelegram(settings.notifications.telegramToken, settings.notifications.telegramChatId, `${title}\n${body}${gap.url ? `\n${gap.url}` : ''}`));
    }
    await Promise.all(tasks);
  }

  async sendPush(payload: { title: string; body: string; url: string; vehicleId?: number }): Promise<{ sent: number; removed: number }> {
    let sent = 0, removed = 0;
    for (const sub of this.store.pushSubscriptions()) {
      try {
        await webpush.sendNotification(JSON.parse(sub.json), JSON.stringify(payload), { TTL: 3600 });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) { this.store.removePushSubscription(sub.endpoint); removed++; }
        else throw err;
      }
    }
    return { sent, removed };
  }

  async sendTelegram(token: string, chatId: string, text: string): Promise<void> {
    const res = await this.fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text().catch(() => '')}`);
  }
}
