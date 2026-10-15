import { cleanText } from '../parsing/text.js';
import {
  autoScout24CriteriaText,
  LEBONCOIN_SEARCH_SAVED,
  laCentraleCriteriaText,
  OTHER_SITE_ALERT_CREATED,
  PARUVENDU_ALERT_SAVED,
} from '../presentation/alerts.js';
import type { AlertInfo, Settings } from '../settings/types.js';
import { alertBounds } from './alertSetup.js';
import { siteForSender } from './catalog.js';

export interface EmailLink {
  readonly text: string;
  readonly href: string;
}

export interface ExtractedEmail {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly links: readonly EmailLink[];
  readonly date: Date;
}

export interface LaCentraleCriteria {
  readonly maxKm?: number;
  readonly postalCode?: string;
  readonly radiusKm?: number;
  readonly sellerType?: 'particulier' | 'pro';
}

export type AlertMismatch =
  | { readonly kind: 'radiusNarrower'; readonly alertRadiusKm: number; readonly settingsRadiusKm: number }
  | { readonly kind: 'mileageNarrower'; readonly alertMaxKm: number; readonly settingsMaxKm: number };

export interface AlertWidening {
  readonly radiusKm?: number;
  readonly maxKm?: number;
}

interface ConfirmationBase {
  readonly site: string;
  readonly confirmedAt: string;
  readonly manageUrl?: string;
}

interface ReadableEmail {
  readonly subject: string;
  readonly text: string;
  readonly links: readonly EmailLink[];
}

const SITE_MAX_RADIUS_KM: Readonly<Record<string, number>> = { paruvendu: 100 };

function positiveNumber(digits: string | undefined): number | undefined {
  if (!digits) {
    return undefined;
  }
  const value = Number(digits.replace(/[^\d]/g, ''));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function laCentraleConfirmation({ subject, text }: ReadableEmail, base: ConfirmationBase): AlertInfo | undefined {
  if (!/alerte est (confirmée|activée)/i.test(text) && !/création de votre alerte/i.test(subject)) {
    return undefined;
  }
  if (!/recherche de véhicule est enregistrée|alerte est activée/i.test(text)) {
    return undefined;
  }
  const maxKm = positiveNumber(/Kilom[ée]trage\s*\.*\s*([\d\s]{3,9})\s*km/iu.exec(text)?.[1]);
  const postalCode = /Localisation\s*\.*\s*(\d{5})/iu.exec(text)?.[1];
  const radiusKm = positiveNumber(/rayon de\s*(\d+)\s*km/iu.exec(text)?.[1]);
  const seller = /Type de vendeur\s*\.*\s*(Particulier|Professionnel)/iu.exec(text)?.[1]?.toLowerCase();
  const sellerType = seller === 'particulier' ? 'particulier' : seller === 'professionnel' ? 'pro' : undefined;
  return {
    ...base,
    criteria: laCentraleCriteriaText({ maxKm, postalCode, radiusKm, sellerType }),
    maxKm,
    postalCode,
    radiusKm,
    sellerType,
  };
}

const paruVenduCriteriaList = (sentence: string): string =>
  sentence
    .replace(/\s+(Bordeaux|[A-ZÉÈ][\p{L}' -]+ \(\d{5}\))/u, ', $1')
    .replace(/\s+(Rayon de)/i, ', $1')
    .replace(/\s+(Jusqu'à)/i, ', $1')
    .replace(/\s*,\s*/g, ', ')
    .trim();

function paruVenduConfirmation({ subject, text, links }: ReadableEmail, base: ConfirmationBase): AlertInfo | undefined {
  if (!/confirmation de la création de votre alerte/i.test(subject) && !/confirmons l'enregistrement de votre alerte/i.test(text)) {
    return undefined;
  }
  const sentence = /Vos critères de recherche\s*:\s*(.+?)(?=\s*»|\s*Voir les annonces|$)/iu.exec(text)?.[1] ?? '';
  const radiusKm = positiveNumber(/Rayon de\s*(\d+)\s*km/iu.exec(sentence)?.[1]);
  const maxKm = positiveNumber(/Jusqu'à\s*([\d\s]{3,9})\s*km/iu.exec(sentence)?.[1]);
  const postalCode = /\((\d{5})\)/.exec(sentence)?.[1];
  const modifyLink = links.find((link) => /modifier votre alerte/i.test(link.text))?.href;
  return {
    ...base,
    criteria: paruVenduCriteriaList(sentence) || PARUVENDU_ALERT_SAVED,
    radiusKm,
    maxKm,
    postalCode,
    manageUrl: modifyLink || base.manageUrl,
  };
}

function autoScout24Confirmation({ subject, text }: ReadableEmail, base: ConfirmationBase): AlertInfo | undefined {
  if (!/recherche a bien été enregistrée/i.test(subject) && !/a été enregistrée\. Reçois/i.test(text)) {
    return undefined;
  }
  const searchName = /Ta recherche\s+(.+?)\s+a été enregistrée/iu.exec(text)?.[1];
  return { ...base, criteria: autoScout24CriteriaText(searchName) };
}

function leboncoinConfirmation({ subject, text }: ReadableEmail, base: ConfirmationBase): AlertInfo | undefined {
  if (!/(alerte|recherche)/i.test(subject) || !/(créée|enregistrée|activée|sauvegardée)/i.test(`${subject} ${text}`)) {
    return undefined;
  }
  const criteria = /crit[èe]res?\s*:?\s*(.{10,200}?)(?:\.\s|$)/iu.exec(text)?.[1]?.trim();
  const radiusKm = positiveNumber(/(\d+)\s*km autour/iu.exec(text)?.[1]);
  const maxKm = positiveNumber(/(?:jusqu'à|max(?:imum)?)\s*:?\s*([\d\s]{3,9})\s*km/iu.exec(text)?.[1]);
  return { ...base, criteria: criteria || LEBONCOIN_SEARCH_SAVED, radiusKm, maxKm };
}

function otherSiteConfirmation({ subject, text }: ReadableEmail, base: ConfirmationBase): AlertInfo | undefined {
  const speaksOfACreatedAlert = /alerte/i.test(subject) && /(créée|enregistrée|activée|confirmée)/i.test(`${subject} ${text}`);
  return speaksOfACreatedAlert ? { ...base, criteria: OTHER_SITE_ALERT_CREATED } : undefined;
}

export function detectAlertConfirmation(email: ExtractedEmail): AlertInfo | undefined {
  const site = siteForSender(email.from);
  if (!site) {
    return undefined;
  }
  const readable = { subject: cleanText(email.subject), text: cleanText(email.text), links: email.links };
  const base = { site: site.key, confirmedAt: email.date.toISOString(), manageUrl: site.manageAlertUrl };
  switch (site.key) {
    case 'lacentrale':
      return laCentraleConfirmation(readable, base);
    case 'paruvendu':
      return paruVenduConfirmation(readable, base);
    case 'autoscout24':
      return autoScout24Confirmation(readable, base);
    case 'leboncoin':
      return leboncoinConfirmation(readable, base);
    default:
      return otherSiteConfirmation(readable, base);
  }
}

export function alertMismatch(alert: AlertInfo, settings: Settings): readonly AlertMismatch[] {
  const settingsRadiusKm = settings.zone.radiusKm;
  const settingsMaxKm = settings.maxKm;
  const radius: readonly AlertMismatch[] =
    alert.radiusKm && settingsRadiusKm > 0 && alert.radiusKm < settingsRadiusKm
      ? [{ kind: 'radiusNarrower', alertRadiusKm: alert.radiusKm, settingsRadiusKm }]
      : [];
  const mileage: readonly AlertMismatch[] =
    alert.maxKm && settingsMaxKm > 0 && alert.maxKm < settingsMaxKm
      ? [{ kind: 'mileageNarrower', alertMaxKm: alert.maxKm, settingsMaxKm }]
      : [];
  return [...radius, ...mileage];
}

export function alertAdvice(alert: AlertInfo, settings: Settings): AlertWidening | undefined {
  const bounds = alertBounds(settings);
  const siteMaxRadiusKm = SITE_MAX_RADIUS_KM[alert.site];
  const radiusAtSiteMaximum = Boolean(siteMaxRadiusKm && alert.radiusKm && alert.radiusKm >= siteMaxRadiusKm);
  const radiusTight =
    Boolean(alert.radiusKm && settings.zone.radiusKm > 0 && alert.radiusKm <= settings.zone.radiusKm) && !radiusAtSiteMaximum;
  const mileageTight = Boolean(alert.maxKm && settings.maxKm > 0 && alert.maxKm <= settings.maxKm);
  if (!radiusTight && !mileageTight) {
    return undefined;
  }
  return { radiusKm: radiusTight ? bounds.radiusKm : undefined, maxKm: mileageTight ? bounds.maxKm : undefined };
}
