import type { Family, RawListing, Settings, VehicleInfo } from '../types.js';

export interface MessageVars {
  marque: string;
  modele: string;
  annee: string;
  km: string;
  prix: string;
  ville: string;
  site: string;
  distance: string;
  prenom: string;
  nom: string;
  concession: string;
  ville_concession: string;
  telephone: string;
}

export const VARIABLE_HELP: Record<keyof MessageVars, string> = {
  marque: 'la marque (Porsche)',
  modele: 'le modèle (911 Carrera S)',
  annee: "l'année de l'annonce",
  km: 'le kilométrage',
  prix: 'le prix affiché',
  ville: 'la ville du vendeur',
  site: 'le site où l\'annonce est parue',
  distance: 'la distance en km avec la concession',
  prenom: 'votre prénom',
  nom: 'votre nom',
  concession: 'le nom de la concession',
  ville_concession: 'la ville de la concession',
  telephone: 'votre téléphone',
};

function fmtInt(n: number | undefined): string {
  return n === undefined ? '' : n.toLocaleString('fr-FR').replace(/ /g, ' ');
}

export function buildVars(raw: RawListing, info: VehicleInfo, settings: Settings, distanceKm?: number | null): MessageVars {
  const modele = [info.make, info.model].filter(Boolean).join(' ') || raw.title;
  return {
    marque: info.make ?? '',
    modele,
    annee: info.year ? String(info.year) : '',
    km: fmtInt(info.km),
    prix: info.price !== undefined ? `${fmtInt(info.price)} €` : '',
    ville: raw.city ?? '',
    site: raw.siteLabel,
    distance: distanceKm !== undefined && distanceKm !== null ? String(Math.round(distanceKm)) : '',
    prenom: settings.dealer.firstName,
    nom: settings.dealer.lastName,
    concession: settings.dealer.company,
    ville_concession: settings.dealer.city,
    telephone: settings.dealer.phone,
  };
}

/**
 * Fill a template. When a variable is empty, the sentence that contains it is dropped rather than
 * leaving "avec  km" in the text; if the whole paragraph empties, it goes too.
 */
export function render(template: string, vars: MessageVars): string {
  const paragraphs = template.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const out: string[] = [];
  for (const para of paragraphs) {
    const lines = para.split('\n').map((line) => {
      // Signature lines are kept as is (names), other lines are split into sentences.
      const sentences = line.split(/(?<=[.!?])\s+/);
      const kept = sentences
        .map((s) => {
          let missing = false;
          const filled = s.replace(/\{(\w+)\}/g, (_m, key: string) => {
            const v = vars[key as keyof MessageVars];
            if (v === undefined || v === '') { missing = true; return ''; }
            return v;
          });
          return missing && sentences.length > 1 ? null : filled;
        })
        .filter((s): s is string => s !== null && s.trim() !== '');
      return kept.join(' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
    }).filter((l) => l !== '');
    if (lines.length) out.push(lines.join('\n'));
  }
  return out.join('\n\n');
}

/** Pick the variant deterministically for a vehicle, so the same car always gets the same text. */
export function pickVariant(family: Family, settings: Settings, seed: string): string {
  const variants = settings.templates[family]?.variants?.filter((v) => v.trim()) ?? [];
  if (!variants.length) return '';
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return variants[h % variants.length] ?? '';
}

export function composeMessage(raw: RawListing, info: VehicleInfo, settings: Settings, seed: string, distanceKm?: number | null): string {
  const family = info.family === 'autres' ? 'allemandes' : info.family;
  const tpl = pickVariant(family, settings, seed);
  return render(tpl, buildVars(raw, info, settings, distanceKm));
}

/** Guard against text that reads like it was machine generated: long dashes, emoji, bullet characters. */
export function lintTemplate(text: string): string[] {
  const warnings: string[] = [];
  if (/[—–]/.test(text)) warnings.push('Contient un tiret long (— ou –) : à remplacer par une virgule ou un point.');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) warnings.push('Contient un émoji.');
  if (/^\s*[-*•]\s/m.test(text)) warnings.push('Contient une liste à puces.');
  if (/n'hésitez pas|je me permets|dans le cadre de|je reste à votre (entière )?disposition/i.test(text)) warnings.push('Formule toute faite repérée (« n\'hésitez pas », « je me permets »…), à reformuler.');
  if (!/\{telephone\}/.test(text) && !/\d{2}[ .]?\d{2}[ .]?\d{2}[ .]?\d{2}[ .]?\d{2}/.test(text)) warnings.push('Aucun moyen de vous joindre dans le message : la loi impose une coordonnée valable pour demander l\'arrêt des envois.');
  if (!/n['’]insisterai pas|ne (vous )?relancerai pas|ne (vous )?recontacterai pas|ne reviendrai pas vers vous|pas de relance|sans suite de ma part|ne vous solliciterai plus|sans insister/i.test(text)) warnings.push('Le message ne dit pas que vous n\'insisterez pas si le vendeur ne répond pas : c\'est la phrase qui vous met en règle quand vous contactez un particulier.');
  return warnings;
}
