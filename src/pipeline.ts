import type { Store, VehicleRow } from './db.js';
import { rawToListingRow } from './db.js';
import { geocode, haversineKm, type GeoCache, type GeocodeResult } from './geo/geo.js';
import { evaluate } from './listings/filters.js';
import { extractVehicleInfo, fingerprint, similar } from './listings/normalize.js';
import { composeMessage } from './messages/templates.js';
import type { Family, RawListing, Settings, VehicleInfo } from './types.js';
import type { CustomBrand } from './listings/brands.js';

/** Brands the person added in the settings that the code does not know. */
export function customBrands(settings: Settings): CustomBrand[] {
  const out: CustomBrand[] = [];
  for (const f of Object.keys(settings.families) as Family[]) for (const b of settings.families[f].known) out.push({ name: b, family: f });
  return out;
}

export type IngestOutcome =
  | { kind: 'new'; vehicleId: number; matched: boolean; reasons: string[] }
  | { kind: 'price'; vehicleId: number; from: number; to: number }
  | { kind: 'seen'; vehicleId: number }
  | { kind: 'repost'; vehicleId: number }
  | { kind: 'other_site'; vehicleId: number };

export interface Notifier {
  newVehicle(vehicle: VehicleRow, raw: RawListing, message: string): Promise<void>;
}

export class Pipeline {
  private readonly geoCache: GeoCache;

  constructor(private readonly store: Store, private notifier?: Notifier) {
    this.geoCache = {
      get: (k) => store.geoGet(k) as GeocodeResult | undefined,
      set: (k, v) => store.geoSet(k, v),
    };
  }

  setNotifier(n: Notifier): void { this.notifier = n; }

  /** Vehicle as the UI needs it: merged info plus the message to send. */
  messageFor(vehicle: VehicleRow, settings: Settings): string {
    if (vehicle.message_override) return vehicle.message_override;
    const first = this.store.firstListingOfVehicle(vehicle.id);
    if (!first) return '';
    const raw: RawListing = {
      site: first.site, siteLabel: first.site_label, externalId: first.external_id, url: first.url, title: first.title,
      price: first.price ?? undefined, km: first.km ?? undefined, year: first.year ?? undefined, city: first.city ?? undefined, postalCode: first.postal_code ?? undefined,
    };
    const info: VehicleInfo = {
      make: vehicle.make ?? undefined, model: vehicle.model ?? undefined, family: vehicle.family,
      year: vehicle.year ?? undefined, km: vehicle.km ?? undefined, price: vehicle.price ?? undefined,
    };
    return composeMessage(raw, info, settings, vehicle.fingerprint, vehicle.distance_km);
  }

  async distanceFor(city: string | undefined, postalCode: string | undefined, settings: Settings): Promise<{ distance: number | null; lat: number | null; lon: number | null }> {
    if (settings.zone.lat === null || settings.zone.lon === null) return { distance: null, lat: null, lon: null };
    const g = await geocode(city, postalCode, this.geoCache);
    if (!g) return { distance: null, lat: null, lon: null };
    return { distance: haversineKm({ lat: settings.zone.lat, lon: settings.zone.lon }, g), lat: g.lat, lon: g.lon };
  }

  async ingest(raw: RawListing, settings = this.store.getSettings()): Promise<IngestOutcome> {
    const now = new Date().toISOString();
    const info = extractVehicleInfo(raw, customBrands(settings));
    // Fields parsed from the title complete what the source gave us.
    raw = { ...raw, price: raw.price ?? info.price, km: raw.km ?? info.km, year: raw.year ?? info.year };

    // 1. Same listing already known (same site, same id): price change or just seen again.
    const existing = this.store.findListing(raw.site, raw.externalId);
    if (existing) {
      const vehicleId = existing.vehicle_id;
      if (raw.price !== undefined && existing.price !== null && raw.price !== existing.price) {
        this.store.recordPrice(existing.id, raw.price, now);
        this.store.touchListing(existing.id, now, raw.price);
        const dropped = raw.price < existing.price;
        this.store.updateVehicle(vehicleId, { price: raw.price, price_dropped: dropped ? 1 : 0, last_seen_at: now });
        this.store.addEvent(vehicleId, dropped ? 'prix_baisse' : 'prix_hausse', `${existing.price} → ${raw.price}`, now);
        return { kind: 'price', vehicleId, from: existing.price, to: raw.price };
      }
      this.store.touchListing(existing.id, now, raw.price ?? null);
      // Data the first reading missed (price, photo, text) completes the record; the verdict is refreshed
      // for vehicles still waiting, since a price can change what the rules say.
      const vehicle = this.store.getVehicle(vehicleId);
      if (vehicle) {
        const patch: Partial<VehicleRow> = {};
        if (vehicle.price === null && raw.price !== undefined) patch.price = raw.price;
        if (vehicle.km === null && raw.km !== undefined) patch.km = raw.km;
        if (vehicle.year === null && raw.year !== undefined) patch.year = raw.year;
        if (!existing.image_url && raw.imageUrl) this.store.updateListing(existing.id, { image_url: raw.imageUrl });
        if (!existing.description && raw.description) this.store.updateListing(existing.id, { description: raw.description });
        if (Object.keys(patch).length) {
          if (vehicle.status === 'nouveau' && !vehicle.do_not_contact) {
            const merged = { ...info, price: patch.price ?? vehicle.price ?? undefined, km: patch.km ?? vehicle.km ?? undefined, year: patch.year ?? vehicle.year ?? undefined };
            const verdict = evaluate(raw, merged, settings, { distanceKm: vehicle.distance_km });
            patch.matched = verdict.pass ? 1 : 0;
            patch.reasons = JSON.stringify(verdict.reasons);
          }
          this.store.updateVehicle(vehicleId, patch);
        }
      }
      return { kind: 'seen', vehicleId };
    }

    // 2. Same vehicle under a new id (repost on the same site, or the same car on another site).
    const fp = fingerprint(info, raw);
    const vehicle = this.store.findVehiclesByFingerprint(fp).find((v) => similar(v, info));
    if (vehicle) {
      const siblings = this.store.listingsOfVehicle(vehicle.id);
      const sameSite = siblings.some((l) => l.site === raw.site);
      this.store.insertListing(rawToListingRow(raw, vehicle.id, now));
      this.store.updateVehicle(vehicle.id, { last_seen_at: now, reposted: sameSite ? 1 : vehicle.reposted });
      this.store.addEvent(vehicle.id, sameSite ? 'republiee' : 'autre_site', `${raw.siteLabel} ${raw.url}`, now);
      return { kind: sameSite ? 'repost' : 'other_site', vehicleId: vehicle.id };
    }

    // 3. Brand new vehicle.
    const geo = await this.distanceFor(raw.city, raw.postalCode, settings);
    const verdict = evaluate(raw, info, settings, { distanceKm: geo.distance });
    const vehicleId = this.store.insertVehicle({
      fingerprint: fp,
      make: info.make ?? null, model: info.model ?? null, family: info.family,
      year: info.year ?? null, km: info.km ?? null, price: info.price ?? null,
      city: raw.city ?? null, postal_code: raw.postalCode ?? null, lat: geo.lat, lon: geo.lon, distance_km: geo.distance,
      status: 'nouveau', do_not_contact: 0, matched: verdict.pass ? 1 : 0, reasons: JSON.stringify(verdict.reasons),
      message_override: null, first_seen_at: now, last_seen_at: now, notified_at: null, price_dropped: 0, reposted: 0,
    });
    this.store.insertListing(rawToListingRow(raw, vehicleId, now));
    this.store.addEvent(vehicleId, 'nouveau', raw.siteLabel, now);

    if (verdict.pass && this.notifier) {
      const row = this.store.getVehicle(vehicleId)!;
      const message = this.messageFor(row, settings);
      try {
        await this.notifier.newVehicle(row, raw, message);
        this.store.updateVehicle(vehicleId, { notified_at: new Date().toISOString() });
      } catch (err) {
        this.store.addEvent(vehicleId, 'notification_echec', String(err), new Date().toISOString());
      }
    }
    return { kind: 'new', vehicleId, matched: verdict.pass, reasons: verdict.reasons };
  }

  /** Re-run the filters on recent vehicles with the given settings (saved or not). Returns how many pass. */
  async reevaluate(settings: Settings, days = 7, persist = false): Promise<{ total: number; pass: number }> {
    const vehicles = this.store.recentVehicles(days);
    let pass = 0;
    for (const v of vehicles) {
      const first = this.store.firstListingOfVehicle(v.id);
      if (!first) continue;
      const raw: RawListing = {
        site: first.site, siteLabel: first.site_label, externalId: first.external_id, url: first.url, title: first.title,
        price: v.price ?? undefined, km: v.km ?? undefined, year: v.year ?? undefined, city: v.city ?? undefined, postalCode: v.postal_code ?? undefined,
        sellerType: first.seller_type,
      };
      const info: VehicleInfo = { make: v.make ?? undefined, model: v.model ?? undefined, family: v.family, year: v.year ?? undefined, km: v.km ?? undefined, price: v.price ?? undefined };
      let distance = v.distance_km;
      if (v.lat !== null && v.lon !== null && settings.zone.lat !== null && settings.zone.lon !== null) {
        distance = haversineKm({ lat: settings.zone.lat, lon: settings.zone.lon }, { lat: v.lat, lon: v.lon });
      }
      const verdict = evaluate(raw, info, settings, { distanceKm: distance });
      if (verdict.pass) pass++;
      if (persist) this.store.updateVehicle(v.id, { matched: verdict.pass ? 1 : 0, reasons: JSON.stringify(verdict.reasons), distance_km: distance });
    }
    return { total: vehicles.length, pass };
  }
}
