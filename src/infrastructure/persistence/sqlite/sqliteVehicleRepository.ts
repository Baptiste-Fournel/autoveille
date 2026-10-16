import type Database from 'better-sqlite3';
import type {
  Activity,
  KnownListing,
  RejectedCounts,
  StatusCounts,
  VehicleCursor,
  VehiclePage,
  VehiclePageQuery,
  VehicleRepository,
  VehicleSelection,
} from '../../../application/ports/vehicleRepository.js';
import { REJECTION_GROUP_OF_KIND, type RejectionGroup } from '../../../domain/filtering/rejectionGroups.js';
import type { RejectionReason } from '../../../domain/filtering/verdict.js';
import type { VehicleReevaluation } from '../../../domain/ingest/reevaluate.js';
import type {
  ListingChanges,
  NewListing,
  NewVehicle,
  RegroupingChanges,
  VehicleSightingChanges,
  VehicleUpdateChanges,
} from '../../../domain/vehicle/changes.js';
import { EVENT_TYPES, type NewVehicleEvent, type VehicleEventType } from '../../../domain/vehicle/events.js';
import type { Listing, PricePoint, Status, Vehicle, VehicleEvent } from '../../../domain/vehicle/types.js';
import {
  cursorOf,
  type EventRow,
  eventsOf,
  type ListingRow,
  listingOf,
  listingSightingParameters,
  newEventParameters,
  newListingParameters,
  newVehicleParameters,
  type PricePointRow,
  pricePointOf,
  pricePointParameters,
  type RejectedCountsRow,
  type RejectionRow,
  reevaluationParameters,
  regroupingParameters,
  rejectedCountsOf,
  rejectionRows,
  sightingParameters,
  type VehicleRow,
  vehicleOf,
  vehicleUpdateParameters,
} from './vehicleMapper.js';

interface PageParameters {
  readonly status: Status | null;
  readonly with_group: RejectionGroup | null;
  readonly without_group: RejectionGroup | null;
  readonly since: string | null;
  readonly sort_at: string | null;
  readonly id: number | null;
  readonly limit: number;
}

interface ActivityParameters {
  readonly since: string;
  readonly contacted: VehicleEventType;
  readonly replied: VehicleEventType;
}

const NO_STATUS_COUNTS: StatusCounts = { nouveau: 0, contacte: 0, repondu: 0, ignore: 0 };

const NO_ACTIVITY: Activity = { received: 0, contacted: 0, replied: 0 };

const NO_REJECTED_COUNTS: RejectedCounts = { all: 0, byGroup: { marque: 0, special: 0, pro: 0, km: 0, loin: 0 } };

const VEHICLE_COLUMNS = `id, fingerprint, make, model, family, year, km, price, city, postal_code, lat, lon, distance_km, status,
  do_not_contact, matched, message_override, note, first_seen_at, last_seen_at, published_at, notified_at, price_dropped, reposted, sort_at,
  (SELECT json_group_array(json_object('kind', kind, 'payload', json(payload)) ORDER BY position)
     FROM vehicle_rejections WHERE vehicle_rejections.vehicle_id = vehicles.id) AS rejections`;

const LISTING_COLUMNS = `id, vehicle_id, site, site_label, external_id, url, title, price, km, year, city, postal_code, seller_type,
  image_url, description, published_at, source_ref, first_seen_at, last_seen_at`;

const REJECTION_GROUP = `CASE vehicle_rejections.kind ${Object.entries(REJECTION_GROUP_OF_KIND)
  .map(([kind, group]) => `WHEN '${kind}' THEN '${group}'`)
  .join(' ')} END`;

const KEPT = 'matched = 1';

const KEPT_WITH_STATUS = 'matched = 1 AND status = @status';

const REJECTED = `matched = 0
  AND (@with_group IS NULL OR EXISTS (
    SELECT 1 FROM vehicle_rejections WHERE vehicle_rejections.vehicle_id = vehicles.id AND ${REJECTION_GROUP} = @with_group))
  AND (@without_group IS NULL OR NOT EXISTS (
    SELECT 1 FROM vehicle_rejections WHERE vehicle_rejections.vehicle_id = vehicles.id AND ${REJECTION_GROUP} = @without_group))`;

const FIRST_SEEN_SINCE = '(@since IS NULL OR first_seen_at >= @since)';

const AFTER_CURSOR = '(sort_at < @sort_at OR (sort_at = @sort_at AND id > @id))';

const NEWEST_FIRST_IN_ARRIVAL_ORDER = 'ORDER BY sort_at DESC, id LIMIT @limit';

const firstPageSql = (selection: string): string =>
  `SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE ${selection} AND ${FIRST_SEEN_SINCE} ${NEWEST_FIRST_IN_ARRIVAL_ORDER}`;

const pageAfterSql = (selection: string): string =>
  `SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE ${selection} AND ${FIRST_SEEN_SINCE} AND ${AFTER_CURSOR} ${NEWEST_FIRST_IN_ARRIVAL_ORDER}`;

const REJECTED_COUNTS_SQL = `WITH rejected AS (
    SELECT id FROM vehicles WHERE matched = 0 AND first_seen_at >= ?
  ),
  grouped AS (
    SELECT DISTINCT vehicle_rejections.vehicle_id, ${REJECTION_GROUP} AS rejection_group
    FROM vehicle_rejections JOIN rejected ON rejected.id = vehicle_rejections.vehicle_id
  )
  SELECT
    (SELECT COUNT(*) FROM rejected) AS all_rejected,
    COUNT(*) FILTER (WHERE rejection_group = 'marque') AS marque,
    COUNT(*) FILTER (WHERE rejection_group = 'special') AS special,
    COUNT(*) FILTER (WHERE rejection_group = 'pro') AS pro,
    COUNT(*) FILTER (WHERE rejection_group = 'km') AS km,
    COUNT(*) FILTER (WHERE rejection_group = 'loin') AS loin
  FROM grouped`;

const STATUS_COUNTS_SQL = `SELECT
    COUNT(*) FILTER (WHERE status = 'nouveau') AS nouveau,
    COUNT(*) FILTER (WHERE status = 'contacte') AS contacte,
    COUNT(*) FILTER (WHERE status = 'repondu') AS repondu,
    COUNT(*) FILTER (WHERE status = 'ignore') AS "ignore"
  FROM vehicles WHERE matched = 1`;

const ACTIVITY_SQL = `SELECT
    (SELECT COUNT(*) FROM vehicles WHERE matched = 1 AND first_seen_at >= @since) AS received,
    (SELECT COUNT(DISTINCT vehicle_id) FROM events WHERE type = @contacted AND at >= @since) AS contacted,
    (SELECT COUNT(DISTINCT vehicle_id) FROM events WHERE type = @replied AND at >= @since) AS replied`;

const INSERT_VEHICLE_SQL = `INSERT INTO vehicles (fingerprint, make, model, family, year, km, price, city, postal_code, lat, lon, distance_km,
    status, do_not_contact, matched, message_override, note, first_seen_at, last_seen_at, published_at, notified_at, price_dropped, reposted)
  VALUES (@fingerprint, @make, @model, @family, @year, @km, @price, @city, @postal_code, @lat, @lon, @distance_km,
    @status, @do_not_contact, @matched, @message_override, @note, @first_seen_at, @last_seen_at, @published_at, @notified_at, @price_dropped, @reposted)`;

const INSERT_LISTING_SQL = `INSERT INTO listings (vehicle_id, site, site_label, external_id, url, title, price, km, year, city, postal_code,
    seller_type, image_url, description, published_at, source_ref, first_seen_at, last_seen_at)
  VALUES (@vehicle_id, @site, @site_label, @external_id, @url, @title, @price, @km, @year, @city, @postal_code,
    @seller_type, @image_url, @description, @published_at, @source_ref, @first_seen_at, @last_seen_at)`;

const VEHICLE_SIGHTING_SQL = `UPDATE vehicles SET
    price = CASE WHEN @has_price THEN @price ELSE price END,
    price_dropped = CASE WHEN @has_price_dropped THEN @price_dropped ELSE price_dropped END,
    km = CASE WHEN @has_km THEN @km ELSE km END,
    year = CASE WHEN @has_year THEN @year ELSE year END,
    published_at = CASE WHEN @has_published_at THEN @published_at ELSE published_at END,
    reposted = CASE WHEN @has_reposted THEN @reposted ELSE reposted END,
    matched = CASE WHEN @has_matched THEN @matched ELSE matched END,
    last_seen_at = CASE WHEN @has_last_seen_at THEN @last_seen_at ELSE last_seen_at END
  WHERE id = @id`;

const REGROUPING_SQL = `UPDATE vehicles SET
    make = CASE WHEN @has_make THEN @make ELSE make END,
    model = CASE WHEN @has_model THEN @model ELSE model END,
    family = CASE WHEN @has_family THEN @family ELSE family END,
    fingerprint = CASE WHEN @has_fingerprint THEN @fingerprint ELSE fingerprint END,
    reposted = CASE WHEN @has_reposted THEN @reposted ELSE reposted END,
    matched = CASE WHEN @has_matched THEN @matched ELSE matched END
  WHERE id = @id`;

const REEVALUATION_SQL = `UPDATE vehicles SET
    matched = @matched, distance_km = @distance_km, make = @make, model = @model, family = @family
  WHERE id = @id`;

const VEHICLE_UPDATE_SQL = `UPDATE vehicles SET
    status = CASE WHEN @has_status THEN @status ELSE status END,
    do_not_contact = CASE WHEN @has_do_not_contact THEN @do_not_contact ELSE do_not_contact END,
    message_override = CASE WHEN @has_message_override THEN @message_override ELSE message_override END,
    note = CASE WHEN @has_note THEN @note ELSE note END,
    matched = CASE WHEN @has_matched THEN @matched ELSE matched END
  WHERE id = @id`;

const LISTING_SIGHTING_SQL = `UPDATE listings SET
    price = CASE WHEN @has_price THEN @price ELSE price END,
    image_url = CASE WHEN @has_image_url THEN @image_url ELSE image_url END,
    description = CASE WHEN @has_description THEN @description ELSE description END,
    published_at = CASE WHEN @has_published_at THEN @published_at ELSE published_at END,
    last_seen_at = CASE WHEN @has_last_seen_at THEN @last_seen_at ELSE last_seen_at END
  WHERE id = @id`;

const prepareStatements = (database: Database.Database) => ({
  vehicleById: database.prepare<[number], VehicleRow>(`SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE id = ?`),
  listingByReference: database.prepare<[string, string], ListingRow>(
    `SELECT ${LISTING_COLUMNS} FROM listings WHERE site = ? AND external_id = ?`,
  ),
  vehiclesWithFingerprint: database.prepare<[string], VehicleRow>(
    `SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE fingerprint = ? ORDER BY last_seen_at DESC, id`,
  ),
  listingsOf: database.prepare<[number], ListingRow>(
    `SELECT ${LISTING_COLUMNS} FROM listings WHERE vehicle_id = ? ORDER BY first_seen_at, id`,
  ),
  priceHistory: database.prepare<[number], PricePointRow>(
    'SELECT price, seen_at FROM price_history WHERE listing_id = ? ORDER BY seen_at, id',
  ),
  events: database.prepare<[number], EventRow>(
    'SELECT id, vehicle_id, type, detail, at FROM events WHERE vehicle_id = ? ORDER BY at DESC, id DESC',
  ),
  lastEventAt: database.prepare<[number, VehicleEventType], { readonly at: string }>(
    'SELECT at FROM events WHERE vehicle_id = ? AND type = ? ORDER BY at DESC LIMIT 1',
  ),
  keptPages: {
    first: database.prepare<PageParameters, VehicleRow>(firstPageSql(KEPT)),
    after: database.prepare<PageParameters, VehicleRow>(pageAfterSql(KEPT)),
  },
  keptWithStatusPages: {
    first: database.prepare<PageParameters, VehicleRow>(firstPageSql(KEPT_WITH_STATUS)),
    after: database.prepare<PageParameters, VehicleRow>(pageAfterSql(KEPT_WITH_STATUS)),
  },
  rejectedPages: {
    first: database.prepare<PageParameters, VehicleRow>(firstPageSql(REJECTED)),
    after: database.prepare<PageParameters, VehicleRow>(pageAfterSql(REJECTED)),
  },
  rejectedCounts: database.prepare<[string], RejectedCountsRow>(REJECTED_COUNTS_SQL),
  statusCounts: database.prepare<[], StatusCounts>(STATUS_COUNTS_SQL),
  activity: database.prepare<ActivityParameters, Activity>(ACTIVITY_SQL),
  vehiclesFirstSeenSince: database.prepare<[string], VehicleRow>(
    `SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE first_seen_at >= ? ORDER BY first_seen_at DESC, id`,
  ),
  allVehicles: database.prepare<[], VehicleRow>(`SELECT ${VEHICLE_COLUMNS} FROM vehicles ORDER BY id`),
  insertVehicle: database.prepare<ReturnType<typeof newVehicleParameters>>(INSERT_VEHICLE_SQL),
  insertRejection: database.prepare<RejectionRow>(
    'INSERT INTO vehicle_rejections (vehicle_id, position, kind, payload) VALUES (@vehicle_id, @position, @kind, @payload)',
  ),
  deleteRejections: database.prepare<[number]>('DELETE FROM vehicle_rejections WHERE vehicle_id = ?'),
  insertListing: database.prepare<ReturnType<typeof newListingParameters>>(INSERT_LISTING_SQL),
  insertPricePoint: database.prepare<ReturnType<typeof pricePointParameters>>(
    'INSERT INTO price_history (listing_id, price, seen_at) VALUES (@listing_id, @price, @seen_at)',
  ),
  insertEvent: database.prepare<ReturnType<typeof newEventParameters>>(
    'INSERT INTO events (vehicle_id, type, detail, at) VALUES (@vehicle_id, @type, @detail, @at)',
  ),
  eraseEvents: database.prepare<[number, string]>('DELETE FROM events WHERE vehicle_id = ? AND type IN (SELECT value FROM json_each(?))'),
  recordListingSighting: database.prepare<ReturnType<typeof listingSightingParameters>>(LISTING_SIGHTING_SQL),
  recordVehicleSighting: database.prepare<ReturnType<typeof sightingParameters>>(VEHICLE_SIGHTING_SQL),
  applyRegrouping: database.prepare<ReturnType<typeof regroupingParameters>>(REGROUPING_SQL),
  moveListing: database.prepare<[number, number]>('UPDATE listings SET vehicle_id = ? WHERE id = ?'),
  applyReevaluation: database.prepare<ReturnType<typeof reevaluationParameters>>(REEVALUATION_SQL),
  applyVehicleUpdate: database.prepare<ReturnType<typeof vehicleUpdateParameters>>(VEHICLE_UPDATE_SQL),
  markNotified: database.prepare<[string, number]>('UPDATE vehicles SET notified_at = ? WHERE id = ?'),
  deleteVehicle: database.prepare<[number]>('DELETE FROM vehicles WHERE id = ?'),
});

type VehicleStatements = ReturnType<typeof prepareStatements>;

const pageParameters = ({ selection, firstSeenSince, after, limit }: VehiclePageQuery): PageParameters => ({
  status: selection.kind === 'kept' ? (selection.status ?? null) : null,
  with_group: selection.kind === 'rejected' ? (selection.withGroup ?? null) : null,
  without_group: selection.kind === 'rejected' ? (selection.withoutGroup ?? null) : null,
  since: firstSeenSince ?? null,
  sort_at: after?.sortAt ?? null,
  id: after?.id ?? null,
  limit: limit + 1,
});

export class SqliteVehicleRepository implements VehicleRepository {
  private readonly database: Database.Database;
  private readonly statements: VehicleStatements;

  constructor(database: Database.Database) {
    this.database = database;
    this.statements = prepareStatements(database);
  }

  vehicle(id: number): Vehicle | undefined {
    const row = this.statements.vehicleById.get(id);
    return row === undefined ? undefined : vehicleOf(row);
  }

  findListing(site: string, externalId: string): KnownListing | undefined {
    const row = this.statements.listingByReference.get(site, externalId);
    const owner = row === undefined ? undefined : this.vehicle(row.vehicle_id);
    return row === undefined || owner === undefined ? undefined : { listing: listingOf(row), vehicle: owner };
  }

  vehiclesWithFingerprint(fingerprint: string): readonly Vehicle[] {
    return this.statements.vehiclesWithFingerprint.all(fingerprint).map(vehicleOf);
  }

  listingsOf(vehicleId: number): readonly Listing[] {
    return this.statements.listingsOf.all(vehicleId).map(listingOf);
  }

  priceHistory(listingId: number): readonly PricePoint[] {
    return this.statements.priceHistory.all(listingId).map(pricePointOf);
  }

  events(vehicleId: number): readonly VehicleEvent[] {
    return this.statements.events.all(vehicleId).flatMap(eventsOf);
  }

  enteredStatusAt(vehicleId: number, statusEvent: VehicleEventType): string | null {
    return this.statements.lastEventAt.get(vehicleId, statusEvent)?.at ?? null;
  }

  page(query: VehiclePageQuery): VehiclePage {
    const rows = this.pageStatement(query.selection, query.after).all(pageParameters(query));
    const vehicles = rows.slice(0, query.limit).map(vehicleOf);
    const last = rows[query.limit - 1];
    return rows.length > query.limit && last !== undefined ? { vehicles, nextCursor: cursorOf(last) } : { vehicles };
  }

  rejectedCounts(firstSeenSince: string): RejectedCounts {
    const row = this.statements.rejectedCounts.get(firstSeenSince);
    return row === undefined ? NO_REJECTED_COUNTS : rejectedCountsOf(row);
  }

  countsByStatus(): StatusCounts {
    return this.statements.statusCounts.get() ?? NO_STATUS_COUNTS;
  }

  activitySince(since: string): Activity {
    return (
      this.statements.activity.get({ since, contacted: EVENT_TYPES.markedContacted, replied: EVENT_TYPES.markedReplied }) ?? NO_ACTIVITY
    );
  }

  vehiclesFirstSeenSince(since: string): readonly Vehicle[] {
    return this.statements.vehiclesFirstSeenSince.all(since).map(vehicleOf);
  }

  allVehicles(): readonly Vehicle[] {
    return this.statements.allVehicles.all().map(vehicleOf);
  }

  addVehicle(vehicle: NewVehicle): number {
    return this.atomically(() => {
      const id = Number(this.statements.insertVehicle.run(newVehicleParameters(vehicle)).lastInsertRowid);
      this.writeRejections(id, vehicle.rejections);
      return id;
    });
  }

  addListing(vehicleId: number, listing: NewListing): number {
    return Number(this.statements.insertListing.run(newListingParameters(vehicleId, listing)).lastInsertRowid);
  }

  addPricePoint(listingId: number, point: PricePoint): void {
    this.statements.insertPricePoint.run(pricePointParameters(listingId, point));
  }

  addEvent(vehicleId: number, event: NewVehicleEvent): void {
    this.statements.insertEvent.run(newEventParameters(vehicleId, event));
  }

  eraseEvents(vehicleId: number, types: readonly VehicleEventType[]): void {
    this.statements.eraseEvents.run(vehicleId, JSON.stringify(types));
  }

  recordListingSighting(listingId: number, changes: ListingChanges): void {
    this.statements.recordListingSighting.run(listingSightingParameters(listingId, changes));
  }

  recordVehicleSighting(vehicleId: number, changes: VehicleSightingChanges): void {
    this.atomically(() => {
      const updated = this.statements.recordVehicleSighting.run(sightingParameters(vehicleId, changes));
      this.rewriteRejections(updated, vehicleId, changes.rejections);
    });
  }

  applyRegrouping(vehicleId: number, changes: RegroupingChanges): void {
    this.atomically(() => {
      const updated = this.statements.applyRegrouping.run(regroupingParameters(vehicleId, changes));
      this.rewriteRejections(updated, vehicleId, changes.rejections);
    });
  }

  moveListings(listingIds: readonly number[], vehicleId: number): void {
    this.atomically(() => {
      for (const listingId of listingIds) {
        this.statements.moveListing.run(vehicleId, listingId);
      }
    });
  }

  applyReevaluation(vehicleId: number, reevaluation: VehicleReevaluation): void {
    this.atomically(() => {
      const updated = this.statements.applyReevaluation.run(reevaluationParameters(vehicleId, reevaluation));
      this.rewriteRejections(updated, vehicleId, reevaluation.rejections);
    });
  }

  applyVehicleUpdate(vehicleId: number, changes: VehicleUpdateChanges): void {
    this.atomically(() => {
      const updated = this.statements.applyVehicleUpdate.run(vehicleUpdateParameters(vehicleId, changes));
      this.rewriteRejections(updated, vehicleId, changes.rejections);
    });
  }

  markNotified(vehicleId: number, at: string): void {
    this.statements.markNotified.run(at, vehicleId);
  }

  deleteVehicle(id: number): void {
    this.statements.deleteVehicle.run(id);
  }

  private atomically<T>(work: () => T): T {
    return this.database.transaction(work)();
  }

  private pageStatement(selection: VehicleSelection, after: VehicleCursor | undefined): Database.Statement<[PageParameters], VehicleRow> {
    const pages =
      selection.kind === 'rejected'
        ? this.statements.rejectedPages
        : selection.status === undefined
          ? this.statements.keptPages
          : this.statements.keptWithStatusPages;
    return after === undefined ? pages.first : pages.after;
  }

  private rewriteRejections(update: Database.RunResult, vehicleId: number, rejections: readonly RejectionReason[] | undefined): void {
    if (update.changes === 0 || rejections === undefined) {
      return;
    }
    this.statements.deleteRejections.run(vehicleId);
    this.writeRejections(vehicleId, rejections);
  }

  private writeRejections(vehicleId: number, rejections: readonly RejectionReason[]): void {
    for (const row of rejectionRows(vehicleId, rejections)) {
      this.statements.insertRejection.run(row);
    }
  }
}
