import type { FastifyInstance } from 'fastify';
import type { Store, VehicleRow } from './db.js';
import type { Pipeline } from './pipeline.js';
import type { Scheduler } from './scheduler.js';
import type { LegacyPorts } from './legacyPorts.js';
import { acceptsImportToken } from './application/auth/acceptsImportToken.js';
import { importToken } from './application/auth/importToken.js';
import { importListings, NothingToImport } from './application/ingest/importListings.js';
import { NoDateToRecord, recordPublishedDates } from './application/ingest/recordPublishedDates.js';
import { sendTestPush } from './application/notifications/sendTestPush.js';
import { sendTestTelegram } from './application/notifications/sendTestTelegram.js';
import { pushPublicKey, subscribe, unsubscribe } from './application/notifications/subscriptions.js';
import type { PushSubscription } from './application/ports/pushSubscriptionRepository.js';
import { getSettings } from './application/settings/getSettings.js';
import { previewSettings } from './application/settings/previewSettings.js';
import { updateSettings } from './application/settings/updateSettings.js';
import { testHttpSite } from './application/sources/testHttpSite.js';
import { testMailbox } from './application/sources/testMailbox.js';
import { deleteVehicle } from './application/vehicles/deleteVehicle.js';
import { updateVehicle } from './application/vehicles/updateVehicle.js';
import { VehicleNotFound } from './application/vehicles/vehicleNotFound.js';
import { customBrandsOf } from './domain/settings/customBrands.js';
import { InvalidSettings } from './domain/settings/invalidSettings.js';
import { settingsProblemText, zoneWarningText } from './domain/presentation/settings.js';
import { UnknownStatus, type VehicleUpdateRequest } from './domain/vehicle/status.js';
import type { ImportedListing, ImportedPublicationDate } from './domain/ingest/imports.js';
import { reasonKind, specialReason } from './listings/filters.js';
import { extractVehicleInfo } from './listings/normalize.js';
import { buildVars, lintTemplate, render, VARIABLE_HELP } from './messages/templates.js';
import { siteSetups, targetedSearches } from './sources/links.js';
import { alertAdvice, alertMismatch, siteLabel } from './sources/email/confirmations.js';
import { FAMILIES, FAMILY_LABELS, type Family, type RawListing, type Settings, type Status } from './types.js';

interface Deps { store: Store; pipeline: Pipeline; scheduler: Scheduler; ports: LegacyPorts }

const MASKED_SECRET = '••••••••';

const STATUSES: Status[] = ['nouveau', 'contacte', 'repondu', 'ignore'];

const SAMPLES: Record<Family, RawListing> = {
  allemandes: { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: 'ex', url: '#', title: 'Porsche 911 Carrera S 3.0 420ch PDK', price: 89900, km: 42000, year: 2015, city: 'Pessac', postalCode: '33600' },
  italiennes: { site: 'lacentrale', siteLabel: 'La Centrale', externalId: 'ex', url: '#', title: 'Ferrari 360 Modena F1', price: 79000, km: 45000, year: 2001, city: 'Libourne', postalCode: '33500' },
  americaines: { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: 'ex', url: '#', title: 'Ford Mustang GT 5.0 V8', price: 42000, km: 31000, year: 2018, city: 'Arcachon', postalCode: '33120' },
  francaises: { site: 'paruvendu', siteLabel: 'ParuVendu', externalId: 'ex', url: '#', title: 'Alpine A110 Légende 252ch', price: 58900, km: 21000, year: 2019, city: 'Langon', postalCode: '33210' },
  autres: { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: 'ex', url: '#', title: 'Porsche 911', price: 0, km: 0, year: 2015, city: 'Bordeaux', postalCode: '33000' },
};

export function registerApi(app: FastifyInstance, deps: Deps): void {
  const { store, pipeline, scheduler, ports } = deps;
  const settingsPorts = { ...ports, geocoder: ports.zoneGeocoder };

  const vehicleDto = (v: VehicleRow, settings: Settings, full = false) => {
    const listings = store.listingsOfVehicle(v.id);
    const first = listings[0];
    const withImage = listings.find((l) => l.image_url);
    const raw: RawListing | undefined = first ? { site: first.site, siteLabel: first.site_label, externalId: first.external_id, url: first.url, title: first.title, price: v.price ?? undefined, km: v.km ?? undefined, year: v.year ?? undefined, city: v.city ?? undefined, postalCode: v.postal_code ?? undefined } : undefined;
    const special = raw && v.family !== 'autres' ? specialReason(v.family, { make: v.make ?? undefined, model: v.model ?? undefined, family: v.family, year: v.year ?? undefined, km: v.km ?? undefined, price: v.price ?? undefined }, raw, settings) : undefined;
    return {
      id: v.id,
      name: [v.make, v.model].filter(Boolean).join(' ') || first?.title || '',
      title: first?.title ?? '',
      make: v.make, model: v.model, family: v.family, familyLabel: FAMILY_LABELS[v.family],
      year: v.year, km: v.km, price: v.price, city: v.city, postalCode: v.postal_code,
      distanceKm: v.distance_km === null ? null : Math.round(v.distance_km),
      status: v.status, doNotContact: Boolean(v.do_not_contact), matched: Boolean(v.matched),
      reasons: JSON.parse(v.reasons || '[]') as string[],
      specialReason: special ?? null,
      priceDropped: Boolean(v.price_dropped), reposted: Boolean(v.reposted),
      firstSeenAt: v.first_seen_at, lastSeenAt: v.last_seen_at,
      publishedAt: v.published_at ?? listings.map((l) => l.published_at).filter((d): d is string => Boolean(d)).sort()[0] ?? null,
      url: first?.url ?? '', site: first?.site ?? '', siteLabel: first?.site_label ?? '',
      imageUrl: withImage?.image_url ?? null,
      description: listings.find((l) => l.description)?.description ?? null,
      sellerType: first?.seller_type ?? 'inconnu',
      message: pipeline.messageFor(v, settings),
      messageEdited: Boolean(v.message_override),
      note: v.note ?? '',
      contactedAt: v.status === 'contacte' || v.status === 'repondu' ? store.lastEventAt(v.id, 'statut_contacte') : null,
      repliedAt: v.status === 'repondu' ? store.lastEventAt(v.id, 'statut_repondu') : null,
      listings: listings.map((l) => ({ id: l.id, site: l.site, siteLabel: l.site_label, url: l.url, title: l.title, price: l.price, firstSeenAt: l.first_seen_at, lastSeenAt: l.last_seen_at, priceHistory: full ? store.priceHistory(l.id) : [] })),
      events: full ? store.events(v.id) : [],
    };
  };

  // ---------- overview ----------
  app.get('/api/overview', async () => {
    const settings = store.getSettings();
    return {
      counts: store.counts(),
      week: store.weekStats(7),
      dealer: settings.dealer,
      zone: { city: settings.zone.city, radiusKm: settings.zone.radiusKm },
      imapConfigured: Boolean(settings.imap.user && settings.imap.pass),
      alertsDone: Object.keys(settings.alertsDone).filter((k) => settings.alertsDone[k]),
      alertIssues: Object.values(settings.alerts).flatMap((a) => alertMismatch(a, settings).map((m) => `${siteLabel(a.site)} : ${m}`)),
      sources: store.sourceRuns(),
      pushKey: store.secret('vapid_public'),
    };
  });

  // ---------- vehicles ----------
  app.get<{ Querystring: { status?: string; days?: string; limit?: string; kind?: string } }>('/api/vehicles', async (req) => {
    const settings = store.getSettings();
    const status = req.query.status ?? 'nouveau';
    const days = req.query.days ? Number(req.query.days) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 1000;
    if (status === 'ecartees') {
      // Wide alerts on the sites mean many refusals: they are grouped by reason so a good deal is quick to spot.
      const all = store.listVehicles({ onlyMatched: false, sinceDays: days ?? 14, limit: 3000 }).filter((v) => !v.matched);
      const kindsOf = (v: VehicleRow) => new Set((JSON.parse(v.reasons || '[]') as string[]).map(reasonKind));
      const counts: { suivies: number; [kind: string]: number } = { tous: all.length, suivies: 0, loin: 0, km: 0, special: 0, pro: 0, marque: 0 };
      const cache = new Map<number, Set<string>>();
      for (const v of all) { const k = kindsOf(v); cache.set(v.id, k); if (!k.has('marque')) counts.suivies++; for (const x of k) counts[x] = (counts[x] ?? 0) + 1; }
      const kind = req.query.kind || 'suivies';
      const rows = all.filter((v) => { const k = cache.get(v.id)!; return kind === 'tous' ? true : kind === 'suivies' ? !k.has('marque') : k.has(kind); }).slice(0, limit);
      return { vehicles: rows.map((v) => vehicleDto(v, settings)), kinds: counts };
    }
    const rows = store.listVehicles({ status: status === 'tous' ? 'tous' : (STATUSES.includes(status as Status) ? (status as Status) : 'nouveau'), sinceDays: days, limit });
    return { vehicles: rows.map((v) => vehicleDto(v, settings)) };
  });

  app.get<{ Params: { id: string } }>('/api/vehicles/:id', async (req, reply) => {
    const v = store.getVehicle(Number(req.params.id));
    if (!v) return reply.code(404).send({ error: 'Annonce inconnue.' });
    return vehicleDto(v, store.getSettings(), true);
  });

  app.delete<{ Params: { id: string } }>('/api/vehicles/:id', async (req, reply) => {
    try {
      deleteVehicle(ports, Number(req.params.id));
    } catch (error) {
      if (error instanceof VehicleNotFound) return reply.code(404).send({ error: 'Annonce inconnue.' });
      throw error;
    }
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: VehicleUpdateRequest }>('/api/vehicles/:id', async (req, reply) => {
    const id = Number(req.params.id);
    try {
      updateVehicle(ports, id, req.body ?? {});
    } catch (error) {
      if (error instanceof VehicleNotFound) return reply.code(404).send({ error: 'Annonce inconnue.' });
      if (error instanceof UnknownStatus) return reply.code(400).send({ error: 'Statut inconnu.' });
      throw error;
    }
    const updated = store.getVehicle(id);
    if (!updated) return reply.code(404).send({ error: 'Annonce inconnue.' });
    return vehicleDto(updated, store.getSettings(), true);
  });

  // ---------- settings ----------
  app.get('/api/settings', async () => {
    const s = getSettings(ports);
    return { settings: maskSettings(s), variables: VARIABLE_HELP, families: FAMILIES.map((f) => ({ key: f, label: FAMILY_LABELS[f] })) };
  });

  app.put<{ Body: Partial<Settings> }>('/api/settings', async (req, reply) => {
    try {
      const { settings, preview, warning } = await updateSettings(settingsPorts, unmasked(req.body ?? {}, ports.settings.load()));
      return { settings: maskSettings(settings), preview, warning: warning === undefined ? null : zoneWarningText(warning) };
    } catch (error) {
      if (error instanceof InvalidSettings) return reply.code(400).send({ error: settingsProblemText(error.problem) });
      throw error;
    }
  });

  app.post<{ Body: Partial<Settings> }>('/api/settings/preview', async (req) => {
    try {
      return await previewSettings(settingsPorts, unmasked(req.body ?? {}, ports.settings.load()));
    } catch (error) {
      if (error instanceof InvalidSettings) return { error: settingsProblemText(error.problem), pass: 0, total: 0 };
      throw error;
    }
  });

  // ---------- templates ----------
  app.post<{ Body: { family?: Family; text?: string; vehicleId?: number } }>('/api/templates/preview', async (req) => {
    const settings = store.getSettings();
    const family = (req.body?.family ?? 'allemandes') as Family;
    const text = req.body?.text ?? settings.templates[family]?.variants[0] ?? '';
    let raw = SAMPLES[family] ?? SAMPLES.allemandes;
    let distance: number | null = 12;
    if (req.body?.vehicleId) {
      const v = store.getVehicle(req.body.vehicleId);
      const first = v ? store.firstListingOfVehicle(v.id) : undefined;
      if (v && first) {
        raw = { site: first.site, siteLabel: first.site_label, externalId: first.external_id, url: first.url, title: first.title, price: v.price ?? undefined, km: v.km ?? undefined, year: v.year ?? undefined, city: v.city ?? undefined, postalCode: v.postal_code ?? undefined };
        distance = v.distance_km;
      }
    }
    const info = extractVehicleInfo(raw, customBrandsOf(settings));
    return { text: render(text, buildVars(raw, info, settings, distance)), warnings: lintTemplate(text) };
  });

  // ---------- sources ----------
  app.get('/api/sources', async () => {
    const settings = store.getSettings();
    const runs = store.sourceRuns();
    const emails = store.recentEmails(60).map((e) => ({ ...e, parsed: e.parsed_json ? JSON.parse(e.parsed_json) as { announced?: number; kind?: string; moreUrl?: string } : null, parsed_json: undefined }));
    // The last email of each site that announced more ads than it showed: the rest waits on the site.
    const digests: Record<string, { at: string | null; announced: number; received: number; url: string | null; subject: string }> = {};
    for (const e of emails) {
      if (!e.site || digests[e.site] || !e.parsed?.announced || e.parsed.kind !== 'new' || e.parsed.announced <= e.parsed_count) continue;
      digests[e.site] = { at: e.received_at ?? e.processed_at, announced: e.parsed.announced, received: e.parsed_count, url: e.parsed.moreUrl ?? null, subject: e.subject };
    }
    return {
      imap: { host: settings.imap.host, port: settings.imap.port, user: settings.imap.user, hasPassword: Boolean(settings.imap.pass), mailbox: settings.imap.mailbox, configured: Boolean(settings.imap.user && settings.imap.pass), lastRun: runs.find((r) => r.source === 'email') ?? null },
      sites: siteSetups(settings).map((s) => {
        const alert = settings.alerts[s.key];
        return { ...s, done: Boolean(settings.alertsDone[s.key]), alert: alert ?? null, issues: alert ? alertMismatch(alert, settings) : [], advice: alert ? alertAdvice(alert, settings) : null, digest: digests[s.key] ?? null, targeted: targetedSearches(settings, s.key) };
      }),
      httpSites: settings.httpSites.map((s) => ({ ...s, lastRun: runs.find((r) => r.source === `http:${s.id}`) ?? null })),
      emails: emails.slice(0, 25),
    };
  });

  app.post<{ Body: { host?: string; port?: number; user?: string; pass?: string; mailbox?: string } }>('/api/sources/imap/test', async (req) => {
    const typed = req.body?.pass && req.body.pass !== MASKED_SECRET ? req.body.pass : '';
    return testMailbox(ports, { ...req.body, pass: typed });
  });

  app.post('/api/sources/check-now', async () => {
    const mail = await scheduler.runMail();
    const http = await scheduler.runHttp();
    return { mail, http };
  });

  app.post('/api/sources/reread', async () => {
    const mail = await scheduler.rereadAll();
    return { mail };
  });

  app.post('/api/maintenance/repair', async () => pipeline.repair(store.getSettings()));

  app.get('/api/import/token', async () => ({ token: importToken(ports) }));

  app.post<{ Body: { listings?: ImportedListing[]; notify?: boolean; token?: unknown } }>('/api/import', async (req, reply) => {
    if (sentByAnotherPage(req.headers['content-type']) && !acceptsImportToken(ports, tokenOf(req.body?.token))) return reply.code(401).send({ error: 'jeton invalide' });
    try {
      return await importListings(ports, { items: Array.isArray(req.body?.listings) ? req.body.listings : [], notify: req.body?.notify === true });
    } catch (error) {
      if (error instanceof NothingToImport) return reply.code(400).send({ error: 'Aucune annonce à importer.' });
      throw error;
    }
  });

  app.post<{ Body: { items?: ImportedPublicationDate[]; token?: unknown } }>('/api/import/dates', async (req, reply) => {
    if (sentByAnotherPage(req.headers['content-type']) && !acceptsImportToken(ports, tokenOf(req.body?.token))) return reply.code(401).send({ error: 'jeton invalide' });
    try {
      return recordPublishedDates(ports, Array.isArray(req.body?.items) ? req.body.items : []);
    } catch (error) {
      if (error instanceof NoDateToRecord) return reply.code(400).send({ error: 'Aucune date à enregistrer.' });
      throw error;
    }
  });

  app.post<{ Body: { url?: string } }>('/api/sources/http/test', async (req) => {
    const { ok, detail, sample } = await testHttpSite(ports, req.body?.url ?? '');
    if (sample === undefined) return { ok, detail };
    return { ok, detail, sample: sample.map((l) => ({ title: l.title, price: l.price, km: l.km, year: l.year, city: l.city, url: l.url })) };
  });

  // ---------- notifications ----------
  app.get('/api/push/key', async () => ({ key: pushPublicKey(ports) }));
  app.post<{ Body: { subscription?: PushSubscription } }>('/api/push/subscribe', async (req, reply) => {
    const sub = req.body?.subscription;
    if (!sub?.endpoint) return reply.code(400).send({ error: 'Abonnement invalide.' });
    return { ok: true, count: subscribe(ports, sub) };
  });
  app.post<{ Body: { endpoint?: string } }>('/api/push/unsubscribe', async (req) => {
    if (req.body?.endpoint) unsubscribe(ports, req.body.endpoint);
    return { ok: true };
  });
  app.post('/api/push/test', async () => sendTestPush(ports));
  app.post<{ Body: { token?: string; chatId?: string } }>('/api/telegram/test', async (req) =>
    sendTestTelegram(ports, { botToken: req.body?.token, chatId: req.body?.chatId }),
  );
}

function maskSettings(s: Settings): Settings {
  return { ...s, imap: { ...s.imap, pass: s.imap.pass ? MASKED_SECRET : '' } };
}

function unmasked(submitted: Partial<Settings>, current: Settings): Partial<Settings> {
  return {
    ...submitted,
    ...(submitted.imap?.pass === MASKED_SECRET ? { imap: { ...submitted.imap, pass: current.imap.pass } } : {}),
    ...(submitted.notifications?.telegramToken === MASKED_SECRET ? { notifications: { ...submitted.notifications, telegramToken: current.notifications.telegramToken } } : {}),
  };
}

function sentByAnotherPage(contentType: string | undefined): boolean {
  return (contentType ?? '').startsWith('text/plain');
}

function tokenOf(token: unknown): string {
  return typeof token === 'string' ? token : '';
}
