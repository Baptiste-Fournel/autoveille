import { describe, expect, it } from 'vitest';
import { buildVars, composeMessage, lintTemplate, pickVariant, render } from './templates.js';
import { defaultSettings } from '../listings/defaults.js';
import { extractVehicleInfo } from '../listings/normalize.js';
import type { RawListing } from '../types.js';

const settings = defaultSettings();
settings.dealer = { firstName: 'Jean', lastName: 'Dupont', company: 'Garage du Lac', city: 'Mérignac', phone: '06 12 34 56 78' };

const raw: RawListing = { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: '1', url: 'https://x/1', title: 'Porsche 911 Carrera S 2015 42 000 km 89 900 €', city: 'Pessac' };

describe('templates', () => {
  it('fills variables', () => {
    const out = render('Bonjour, votre {modele} {annee} sur {site}. Je suis {prenom}. Tel {telephone}.', buildVars(raw, extractVehicleInfo(raw), settings, 12));
    expect(out).toBe('Bonjour, votre Porsche 911 Carrera S 2015 sur Leboncoin. Je suis Jean. Tel 06 12 34 56 78.');
  });

  it('drops a sentence whose variable is missing rather than leaving a hole', () => {
    const noKm: RawListing = { ...raw, title: 'Porsche 911 Carrera S 2015' };
    const out = render('Je viens de voir votre {modele}. Une {modele} avec {km} km, ça part vite. On en parle ?', buildVars(noKm, extractVehicleInfo(noKm), settings));
    expect(out).toBe('Je viens de voir votre Porsche 911 Carrera S. On en parle ?');
  });

  it('is stable per vehicle and spreads variants', () => {
    const a = pickVariant('allemandes', settings, 'abc');
    expect(pickVariant('allemandes', settings, 'abc')).toBe(a);
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => pickVariant('allemandes', settings, s)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('composes a full message with no AI tells', () => {
    const msg = composeMessage(raw, extractVehicleInfo(raw), settings, 'seed', 12);
    expect(msg).toContain('Porsche 911 Carrera S');
    expect(msg).toContain('06 12 34 56 78');
    expect(msg).toContain('Garage du Lac');
    expect(msg).not.toMatch(/\{\w+\}/);
    expect(lintTemplate(msg)).toEqual([]);
  });

  it('every default template variant passes the lint', () => {
    for (const fam of ['allemandes', 'italiennes', 'americaines', 'francaises'] as const) {
      for (const v of settings.templates[fam].variants) expect(lintTemplate(v)).toEqual([]);
    }
  });

  it('flags dashes, emoji and stock phrases', () => {
    expect(lintTemplate('Bonjour — n\'hésitez pas 🙂 {telephone}, je n\'insisterai pas.').length).toBe(3);
  });

  it('asks for the opt-out sentence and a way to be reached', () => {
    const w = lintTemplate('Bonjour, votre {modele} est belle.');
    expect(w.some((x) => /joindre/.test(x))).toBe(true);
    expect(w.some((x) => /insisterez pas/.test(x))).toBe(true);
    expect(lintTemplate('Appelez-moi au {telephone}. Sinon je ne reviendrai pas vers vous.')).toEqual([]);
  });
});
