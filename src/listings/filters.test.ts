import { describe, expect, it } from 'vitest';
import { evaluate, specialReason } from './filters.js';
import { extractVehicleInfo } from './normalize.js';
import { defaultSettings } from './defaults.js';
import type { RawListing } from '../types.js';

const raw = (title: string, extra: Partial<RawListing> = {}): RawListing => ({ site: 'test', siteLabel: 'Test', externalId: '1', url: 'https://x/1', title, sellerType: 'particulier', ...extra });

describe('filters', () => {
  const settings = defaultSettings();

  it('accepts a Porsche 911 from a private seller under 100 000 km in the zone', () => {
    const r = raw('Porsche 911 Carrera S 2015 42 000 km 89 900 €');
    const v = evaluate(r, extractVehicleInfo(r), settings, { distanceKm: 12 });
    expect(v.pass).toBe(true);
  });

  it('rejects professionals when private only', () => {
    const r = raw('Porsche 911 Carrera S 2015 42 000 km 89 900 €', { sellerType: 'pro' });
    const v = evaluate(r, extractVehicleInfo(r), settings, { distanceKm: 12 });
    expect(v.pass).toBe(false);
    expect(v.reasons.join()).toMatch(/professionnel/);
  });

  it('rejects high mileage and far away cars with readable reasons', () => {
    const r = raw('Porsche 911 Carrera S 2015 142 000 km 59 900 €');
    const v = evaluate(r, extractVehicleInfo(r), settings, { distanceKm: 180 });
    expect(v.pass).toBe(false);
    expect(v.reasons).toHaveLength(2);
    expect(v.reasons[0]).toMatch(/142 000 km/);
    expect(v.reasons[1]).toMatch(/180 km/);
  });

  it('applies the supercar/collection rule per family', () => {
    const a = raw('Audi A3 Sportback 2019 35 000 km 22 000 €');
    expect(evaluate(a, extractVehicleInfo(a), settings, {}).reasons.join()).toMatch(/ni supercar/);
    const rs = raw('Audi RS6 Avant 2019 35 000 km');
    expect(evaluate(rs, extractVehicleInfo(rs), settings, {}).pass).toBe(true);
    const old = raw('Mercedes 280 SL Pagode 1969 85 000 km 95 000 €');
    expect(specialReason('allemandes', extractVehicleInfo(old), old, settings)).toMatch(/prix|année/);
    const clio = raw('Renault Clio 1.2 2016 60 000 km 7 500 €');
    expect(evaluate(clio, extractVehicleInfo(clio), settings, {}).pass).toBe(false);
    const clioV6 = raw('Renault Clio V6 Phase 2 2004 60 000 km');
    expect(evaluate(clioV6, extractVehicleInfo(clioV6), settings, {}).pass).toBe(true);
    const alpine = raw('Alpine A110 Légende 2019 20 000 km');
    expect(evaluate(alpine, extractVehicleInfo(alpine), settings, {}).pass).toBe(true);
    const ferrari = raw('Ferrari 360 Modena 2001 45 000 km');
    expect(evaluate(ferrari, extractVehicleInfo(ferrari), settings, {}).pass).toBe(true);
    const giulietta = raw('Alfa Romeo Giulietta 1.6 JTDm 2014 90 000 km 9 000 €');
    expect(evaluate(giulietta, extractVehicleInfo(giulietta), settings, {}).pass).toBe(false);
    const mustang = raw('Ford Mustang GT 5.0 2018 30 000 km 42 000 €');
    expect(evaluate(mustang, extractVehicleInfo(mustang), settings, {}).pass).toBe(true);
    const fiesta = raw('Ford Fiesta 1.0 2018 30 000 km 12 000 €');
    expect(evaluate(fiesta, extractVehicleInfo(fiesta), settings, {}).pass).toBe(false);
  });

  it('lets everything of an enabled brand through when the special rule is off', () => {
    const s = { ...settings, specialOnly: false };
    const a = raw('Audi A3 Sportback 2019 35 000 km 22 000 €');
    expect(evaluate(a, extractVehicleInfo(a), s, {}).pass).toBe(true);
  });

  it('respects disabled brands', () => {
    const s = defaultSettings();
    s.families.allemandes.brands = s.families.allemandes.brands.filter((b) => b !== 'Audi');
    const rs = raw('Audi RS6 Avant 2019 35 000 km');
    expect(evaluate(rs, extractVehicleInfo(rs), s, {}).reasons.join()).toMatch(/Audi désactivée/);
  });

  it('does not reject when km or distance are unknown', () => {
    const r = raw('Porsche 911 Carrera 1998');
    expect(evaluate(r, extractVehicleInfo(r), settings, { distanceKm: null }).pass).toBe(true);
  });
});
