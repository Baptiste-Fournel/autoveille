import * as cheerio from 'cheerio';
import type { AlertInfo, Settings } from '../../types.js';
import { cleanText, fmtInt } from '../../listings/normalize.js';
import { SITES, siteForSender } from '../sites.js';
import { alertBounds } from '../links.js';

/** What a site confirmed when the person created the alert there. Stored in the settings, shown in the Sites screen. */
export type AlertConfirmation = AlertInfo;

interface Input { from: string; subject: string; html?: string; text?: string; date?: Date }

function visibleText(input: Input): { text: string; links: Array<{ text: string; href: string }> } {
  if (input.html) {
    const $ = cheerio.load(input.html);
    $('script, style, head').remove();
    const parts: string[] = [];
    $('body *').each((_i, el) => { el.children?.forEach((c) => { if (c.type === 'text') parts.push((c as unknown as { data: string }).data); }); });
    const text = cleanText(parts.join(' ').replace(/[​-‏͏­]/g, ''));
    const links = $('a[href]').map((_i, a) => ({ text: cleanText($(a).text()), href: ($(a).attr('href') ?? '').trim() })).get();
    return { text, links };
  }
  return { text: cleanText(input.text ?? ''), links: [] };
}

const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const n = Number(s.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Recognises the email a site sends when an alert is created, and reads the criteria it states.
 * Formats checked on the real emails of 14/10/2026; a site that changes its wording is simply not detected,
 * the person can still tick the box by hand.
 */
export function detectAlertConfirmation(input: Input): AlertConfirmation | undefined {
  const site = siteForSender(input.from);
  if (!site) return undefined;
  const subject = cleanText(input.subject);
  const { text, links } = visibleText(input);
  const confirmedAt = (input.date ?? new Date()).toISOString();
  const base = { site: site.key, confirmedAt, manageUrl: site.manageUrl };

  if (site.key === 'lacentrale') {
    if (!/alerte est (confirmée|activée)/i.test(text) && !/création de votre alerte/i.test(subject)) return undefined;
    if (!/recherche de véhicule est enregistrée|alerte est activée/i.test(text)) return undefined;
    const maxKm = num(/Kilom[ée]trage\s*\.*\s*([\d\s]{3,9})\s*km/iu.exec(text)?.[1]);
    const postalCode = /Localisation\s*\.*\s*(\d{5})/iu.exec(text)?.[1];
    const radiusKm = num(/rayon de\s*(\d+)\s*km/iu.exec(text)?.[1]);
    const seller = /Type de vendeur\s*\.*\s*(Particulier|Professionnel)/iu.exec(text)?.[1]?.toLowerCase();
    const bits = [maxKm ? `${fmtInt(maxKm)} km max` : '', postalCode ? `${postalCode}${radiusKm ? ` (rayon de ${radiusKm} km)` : ''}` : '', seller ? (seller === 'particulier' ? 'particuliers' : 'professionnels') : ''].filter(Boolean);
    return { ...base, criteria: bits.join(', ') || 'Alerte activée', maxKm, postalCode, radiusKm, sellerType: seller === 'particulier' ? 'particulier' : seller === 'professionnel' ? 'pro' : undefined };
  }

  if (site.key === 'paruvendu') {
    if (!/confirmation de la création de votre alerte/i.test(subject) && !/confirmons l'enregistrement de votre alerte/i.test(text)) return undefined;
    const m = /Vos critères de recherche\s*:\s*(.+?)(?=\s*»|\s*Voir les annonces|$)/iu.exec(text);
    const rawCriteria = m?.[1] ?? '';
    const radiusKm = num(/Rayon de\s*(\d+)\s*km/iu.exec(rawCriteria)?.[1]);
    const maxKm = num(/Jusqu'à\s*([\d\s]{3,9})\s*km/iu.exec(rawCriteria)?.[1]);
    const postalCode = /\((\d{5})\)/.exec(rawCriteria)?.[1];
    // "Voiture d'occasion Bordeaux (33000) Rayon de 100 km Jusqu'à 100 000 km" -> comma-separated parts
    const criteria = rawCriteria
      .replace(/\s+(Bordeaux|[A-ZÉÈ][\p{L}' -]+ \(\d{5}\))/u, ', $1')
      .replace(/\s+(Rayon de)/i, ', $1')
      .replace(/\s+(Jusqu'à)/i, ', $1')
      .replace(/\s*,\s*/g, ', ').trim();
    const manage = links.find((l) => /modifier votre alerte/i.test(l.text))?.href;
    return { ...base, criteria: criteria || 'Alerte enregistrée', radiusKm, maxKm, postalCode, manageUrl: manage || site.manageUrl };
  }

  if (site.key === 'autoscout24') {
    if (!/recherche a bien été enregistrée/i.test(subject) && !/a été enregistrée\. Reçois/i.test(text)) return undefined;
    const name = /Ta recherche\s+(.+?)\s+a été enregistrée/iu.exec(text)?.[1];
    return { ...base, criteria: name ? `Recherche « ${name} » enregistrée` : 'Recherche enregistrée' };
  }

  if (site.key === 'leboncoin') {
    if (!/(alerte|recherche)/i.test(subject) || !/(créée|enregistrée|activée|sauvegardée)/i.test(`${subject} ${text}`)) return undefined;
    const m = /crit[èe]res?\s*:?\s*(.{10,200}?)(?:\.\s|$)/iu.exec(text);
    const radiusKm = num(/(\d+)\s*km autour/iu.exec(text)?.[1]);
    const maxKm = num(/(?:jusqu'à|max(?:imum)?)\s*:?\s*([\d\s]{3,9})\s*km/iu.exec(text)?.[1]);
    return { ...base, criteria: m?.[1]?.trim() || 'Recherche sauvegardée', radiusKm, maxKm };
  }

  // Other sites: a subject that speaks of a created alert is enough.
  if (/alerte/i.test(subject) && /(créée|enregistrée|activée|confirmée)/i.test(`${subject} ${text}`)) return { ...base, criteria: 'Alerte créée' };
  return undefined;
}

/** Differences between what the site will send and what the app expects, in plain French. Empty when the alert covers the settings. */
export function alertMismatch(a: AlertConfirmation, settings: Settings): string[] {
  const out: string[] = [];
  if (a.radiusKm && settings.zone.radiusKm > 0 && a.radiusKm < settings.zone.radiusKm) {
    out.push(`L’alerte du site ne couvre que ${a.radiusKm} km autour de la ville, vos réglages vont jusqu’à ${settings.zone.radiusKm} km : les annonces entre les deux n’arriveront jamais.`);
  }
  if (a.maxKm && settings.maxKm > 0 && a.maxKm < settings.maxKm) {
    out.push(`L’alerte du site s’arrête à ${fmtInt(a.maxKm)} km au compteur, vos réglages acceptent jusqu’à ${fmtInt(settings.maxKm)} km.`);
  }
  return out;
}

/** When the alert is no wider than the settings, a hint to open the net: the app sorts, the rest stays readable. */
export function alertAdvice(a: AlertConfirmation, settings: Settings): string | undefined {
  const b = alertBounds(settings);
  const tight: string[] = [];
  if (a.radiusKm && settings.zone.radiusKm > 0 && a.radiusKm <= settings.zone.radiusKm) tight.push(`${b.radiusKm} km de rayon`);
  if (a.maxKm && settings.maxKm > 0 && a.maxKm <= settings.maxKm) tight.push(`${fmtInt(b.maxKm)} km au compteur`);
  if (!tight.length) return undefined;
  return `Cette alerte est réglée au plus juste. Vous pouvez l’élargir (${tight.join(', ')}) : l’application garde votre tri, et les annonces écartées restent consultables au cas où une bonne affaire s’y cache.`;
}

export function siteLabel(key: string): string {
  return SITES.find((s) => s.key === key)?.label ?? key;
}
