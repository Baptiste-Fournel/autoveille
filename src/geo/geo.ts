/** Distance and geocoding. Online: geo.api.gouv.fr (official, free). Offline fallback: built-in cities and département centroids. */

import type { LatLon } from '../domain/geo/distance.js';
import { fold } from '../domain/parsing/text.js';

export type { LatLon } from '../domain/geo/distance.js';
export { haversineKm } from '../domain/geo/distance.js';

// Approximate centroids, good enough for a 50 to 150 km radius decision.
const CITIES: Record<string, [number, number]> = {
  bordeaux: [44.8378, -0.5792], merignac: [44.8386, -0.6436], pessac: [44.8067, -0.6311], talence: [44.808, -0.5908], begles: [44.8086, -0.5478],
  'villenave d ornon': [44.78, -0.546], gradignan: [44.7725, -0.6153], 'le bouscat': [44.8653, -0.5997], bruges: [44.8833, -0.6111], eysines: [44.8847, -0.65],
  'saint medard en jalles': [44.8961, -0.7206], blanquefort: [44.9103, -0.6364], lormont: [44.8781, -0.5211], cenon: [44.8578, -0.5316], floirac: [44.8322, -0.5247],
  libourne: [44.915, -0.2436], arcachon: [44.6586, -1.1689], 'la teste de buch': [44.63, -1.145], 'andernos les bains': [44.7431, -1.1044], langon: [44.5547, -0.2497],
  pauillac: [45.1992, -0.7486], 'lesparre medoc': [45.3083, -0.9372], blaye: [45.1281, -0.6625], 'saint andre de cubzac': [44.9947, -0.4456], creon: [44.7739, -0.3472],
  'la brede': [44.6828, -0.5278], biganos: [44.6436, -0.9731], 'gujan mestras': [44.635, -1.0683], lacanau: [44.9781, -1.0797], cadillac: [44.6369, -0.3169],
  coutras: [45.0414, -0.1289], 'sainte foy la grande': [44.8403, 0.2158], 'castillon la bataille': [44.8533, -0.0394], hourtin: [45.1844, -1.0586], 'soulac sur mer': [45.5108, -1.1239],
  perigueux: [45.1846, 0.7214], bergerac: [44.8508, 0.4819], angouleme: [45.6484, 0.1562], cognac: [45.6958, -0.3292], saintes: [45.7464, -0.6322], royan: [45.6283, -1.0281],
  rochefort: [45.9425, -0.9586], 'la rochelle': [46.1591, -1.1517], jonzac: [45.4461, -0.4344], agen: [44.2033, 0.6167], marmande: [44.5, 0.165], 'villeneuve sur lot': [44.4083, 0.705],
  'mont de marsan': [43.8903, -0.4997], dax: [43.7103, -1.0531], biscarrosse: [44.3931, -1.1636], mimizan: [44.2011, -1.2305], bayonne: [43.4929, -1.4748], biarritz: [43.4832, -1.5586],
  pau: [43.2951, -0.3708], toulouse: [43.6047, 1.4442], limoges: [45.8336, 1.2611], poitiers: [46.5802, 0.3404], niort: [46.3237, -0.4648], nantes: [47.2184, -1.5536],
  'brive la gaillarde': [45.1589, 1.5329], tulle: [45.2672, 1.7719], cahors: [44.4475, 1.4406], montauban: [44.0176, 1.3551], auch: [43.6465, 0.5856], tarbes: [43.2328, 0.0781],
  nerac: [44.1358, 0.3394], paris: [48.8566, 2.3522], lyon: [45.764, 4.8357], marseille: [43.2965, 5.3698], lille: [50.6292, 3.0573], valenciennes: [50.357, 3.5235],
  montpellier: [43.6108, 3.8767], nice: [43.7102, 7.262], strasbourg: [48.5734, 7.7521], rennes: [48.1173, -1.6778], rouen: [49.4432, 1.0993], nancy: [48.6921, 6.1844],
  grenoble: [45.1885, 5.7245], dijon: [47.322, 5.0415], angers: [47.4784, -0.5632], 'le mans': [48.0061, 0.1996], reims: [49.2583, 4.0317], 'le havre': [49.4944, 0.1079],
  'saint etienne': [45.4397, 4.3872], toulon: [43.1242, 5.928], brest: [48.3904, -4.4861], tours: [47.3941, 0.6848], orleans: [47.9029, 1.9093], caen: [49.1829, -0.3707],
  'clermont ferrand': [45.7772, 3.087], metz: [49.1193, 6.1757], besancon: [47.2378, 6.0241], perpignan: [42.6887, 2.8948], amiens: [49.8941, 2.2958], nimes: [43.8367, 4.3601],
  avignon: [43.9493, 4.8055], 'la roche sur yon': [46.6705, -1.4269], vannes: [47.6582, -2.7608], quimper: [47.9961, -4.1024], 'saint nazaire': [47.2735, -2.2138],
};

const DEPARTMENTS: Record<string, [number, number]> = {
  '01': [46.1, 5.35], '02': [49.56, 3.56], '03': [46.39, 3.19], '04': [44.09, 6.24], '05': [44.66, 6.26], '06': [43.94, 7.12], '07': [44.75, 4.42], '08': [49.62, 4.64], '09': [42.92, 1.5],
  '10': [48.3, 4.16], '11': [43.1, 2.37], '12': [44.28, 2.68], '13': [43.54, 5.09], '14': [49.09, -0.36], '15': [45.05, 2.67], '16': [45.72, 0.2], '17': [45.78, -0.75], '18': [47.06, 2.49], '19': [45.36, 1.88],
  '20': [42.1, 9.1], '21': [47.42, 4.77], '22': [48.44, -2.86], '23': [46.09, 2.02], '24': [45.1, 0.74], '25': [47.17, 6.36], '26': [44.68, 5.17], '27': [49.11, 0.99], '28': [48.39, 1.37], '29': [48.24, -4.05],
  '30': [43.99, 4.18], '31': [43.36, 1.17], '32': [43.69, 0.45], '33': [44.83, -0.58], '34': [43.58, 3.37], '35': [48.16, -1.64], '36': [46.78, 1.58], '37': [47.26, 0.69], '38': [45.26, 5.57], '39': [46.73, 5.69],
  '40': [43.97, -0.78], '41': [47.62, 1.43], '42': [45.72, 4.17], '43': [45.13, 3.81], '44': [47.36, -1.68], '45': [47.91, 2.3], '46': [44.62, 1.6], '47': [44.37, 0.46], '48': [44.52, 3.5], '49': [47.39, -0.56],
  '50': [49.08, -1.33], '51': [48.95, 4.24], '52': [48.11, 5.23], '53': [48.15, -0.66], '54': [48.79, 6.17], '55': [49.01, 5.38], '56': [47.85, -2.81], '57': [49.04, 6.66], '58': [47.12, 3.5], '59': [50.45, 3.22],
  '60': [49.41, 2.42], '61': [48.62, 0.13], '62': [50.49, 2.29], '63': [45.73, 3.14], '64': [43.26, -0.76], '65': [43.05, 0.16], '66': [42.6, 2.52], '67': [48.67, 7.55], '68': [47.86, 7.27], '69': [45.87, 4.64],
  '70': [47.64, 6.09], '71': [46.64, 4.54], '72': [47.99, 0.22], '73': [45.48, 6.44], '74': [46.03, 6.43], '75': [48.86, 2.35], '76': [49.65, 1.03], '77': [48.63, 2.93], '78': [48.82, 1.84], '79': [46.55, -0.31],
  '80': [49.96, 2.28], '81': [43.78, 2.17], '82': [44.08, 1.28], '83': [43.46, 6.22], '84': [44.0, 5.19], '85': [46.67, -1.3], '86': [46.56, 0.46], '87': [45.89, 1.24], '88': [48.17, 6.38], '89': [47.84, 3.56],
  '90': [47.63, 6.93], '91': [48.52, 2.24], '92': [48.85, 2.24], '93': [48.92, 2.48], '94': [48.78, 2.47], '95': [49.08, 2.13],
};

export function offlineLookup(city?: string, postalCode?: string): { point: LatLon; precision: 'ville' | 'departement' } | undefined {
  if (city) {
    const c = CITIES[fold(city)];
    if (c) return { point: { lat: c[0], lon: c[1] }, precision: 'ville' };
  }
  const dept = postalCode?.slice(0, 2);
  if (dept && DEPARTMENTS[dept]) {
    const d = DEPARTMENTS[dept];
    return { point: { lat: d[0], lon: d[1] }, precision: 'departement' };
  }
  return undefined;
}

export interface GeocodeResult extends LatLon { precision: 'ville' | 'departement'; source: 'api' | 'offline' | 'cache' }

export interface GeoCache {
  get(key: string): GeocodeResult | undefined;
  set(key: string, value: GeocodeResult): void;
}

const memoryCache: GeoCache = (() => {
  const m = new Map<string, GeocodeResult>();
  return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v) };
})();

let fetchImpl: typeof fetch | null = globalThis.fetch;
/** Tests can disable network lookups. */
export function setGeoFetch(f: typeof fetch | null): void { fetchImpl = f; }

export async function geocode(city?: string, postalCode?: string, cache: GeoCache = memoryCache): Promise<GeocodeResult | undefined> {
  if (!city && !postalCode) return undefined;
  const key = `${fold(city ?? '')}|${postalCode ?? ''}`;
  const cached = cache.get(key);
  if (cached) return { ...cached, source: 'cache' };

  if (fetchImpl) {
    try {
      const params = new URLSearchParams({ fields: 'centre,codesPostaux', limit: '1', boost: 'population' });
      if (city) params.set('nom', city);
      if (postalCode) params.set('codePostal', postalCode);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetchImpl(`https://geo.api.gouv.fr/communes?${params}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const arr = (await res.json()) as Array<{ centre?: { coordinates: [number, number] } }>;
        const c = arr[0]?.centre?.coordinates;
        if (c) {
          const r: GeocodeResult = { lat: c[1], lon: c[0], precision: 'ville', source: 'api' };
          cache.set(key, r);
          return r;
        }
      }
    } catch {
      // offline or API down: fall through
    }
  }
  const off = offlineLookup(city, postalCode);
  if (off) {
    const r: GeocodeResult = { ...off.point, precision: off.precision, source: 'offline' };
    if (off.precision === 'ville') cache.set(key, r);
    return r;
  }
  return undefined;
}
