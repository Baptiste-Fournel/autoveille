import type { ListingRow, Store, VehicleRow } from './db.js';
import { rawToListingRow } from './db.js';
import { geocode, haversineKm, type GeoCache, type GeocodeResult } from './geo/geo.js';
import { evaluate } from './listings/filters.js';
import { extractVehicleInfo, fingerprint, similar } from './listings/normalize.js';
import { composeMessage } from './messages/templates.js';
import type { RawListing, Settings, VehicleInfo } from './types.js';
import { customBrandsOf as customBrands } from './domain/settings/customBrands.js';

export { customBrands };

export type IngestOutcome =
  | { kind: 'new'; vehicleId: number; matched: boolean; reasons: string[] }
  | { kind: 'price'; vehicleId: number; from: number; to: number }
  | { kind: 'seen'; vehicleId: number }
  | { kind: 'repost'; vehicleId: number }
  | { kind: 'other_site'; vehicleId: number };

export interface DigestGap { site: string; siteLabel: string; announced: number; received: number; url?: string; at: string }

export interface Notifier {
  newVehicle(vehicle: VehicleRow, raw: RawListing, message: string): Promise<void>;
  /** A seller lowered the price of a vehicle still in play: worth a nudge. Optional. */
  priceDrop?(vehicle: VehicleRow, raw: RawListing, from: number, to: number): Promise<void>;
  /** A site announced more ads than its email showed: the rest is only on the site. Optional. */
  digest?(gap: DigestGap): Promise<void>;
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

  /** The site's email was a preview of a longer list: tell the person, once per email. */
  async truncatedDigest(gap: DigestGap): Promise<void> {
    if (this.notifier?.digest) await this.notifier.digest(gap);
  }

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

  async ingest(raw: RawListing, settings = this.store.getSettings(), opts: { notify?: boolean } = {}): Promise<IngestOutcome> {
    const notify = opts.notify !== false;
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
        // A lower price on a vehicle the person is still interested in (waiting, or contacted) is worth a notification.
        const v = this.store.getVehicle(vehicleId);
        if (notify && dropped && v && v.matched && !v.do_not_contact && (v.status === 'nouveau' || v.status === 'contacte') && this.notifier?.priceDrop) {
          try { await this.notifier.priceDrop(v, raw, existing.price, raw.price); }
          catch (err) { this.store.addEvent(vehicleId, 'notification_echec', String(err), new Date().toISOString()); }
        }
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
        // A fresher photo link replaces the old one: some sites sign their image links, and a signature can expire.
        if (raw.imageUrl && raw.imageUrl !== existing.image_url) this.store.updateListing(existing.id, { image_url: raw.imageUrl });
        if (!existing.description && raw.description) this.store.updateListing(existing.id, { description: raw.description });
        if (!existing.published_at && raw.publishedAt) this.store.updateListing(existing.id, { published_at: raw.publishedAt });
        if (raw.publishedAt && (!vehicle.published_at || raw.publishedAt < vehicle.published_at)) patch.published_at = raw.publishedAt;
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
      this.store.updateVehicle(vehicle.id, { last_seen_at: now, reposted: sameSite ? 1 : vehicle.reposted, ...(raw.publishedAt && (!vehicle.published_at || raw.publishedAt < vehicle.published_at) ? { published_at: raw.publishedAt } : {}) });
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
      message_override: null, first_seen_at: now, last_seen_at: now, notified_at: null, price_dropped: 0, reposted: 0, note: null,
      published_at: raw.publishedAt ?? null,
    });
    this.store.insertListing(rawToListingRow(raw, vehicleId, now));
    this.store.addEvent(vehicleId, 'nouveau', raw.siteLabel, now);

    if (verdict.pass && this.notifier && notify) {
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
      // The brand is read again from the title: brands added to a family (or to the app) apply to known vehicles too.
      const fresh = extractVehicleInfo(raw, customBrands(settings));
      const info: VehicleInfo = { make: fresh.make ?? v.make ?? undefined, model: fresh.model ?? v.model ?? undefined, family: fresh.make ? fresh.family : v.family, year: v.year ?? undefined, km: v.km ?? undefined, price: v.price ?? undefined };
      let distance = v.distance_km;
      if (v.lat !== null && v.lon !== null && settings.zone.lat !== null && settings.zone.lon !== null) {
        distance = haversineKm({ lat: settings.zone.lat, lon: settings.zone.lon }, { lat: v.lat, lon: v.lon });
      }
      const verdict = evaluate(raw, info, settings, { distanceKm: distance });
      if (verdict.pass) pass++;
      if (persist) this.store.updateVehicle(v.id, { matched: verdict.pass ? 1 : 0, reasons: JSON.stringify(verdict.reasons), distance_km: distance, make: info.make ?? null, model: info.model ?? null, family: info.family });
    }
    return { total: vehicles.length, pass };
  }

  /**
   * Maintenance pass over every vehicle: make, model and family are read again from the listings with
   * the current rules, fingerprints refreshed, and listings merged by mistake (two different cars of the
   * same model) separated into their own vehicles. Verdicts are refreshed only for vehicles still waiting;
   * decisions already taken (contacted, ignored…) are kept.
   */
  async repair(settings: Settings): Promise<{ vehicles: number; renamed: number; split: number; reevaluated: number }> {
    const out = { vehicles: 0, renamed: 0, split: 0, reevaluated: 0 };
    const brands = customBrands(settings);
    const rawOf = (l: ListingRow, v: VehicleRow): RawListing => ({
      site: l.site, siteLabel: l.site_label, externalId: l.external_id, url: l.url, title: l.title,
      price: l.price ?? undefined, km: l.km ?? undefined, year: l.year ?? v.year ?? undefined,
      city: l.city ?? v.city ?? undefined, postalCode: l.postal_code ?? v.postal_code ?? undefined,
      sellerType: l.seller_type, description: l.description ?? undefined, publishedAt: l.published_at ?? undefined,
    });
    for (const v of this.store.allVehicles()) {
      out.vehicles++;
      const listings = this.store.listingsOfVehicle(v.id);
      if (!listings.length) continue;
      // Each listing's own identity; the first listing anchors the vehicle, the others stay only when they agree.
      const keyed = listings.map((l) => { const raw = rawOf(l, v); const info = extractVehicleInfo(raw, brands); return { l, raw, info, fp: fingerprint(info, raw) }; });
      const anchor = keyed[0];
      if (!anchor) continue;
      const stay = [anchor];
      const groups: Array<[(typeof keyed)[number], ...typeof keyed]> = [];
      for (const k of keyed.slice(1)) {
        if (k.fp === anchor.fp && similar({ km: k.l.km ?? v.km, price: k.l.price ?? v.price }, { km: anchor.l.km ?? v.km, price: anchor.l.price ?? v.price })) { stay.push(k); continue; }
        const g = groups.find((x) => x[0].fp === k.fp && similar({ km: k.l.km, price: k.l.price }, { km: x[0].l.km, price: x[0].l.price }));
        if (g) g.push(k); else groups.push([k]);
      }
      // The vehicle itself: name and family from the current rules, verdict refreshed if still waiting.
      // The model is read afresh (an old placeholder such as « Autres » must not survive); the make keeps a fallback.
      const info: VehicleInfo = { make: anchor.info.make ?? v.make ?? undefined, model: anchor.info.model, family: anchor.info.make ? anchor.info.family : v.family, year: v.year ?? undefined, km: v.km ?? undefined, price: v.price ?? undefined };
      const patch: Partial<VehicleRow> = {};
      if ((info.make ?? null) !== v.make || (info.model ?? null) !== v.model) { patch.make = info.make ?? null; patch.model = info.model ?? null; out.renamed++; }
      if (info.family !== v.family) patch.family = info.family;
      if (anchor.fp !== v.fingerprint) patch.fingerprint = anchor.fp;
      const reposted = stay.some((k, i) => stay.slice(0, i).some((o) => o.l.site === k.l.site)) ? 1 : 0;
      if (reposted !== v.reposted) patch.reposted = reposted;
      if (v.status === 'nouveau' && !v.do_not_contact) {
        const verdict = evaluate(anchor.raw, info, settings, { distanceKm: v.distance_km });
        if ((verdict.pass ? 1 : 0) !== v.matched || JSON.stringify(verdict.reasons) !== v.reasons) { patch.matched = verdict.pass ? 1 : 0; patch.reasons = JSON.stringify(verdict.reasons); out.reevaluated++; }
      }
      if (Object.keys(patch).length) this.store.updateVehicle(v.id, patch);
      // Listings that were another car: a vehicle of their own, judged on their own data.
      for (const g of groups) {
        const first = g[0];
        const ginfo = first.info;
        const geo = await this.distanceFor(first.raw.city, first.raw.postalCode, settings);
        const verdict = evaluate(first.raw, ginfo, settings, { distanceKm: geo.distance });
        const published = g.map((k) => k.l.published_at).filter((d): d is string => !!d).sort()[0] ?? null;
        this.store.transaction(() => {
          const id = this.store.insertVehicle({
            fingerprint: first.fp, make: ginfo.make ?? null, model: ginfo.model ?? null, family: ginfo.family,
            year: ginfo.year ?? null, km: ginfo.km ?? null, price: ginfo.price ?? null,
            city: first.raw.city ?? null, postal_code: first.raw.postalCode ?? null, lat: geo.lat, lon: geo.lon, distance_km: geo.distance,
            status: 'nouveau', do_not_contact: 0, matched: verdict.pass ? 1 : 0, reasons: JSON.stringify(verdict.reasons),
            message_override: null, first_seen_at: first.l.first_seen_at, last_seen_at: g.map((k) => k.l.last_seen_at).sort().pop() ?? first.l.last_seen_at,
            notified_at: null, price_dropped: 0, reposted: g.some((k, i) => g.slice(0, i).some((o) => o.l.site === k.l.site)) ? 1 : 0, note: null, published_at: published,
          });
          for (const k of g) this.store.updateListing(k.l.id, { vehicle_id: id });
          this.store.addEvent(id, 'nouveau', first.l.site_label, first.l.first_seen_at);
        });
        out.split++;
      }
    }
    return out;
  }
}
