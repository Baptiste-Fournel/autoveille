/* AutoVeille — interface. Pas de framework : un petit routeur par ancre (#/annonces, #/reglages, #/messages, #/sources),
   des fonctions de rendu par écran, et des appels à l'API du serveur. */

// ---------- utilitaires ----------
const $app = document.getElementById('app');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k in node && k !== 'style' && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  // Children may be nested arrays (a map returning pairs): flattened all the way down.
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

const ICONS = {
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11"/><path d="M3 11h18v6a1 1 0 0 1-1 1h-1.5a1.5 1.5 0 0 1-3 0h-7a1.5 1.5 0 0 1-3 0H4a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="14.5" r="1"/><circle cx="16.5" cy="14.5" r="1"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h14"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/><circle cx="20" cy="12" r="2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l2.5-8h13L21 13v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 8.5l3 3"/></svg>',
  logo: '<svg viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="#1F5E3C"/><path d="M8 19l2.2-5.2A2 2 0 0 1 12 12.5h8a2 2 0 0 1 1.8 1.2L24 19" stroke="#F2C94C" stroke-width="2" stroke-linecap="round"/><path d="M6.5 19h19v4h-2.2a1.8 1.8 0 0 1-3.6 0h-7.4a1.8 1.8 0 0 1-3.6 0H6.5z" fill="#F2C94C"/></svg>',
};
const svg = (name, cls) => { const s = el('span', { class: cls || '', html: ICONS[name] }); return s.firstChild; };

/** Short confirmation at the bottom of the screen. With `undo`, an « Annuler » button stays six seconds. */
function toast(message, error = false, undo) {
  const t = document.getElementById('toast');
  t.replaceChildren(document.createTextNode(message));
  if (undo) t.append(el('button', { class: 'undo', type: 'button', onclick: async () => { t.className = ''; try { await undo(); } catch (e) { toast(e.message, true); } } }, 'Annuler'));
  t.className = 'show' + (error ? ' error' : '') + (undo ? ' with-undo' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className = ''; }, undo ? 6000 : error ? 5000 : 2600);
}

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  let data = null;
  try { data = await res.json(); } catch { /* vide */ }
  if (res.status === 401) { state.me = { authenticated: false, needsSetup: data?.needsSetup }; render(); throw new Error('Connexion expirée, reconnectez-vous.'); }
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
  return data;
}

const fmt = {
  int: (n) => (n === null || n === undefined ? '' : Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ')),
  ago(iso) {
    if (!iso) return '';
    const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'à l’instant';
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400 && d.getDate() === new Date().getDate()) return `aujourd’hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    if (diff < 172800) return `hier à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  },
  plural: (n, s, p) => `${fmt.int(n)} ${n > 1 ? p : s}`,
  /** Lower case without accents, for searching. */
  fold: (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(),
  /** "il y a 3 j" style, for how long a contact has been waiting. */
  days(iso) {
    if (!iso) return '';
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
    return d <= 0 ? 'aujourd’hui' : d === 1 ? 'hier' : `il y a ${d} j`;
  },
};

/** Like node.append, but skips null/false (the native append would write the text "null"). */
const append = (node, ...children) => { for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) node.append(c); return node; };

const clone = (o) => JSON.parse(JSON.stringify(o));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- état ----------
const state = {
  me: null,
  route: '',
  overview: null,
  vehicles: [],
  filter: 'nouveau',
  settings: null,
  draft: null,
  settingsMeta: null,
  preview: null,
  sources: null,
  pushStatus: 'inconnu',
  busy: false,
  pendingConfirm: null, // id de l'annonce dont on attend « message envoyé ? », pour survivre à un rafraîchissement
  search: '',
};

/** Per-device preferences (a hidden checklist, say). Browser storage can be unavailable: every access is guarded. */
const prefs = {
  get: (k) => { try { return localStorage.getItem('av_' + k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem('av_' + k, v); } catch { /* ignoré */ } },
};

// ---------- routeur ----------
function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, arg] = h.split('/');
  return { name: name || 'annonces', arg };
}
window.addEventListener('hashchange', () => render());

// ---------- rendu principal ----------
async function render() {
  if (!state.me) {
    try { state.me = await api('GET', '/api/me'); } catch { state.me = { authenticated: false }; }
  }
  if (!state.me.authenticated) { $app.replaceChildren(renderLogin()); return; }
  const route = currentRoute();
  const sameScreen = state.route === route.name && state.routeArg === route.arg;
  const y = window.scrollY;
  state.route = route.name; state.routeArg = route.arg;
  const views = { annonces: renderAnnonces, reglages: renderReglages, messages: renderMessages, sources: renderSources, annonce: renderAnnonceDetail, rafale: renderRafale };
  const view = views[route.name] || renderAnnonces;
  const content = await view(route);
  $app.replaceChildren(renderShell(content));
  // A refresh of the same screen keeps the reading position; a new screen starts at the top.
  window.scrollTo({ top: sameScreen ? y : 0 });
}

function navLinks() {
  const n = state.overview?.counts?.nouveau || 0;
  const items = [
    ['annonces', 'Annonces', 'car', n],
    ['reglages', 'Réglages', 'sliders'],
    ['messages', 'Messages', 'chat'],
    ['sources', 'Sites', 'inbox'],
  ];
  const active = state.route === 'annonce' || state.route === 'rafale' ? 'annonces' : state.route;
  const top = el('nav', { class: 'nav', 'aria-label': 'Navigation' }, items.map(([r, label, , count]) =>
    el('a', { href: `#/${r}`, 'aria-current': active === r ? 'page' : null }, label, count ? el('span', { class: 'badge count' }, count) : null)));
  const bottom = el('nav', { class: 'tabbar', 'aria-label': 'Navigation' }, items.map(([r, label, icon, count]) =>
    el('a', { href: `#/${r}`, 'aria-current': active === r ? 'page' : null }, svg(icon), label, count ? el('span', { class: 'badge count' }, count) : null)));
  return { top, bottom };
}

function renderShell(content) {
  const { top, bottom } = navLinks();
  return el('div', { class: 'shell' },
    el('header', { class: 'topbar' }, el('div', { class: 'brand' }, svg('logo'), 'AutoVeille'), top),
    el('main', { class: 'view' }, content),
    bottom,
  );
}

// ---------- connexion ----------
function renderLogin() {
  const setup = state.me.needsSetup;
  const needCode = setup && state.me.setupCodeRequired !== false;
  const form = el('form', { class: 'card', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      if (setup) await api('POST', '/api/setup', { setupCode: fd.get('code') || '', password: fd.get('password') });
      else await api('POST', '/api/login', { password: fd.get('password') });
      state.me = null; location.hash = '#/annonces'; await render();
    } catch (err) { toast(err.message, true); }
  } },
    el('div', { class: 'brand' }, svg('logo'), 'AutoVeille'),
    setup
      ? el('p', { class: 'muted' }, needCode ? 'Première connexion. Saisissez le code fourni à l’installation, puis choisissez le mot de passe qui servira ensuite à ouvrir l’application.' : 'Première connexion. Choisissez le mot de passe qui servira ensuite à ouvrir l’application.')
      : el('p', { class: 'muted' }, 'Les nouvelles annonces qui vous intéressent, avec le message prêt à envoyer.'),
    needCode ? el('div', { class: 'field' }, el('label', { for: 'code' }, 'Code de première connexion'), el('input', { class: 'input', id: 'code', name: 'code', autocomplete: 'off', required: true })) : null,
    el('div', { class: 'field' }, el('label', { for: 'password' }, setup ? 'Nouveau mot de passe (8 caractères minimum)' : 'Mot de passe'), el('input', { class: 'input', id: 'password', name: 'password', type: 'password', autocomplete: setup ? 'new-password' : 'current-password', required: true, minlength: setup ? 8 : 1 })),
    el('button', { class: 'btn primary big', type: 'submit' }, setup ? 'Commencer' : 'Se connecter'),
  );
  return el('div', { class: 'login' }, form);
}

// ---------- écran Annonces ----------
async function loadOverview() { state.overview = await api('GET', '/api/overview'); }

async function renderAnnonces() {
  const kind = state.kind || 'suivies';
  const [ov, data] = await Promise.all([api('GET', '/api/overview'), api('GET', `/api/vehicles?status=${state.filter}${state.filter === 'ecartees' ? `&kind=${kind}` : ''}`)]);
  state.overview = ov; state.vehicles = data.vehicles;
  const c = ov.counts;
  const filters = [['nouveau', 'À traiter', c.nouveau], ['contacte', 'Contactées', c.contacte], ['repondu', 'Ont répondu', c.repondu], ['ignore', 'Ignorées', c.ignore], ['ecartees', 'Écartées par les filtres'], ['tous', 'Toutes']];
  const lastRun = (ov.sources || []).find((s) => s.source === 'email');

  const w = ov.week || { received: 0, contacted: 0, replied: 0 };
  const weekLine = (w.received || w.contacted || w.replied)
    ? el('p', { class: 'muted small week' }, `7 derniers jours : ${fmt.plural(w.received, 'annonce retenue', 'annonces retenues')}, ${fmt.plural(w.contacted, 'contactée', 'contactées')}, ${fmt.plural(w.replied, 'réponse', 'réponses')}.`)
    : null;
  const head = el('div', { class: 'headline' },
    el('h1', {}, state.filter === 'nouveau' ? (c.nouveau ? `${fmt.plural(c.nouveau, 'annonce à traiter', 'annonces à traiter')}` : 'Rien à traiter pour le moment') : filters.find((f) => f[0] === state.filter)[1]),
    el('p', { class: 'muted' }, `${ov.zone.city}, ${ov.zone.radiusKm} km`, lastRun?.last_run_at ? ` · boîte mail vérifiée ${fmt.ago(lastRun.last_run_at)}` : (ov.imapConfigured ? '' : ' · boîte mail pas encore reliée')),
    weekLine,
    state.filter === 'nouveau' && c.nouveau >= 2 ? el('a', { class: 'btn primary rafale-cta', href: '#/rafale' }, svg('bolt'), `Traiter en rafale (${c.nouveau})`) : null,
  );
  const setup = state.filter === 'nouveau' ? setupCard(ov) : null;
  const issueSites = Array.from(new Set((ov.alertIssues || []).map((m) => m.split(' : ')[0])));
  const issues = issueSites.length && state.filter === 'nouveau'
    ? el('a', { class: 'note warn link', href: '#/sources' }, el('b', {}, issueSites.length > 1 ? 'Des alertes à modifier sur les sites : ' : 'Une alerte à modifier sur le site : '), issueSites.join(', '), ' — elle ne couvre pas vos réglages. Voir dans Sites →')
    : null;
  const bar = el('div', { class: 'filterbar', role: 'tablist' }, filters.map(([key, label, count]) =>
    el('button', { class: 'chip', role: 'tab', 'aria-pressed': state.filter === key, onclick: () => { state.filter = key; state.search = ''; render(); } }, label, count ? el('span', { class: 'badge count' }, count) : null)));
  // Écartées : grouped by the reason, so a good deal hiding behind one criterion is quick to spot.
  let kinds = null;
  if (state.filter === 'ecartees') {
    const k = data.kinds || {};
    const options = [['suivies', 'Marques suivies'], ['loin', 'Trop loin'], ['km', 'Trop de km'], ['special', 'Ni supercar ni collection'], ['pro', 'Vendeur pro'], ['marque', 'Autres marques'], ['tous', 'Toutes']];
    kinds = el('div', { class: 'kinds' },
      el('p', { class: 'muted small' }, 'Les 14 derniers jours. Un coup d’œil de temps en temps : « Garder quand même » remet une annonce à traiter.'),
      el('div', { class: 'filterbar', role: 'tablist' }, options.map(([key, label]) => el('button', { class: 'chip', role: 'tab', 'aria-pressed': kind === key, onclick: () => { state.kind = key; state.search = ''; render(); } }, label, k[key] ? el('span', { class: 'badge count' }, k[key]) : null))));
  }

  const list = el('div', { class: 'stack' });
  let search = null;
  if (!state.vehicles.length) {
    list.append(el('div', { class: 'empty' }, svg('car'),
      el('b', {}, state.filter === 'nouveau' ? 'Aucune annonce en attente' : state.filter === 'ecartees' ? 'Rien d’écarté dans cette catégorie' : 'Rien ici'),
      el('p', {}, state.filter === 'nouveau' ? 'Les nouvelles annonces arrivent ici dès qu’un site envoie une alerte.' : ''),
      !ov.imapConfigured ? el('a', { class: 'btn', href: '#/sources' }, 'Relier la boîte mail des alertes') : null,
    ));
  } else {
    const cards = state.vehicles.map((v) => [v, renderVehicle(v)]);
    for (const [, card] of cards) list.append(card);
    if (state.vehicles.length >= 6) {
      const none = el('p', { class: 'muted small hidden' }, 'Aucune annonce ne correspond.');
      const input = el('input', { class: 'input', type: 'search', placeholder: 'Rechercher : modèle, marque, ville…', value: state.search, 'aria-label': 'Rechercher dans la liste', oninput: (e) => {
        state.search = e.target.value;
        const q = fmt.fold(state.search);
        let shown = 0;
        for (const [v, card] of cards) { const hit = !q || fmt.fold(`${v.name} ${v.title} ${v.city || ''} ${v.siteLabel} ${v.note || ''}`).includes(q); card.classList.toggle('hidden', !hit); if (hit) shown++; }
        none.classList.toggle('hidden', shown > 0);
      } });
      search = el('div', { class: 'searchbox' }, svg('search'), input, none);
      if (state.search) setTimeout(() => input.dispatchEvent(new Event('input')), 0);
    }
  }
  setTimeout(() => document.querySelectorAll('.message textarea').forEach(autosize), 0);
  return [head, setup, issues, bar, kinds, search, list];
}

const MAIN_SITES = ['leboncoin', 'lacentrale', 'autoscout24', 'paruvendu'];

/**
 * The four things to do once. Each line goes where it is done; the card disappears when all is done,
 * or when the person hides it on this device.
 */
function setupCard(ov) {
  if (prefs.get('setup_hidden') === '1') return null;
  const pushPossible = 'Notification' in window && 'serviceWorker' in navigator;
  const alertsDone = MAIN_SITES.filter((k) => (ov.alertsDone || []).includes(k)).length;
  const steps = [
    { ok: Boolean(ov.dealer?.firstName && ov.dealer?.phone), label: 'Votre nom et votre téléphone', href: '#/reglages', action: 'Réglages' },
    { ok: Boolean(ov.imapConfigured), label: 'La boîte mail des alertes', href: '#/sources', action: 'Sites' },
    { ok: alertsDone >= MAIN_SITES.length, label: `Les alertes sur les sites (${alertsDone}/${MAIN_SITES.length})`, href: '#/sources', action: 'Sites' },
  ];
  if (pushPossible) steps.push({ ok: state.pushStatus === 'active', label: 'Les notifications sur cet appareil', onclick: enablePush, action: 'Activer' });
  const done = steps.filter((s) => s.ok).length;
  if (done === steps.length) return null;
  const card = el('section', { class: 'card setup' },
    el('div', { class: 'row between' },
      el('h2', {}, 'Mise en route ', el('span', { class: 'muted' }, `${done}/${steps.length}`)),
      el('button', { class: 'btn quiet small', type: 'button', title: 'Ne plus afficher sur cet appareil', onclick: () => { prefs.set('setup_hidden', '1'); card.remove(); } }, 'Masquer')),
    el('ul', { class: 'steps' }, steps.map((s) => el('li', { class: s.ok ? 'done' : '' },
      el('span', { class: 'tick' }, s.ok ? svg('check') : null),
      el('span', { class: 'label' }, s.label),
      s.ok ? null : (s.href ? el('a', { class: 'btn small', href: s.href }, s.action) : el('button', { class: 'btn small', type: 'button', onclick: s.onclick }, s.action))))),
  );
  return card;
}

function autosize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; }

/** The message, folded to its first lines; a tap unfolds it for reading or editing. */
function messageBlock(ta) {
  const box = el('div', { class: 'message collapsed' });
  const more = el('button', { class: 'btn quiet small', type: 'button' }, 'Lire la suite ou modifier');
  const setOpen = (open) => { box.classList.toggle('collapsed', !open); more.textContent = open ? 'Réduire' : 'Lire la suite ou modifier'; if (open) autosize(ta); };
  more.addEventListener('click', () => setOpen(box.classList.contains('collapsed')));
  ta.addEventListener('focus', () => setOpen(true));
  box.append(el('div', { class: 'ta-wrap' }, ta, el('div', { class: 'fade' })), el('div', { class: 'row between' }, more, el('span', { class: 'hint' }, 'Retouchez le texte si besoin, il est copié tel quel.')));
  return box;
}

function vehicleBadges(v) {
  const badges = [];
  const fresh = Date.now() - new Date(v.firstSeenAt).getTime() < 86400_000;
  if (v.status === 'nouveau' && v.matched && fresh) badges.push(el('span', { class: 'badge new' }, 'Nouveau'));
  if (v.priceDropped) badges.push(el('span', { class: 'badge ok' }, 'Prix baissé'));
  if (v.reposted) badges.push(el('span', { class: 'badge' }, 'Republiée'));
  if (v.listings.length > 1) badges.push(el('span', { class: 'badge' }, `Aussi sur ${v.listings.slice(1).map((l) => l.siteLabel).join(', ')}`));
  if (v.specialReason) badges.push(el('span', { class: 'badge', title: 'Pourquoi cette annonce est retenue' }, `Retenue : ${v.specialReason}`));
  if (v.sellerType === 'pro') badges.push(el('span', { class: 'badge warn' }, 'Vendeur pro'));
  if (v.doNotContact) badges.push(el('span', { class: 'badge warn' }, 'Ne plus contacter'));
  if (v.messageEdited) badges.push(el('span', { class: 'badge' }, 'Message modifié'));
  return badges;
}

/** Where the vehicle stands with the seller, for the card and the sheet. */
function followUpText(v) {
  if (v.status === 'repondu') return v.repliedAt ? `A répondu ${fmt.days(v.repliedAt)}` : 'A répondu';
  if (v.status === 'contacte') return v.contactedAt ? `Contactée ${fmt.days(v.contactedAt)}, sans réponse pour l’instant` : 'Contactée';
  return '';
}

const whereText = (v) => [v.city, v.distanceKm !== null ? `à ${v.distanceKm} km` : null].filter(Boolean).join(', ');

function specsBlock(v) {
  return el('div', { class: 'specs' },
    el('div', {}, el('b', {}, v.year || '–'), el('span', {}, 'année')),
    el('div', {}, el('b', {}, v.km !== null ? fmt.int(v.km) : '–'), el('span', {}, 'km')),
    el('div', {}, el('b', {}, v.price !== null ? fmt.int(v.price) + ' €' : '–'), el('span', {}, v.listings[0]?.priceHistory?.length > 1 ? 'prix (baissé)' : 'prix')));
}

/** The editable message; saved on blur when it changed. */
function messageTextarea(v) {
  const ta = el('textarea', { rows: 4, 'aria-label': 'Message à envoyer', spellcheck: true }, v.message);
  ta.addEventListener('input', () => autosize(ta));
  ta.addEventListener('blur', async () => {
    if (ta.value === v.message) return;
    try { const r = await api('POST', `/api/vehicles/${v.id}`, { message: ta.value }); v.message = r.message; v.messageEdited = r.messageEdited; toast('Message enregistré'); }
    catch (err) { toast(err.message, true); }
  });
  return ta;
}

/** Opens the listing (on a phone installed as an app, in a panel over the app) and puts the message in the clipboard. */
async function openAndCopy(v, text) {
  // The copy starts first, inside the tap, which is what phones require; the tab opens right after.
  let copied = false;
  const legacyCopy = () => { try { const t = el('textarea', { style: 'position:fixed;opacity:0', value: text }); document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch { return false; } };
  const pending = navigator.clipboard?.writeText ? navigator.clipboard.writeText(text).then(() => true, () => legacyCopy()) : Promise.resolve(legacyCopy());
  // Without the "noopener" feature string: with it, window.open returns null and a blocked tab can't be told apart from an open one.
  const w = window.open(v.url, '_blank');
  if (w) { try { w.opener = null; } catch { /* ignoré */ } }
  copied = await pending;
  if (!w) toast('Le navigateur a bloqué l’ouverture de l’annonce : ouvrez-la avec le lien « Voir l’annonce ».', true);
  else toast(copied ? 'Message copié : collez-le dans le formulaire de contact de l’annonce.' : 'Annonce ouverte. Copiez le message à la main.');
  return Boolean(w);
}

/**
 * Action buttons for a vehicle. `afterUpdate(patch)` runs once the server has applied a change
 * (the list re-renders, the detail goes back, the burst mode moves on).
 */
function vehicleActions(v, ta, { afterUpdate, inBurst = false } = {}) {
  const actions = el('div', { class: 'actions' });
  // Every change of status can be undone from the confirmation, for the finger that slips.
  const update = async (patch, msg) => {
    if (state.pendingConfirm === v.id) state.pendingConfirm = null;
    const inverse = (patch.status || patch.doNotContact) ? { status: v.status, ...(patch.doNotContact ? { doNotContact: false } : {}) } : null;
    const undo = inverse ? async () => { await api('POST', `/api/vehicles/${v.id}`, inverse); toast('Annulé'); await afterUpdate({ undone: patch }); } : undefined;
    try { await api('POST', `/api/vehicles/${v.id}`, patch); if (msg) toast(msg, false, undo); await afterUpdate(patch); }
    catch (err) { toast(err.message, true); }
  };
  const confirmBox = el('div', { class: 'confirm hidden' }, el('b', {}, 'Message envoyé au vendeur ?'),
    el('button', { class: 'btn primary small', onclick: () => update({ status: 'contacte' }, inBurst ? 'Envoyée, à la suivante' : 'Passée en « contactée »') }, inBurst ? 'Oui, envoyé, suivante' : 'Oui, envoyé'),
    inBurst ? el('button', { class: 'btn small', onclick: () => update({ status: 'ignore' }, 'Annonce ignorée') }, 'Non, ignorer') : null,
    el('button', { class: 'btn small quiet', onclick: () => { confirmBox.classList.add('hidden'); if (state.pendingConfirm === v.id) state.pendingConfirm = null; if (inBurst) afterUpdate({ skip: true }); } }, inBurst ? 'Passer' : 'Pas maintenant'));
  const showConfirm = () => { confirmBox.classList.remove('hidden'); };
  // The question survives the refresh that happens when the person comes back from the listing.
  const main = el('button', { class: 'btn primary big', onclick: async () => { state.pendingConfirm = v.id; await openAndCopy(v, ta ? ta.value : v.message); showConfirm(); confirmBox.scrollIntoView({ block: 'nearest' }); } }, svg('open'), 'Ouvrir l’annonce et copier le message');
  if (state.pendingConfirm === v.id && v.status === 'nouveau' && v.matched) showConfirm();
  let primary = null; // the big button, placed by the caller (first on a card, last and sticky on the full view)

  if (!v.matched) {
    actions.append(el('ul', { class: 'reasons' }, v.reasons.map((r) => el('li', {}, r))),
      el('div', { class: 'secondary' },
        el('a', { class: 'btn', href: v.url, target: '_blank', rel: 'noopener' }, svg('open'), 'Voir l’annonce'),
        el('button', { class: 'btn', onclick: () => update({ keep: true, status: 'nouveau' }, 'Annonce gardée') }, 'Garder quand même')));
  } else if (v.status === 'nouveau') {
    primary = el('div', { class: 'primary-bar' }, main, confirmBox);
    actions.append(el('div', { class: 'secondary' },
        el('button', { class: 'btn quiet', onclick: () => update({ status: 'contacte' }, 'Passée en « contactée »') }, 'Déjà contacté'),
        el('button', { class: 'btn quiet', onclick: () => update({ status: 'ignore' }, 'Annonce ignorée') }, 'Ignorer'),
        el('button', { class: 'btn quiet danger', onclick: () => update({ doNotContact: true }, 'Vendeur ajouté à la liste « ne plus contacter »') }, 'Ne plus contacter'),
        inBurst ? el('button', { class: 'btn quiet', onclick: () => afterUpdate({ skip: true }) }, 'Passer') : null));
  } else if (v.status === 'contacte') {
    actions.append(el('div', { class: 'secondary' },
      el('a', { class: 'btn', href: v.url, target: '_blank', rel: 'noopener' }, svg('open'), 'Revoir l’annonce'),
      el('button', { class: 'btn primary', onclick: () => update({ status: 'repondu' }, 'Noté : le vendeur a répondu') }, 'Le vendeur a répondu'),
      el('button', { class: 'btn quiet', onclick: () => update({ status: 'ignore' }, 'Annonce classée') }, 'Sans suite'),
      el('button', { class: 'btn quiet', title: 'Si vous l’avez marquée contactée par erreur', onclick: () => update({ status: 'nouveau' }, 'Remise à traiter') }, 'Pas encore contactée')));
  } else {
    actions.append(el('div', { class: 'secondary' },
      el('a', { class: 'btn', href: v.url, target: '_blank', rel: 'noopener' }, svg('open'), 'Voir l’annonce'),
      v.status === 'repondu' ? el('button', { class: 'btn quiet', onclick: () => update({ status: 'ignore' }, 'Annonce classée') }, 'Classer') : null,
      !v.doNotContact ? el('button', { class: 'btn quiet', onclick: () => update({ status: 'nouveau' }, 'Remise à traiter') }, 'Remettre à traiter') : null));
  }
  return { actions, primary, showConfirm };
}

/** A private note on the vehicle (what the seller said, a price, when to call back). Saved when the field loses focus. */
function noteField(v) {
  const ta = el('textarea', { class: 'input', rows: 2, placeholder: 'Note pour vous : ce que le vendeur a dit, un prix, quand rappeler…', 'aria-label': 'Note' }, v.note || '');
  ta.addEventListener('input', () => autosize(ta));
  ta.addEventListener('blur', async () => {
    if (ta.value === (v.note || '')) return;
    try { const r = await api('POST', `/api/vehicles/${v.id}`, { note: ta.value }); v.note = r.note; toast(r.note ? 'Note enregistrée' : 'Note effacée'); }
    catch (err) { toast(err.message, true); }
  });
  return el('div', { class: 'vnote-field' }, el('label', {}, svg('pen'), 'Votre note'), ta);
}

/** Compact card in the list. The photo and the title open the full view. */
function renderVehicle(v) {
  const card = el('article', { class: 'card listing', id: `v-${v.id}` });
  const badges = vehicleBadges(v);
  const thumb = v.imageUrl ? el('img', { class: 'thumb', src: v.imageUrl, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : el('div', { class: 'thumb empty' }, svg('car'));
  const ta = messageTextarea(v);
  const { actions, primary } = vehicleActions(v, ta, { afterUpdate: () => render() });
  const link = (...children) => el('a', { class: 'plain', href: `#/annonce/${v.id}`, 'aria-label': `Voir la fiche : ${v.name}` }, ...children);

  const follow = followUpText(v);
  append(card,
    el('div', { class: 'head' }, link(thumb), el('div', { class: 'title' }, el('h3', { title: v.title }, link(v.name)), el('span', { class: 'sub' }, v.title !== v.name ? v.title : ''), el('span', { class: 'sub' }, [whereText(v), v.siteLabel, fmt.ago(v.firstSeenAt)].filter(Boolean).join(' · ')))),
    specsBlock(v),
    badges.length ? el('div', { class: 'badges' }, badges) : null,
    follow ? el('p', { class: 'follow' }, follow) : null,
    v.note ? el('p', { class: 'vnote' }, svg('pen'), el('span', {}, v.note)) : null,
    v.matched && v.status === 'nouveau' ? messageBlock(ta) : null,
    primary ? el('div', { class: 'actions' }, primary) : null,
    actions,
  );
  return card;
}

/** Full view of one vehicle: photo, details, the listing text as received, the message, the actions. */
function vehicleSheet(v, { afterUpdate, inBurst = false }) {
  const sheet = el('article', { class: 'card listing detail', id: `v-${v.id}` });
  const badges = vehicleBadges(v);
  const photo = v.imageUrl ? el('a', { class: 'photo', href: v.url, target: '_blank', rel: 'noopener' }, el('img', { src: v.imageUrl, alt: v.title, referrerpolicy: 'no-referrer' })) : el('div', { class: 'photo empty' }, svg('car'));
  const ta = messageTextarea(v);
  const { actions, primary, showConfirm } = vehicleActions(v, ta, { afterUpdate, inBurst });
  if (primary && !inBurst) primary.classList.add('sticky');
  const siteLine = el('div', { class: 'sub' }, [whereText(v), `${v.siteLabel} · ${fmt.ago(v.firstSeenAt)}`].filter(Boolean).join(' · '));
  const others = v.listings.length > 1 ? el('div', { class: 'others' }, 'Aussi sur ', v.listings.slice(1).map((l, i) => [i ? ', ' : '', el('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.siteLabel)])) : null;
  const desc = v.description ? el('details', { class: 'adv desc', open: !inBurst }, el('summary', {}, 'Texte de l’annonce tel que reçu'), el('p', { class: 'desc-text' }, v.description)) : null;

  const message = v.matched && v.status === 'nouveau'
    ? (inBurst ? messageBlock(ta) : el('div', { class: 'message open' }, el('div', { class: 'ta-wrap' }, ta), el('span', { class: 'hint' }, 'Le message proposé, modifiable. Il est copié tel quel.')))
    : null;
  const follow = followUpText(v);
  // In burst mode the button comes first and the message stays folded: one tap, then paste.
  // In the full view the button is last and sticky: it stays within reach while the person reads.
  append(sheet,
    photo,
    el('div', { class: 'dhead' }, el('h2', {}, v.name), v.title !== v.name ? el('p', { class: 'muted' }, v.title) : null, siteLine, others),
    specsBlock(v),
    badges.length ? el('div', { class: 'badges' }, badges) : null,
    follow ? el('p', { class: 'follow' }, follow) : null,
    inBurst ? [primary ? el('div', { class: 'actions' }, primary) : null, actions] : message,
    inBurst ? message : null,
    inBurst ? null : noteField(v),
    desc,
    inBurst ? null : actions,
    inBurst ? null : primary,
  );
  setTimeout(() => { autosize(ta); sheet.querySelectorAll('.vnote-field textarea').forEach(autosize); }, 0);
  return { sheet, showConfirm };
}

async function renderAnnonceDetail(route) {
  const id = Number(route.arg);
  let v;
  try { v = await api('GET', `/api/vehicles/${id}`); }
  catch (err) { return el('div', { class: 'empty' }, el('b', {}, 'Annonce introuvable'), el('a', { class: 'btn', href: '#/annonces' }, 'Retour aux annonces')); }
  const back = el('a', { class: 'btn quiet back', href: '#/annonces' }, '← Annonces');
  // After an action the list comes back; after an undo made from the list's confirmation, the list refreshes in place.
  const { sheet } = vehicleSheet(v, { afterUpdate: async () => { if (currentRoute().name === 'annonces') await render(); else location.hash = '#/annonces'; } });
  const remove = el('button', { class: 'btn quiet small danger', onclick: async () => {
    if (!confirm('Supprimer cette annonce de l’application ? Elle reviendra si un site la renvoie.')) return;
    try { await api('DELETE', `/api/vehicles/${v.id}`); toast('Annonce supprimée'); location.hash = '#/annonces'; } catch (err) { toast(err.message, true); }
  } }, 'Supprimer cette annonce');
  return [back, sheet, el('div', { class: 'row', style: 'justify-content:flex-end' }, remove)];
}

// ---------- mode rafale ----------
/** Vehicles to process, one after the other, with the confirmation shown when the person comes back to the app. */
async function renderRafale() {
  const data = await api('GET', '/api/vehicles?status=nouveau');
  const queue = data.vehicles.filter((v) => v.matched && !v.doNotContact);
  const r = state.rafale && state.rafale.ids.length ? state.rafale : (state.rafale = { ids: queue.map((v) => v.id), index: 0, sent: 0, ignored: 0, skipped: 0 });
  // Vehicles handled elsewhere in the meantime disappear from the queue.
  const stillThere = new Set(queue.map((v) => v.id));
  r.ids = r.ids.filter((id) => stillThere.has(id));
  if (r.index > r.ids.length) r.index = r.ids.length;

  const box = el('div', { class: 'stack' });
  const stop = () => { state.rafale = null; location.hash = '#/annonces'; };

  const draw = () => {
    box.replaceChildren();
    if (!r.ids.length || r.index >= r.ids.length) {
      const total = r.sent + r.ignored + r.skipped;
      box.append(el('div', { class: 'empty' }, svg('bolt'),
        el('b', {}, total ? 'Rafale terminée' : 'Rien à traiter'),
        el('p', {}, total ? `${fmt.plural(r.sent, 'message envoyé', 'messages envoyés')}, ${fmt.plural(r.ignored, 'annonce ignorée', 'annonces ignorées')}${r.skipped ? `, ${fmt.plural(r.skipped, 'passée', 'passées')}` : ''}.` : 'Toutes les annonces sont traitées.'),
        el('button', { class: 'btn primary', onclick: stop }, 'Retour aux annonces')));
      return;
    }
    const v = queue.find((x) => x.id === r.ids[r.index]);
    const progress = el('div', { class: 'progress' },
      el('div', { class: 'row between' }, el('b', {}, `${r.index + 1} sur ${r.ids.length}`), el('button', { class: 'btn quiet small', onclick: stop }, 'Arrêter')),
      el('div', { class: 'bar' }, el('div', { class: 'fill', style: `width:${Math.round((r.index / r.ids.length) * 100)}%` })));
    const { sheet, showConfirm } = vehicleSheet(v, {
      inBurst: true,
      afterUpdate: async (patch) => {
        if (patch.undone) {
          const u = patch.undone;
          if (u.status === 'contacte') r.sent = Math.max(0, r.sent - 1);
          else if (u.status === 'ignore' || u.doNotContact) r.ignored = Math.max(0, r.ignored - 1);
          r.index = Math.max(0, r.index - 1);
        } else {
          if (patch.skip) r.skipped++;
          else if (patch.status === 'contacte') r.sent++;
          else if (patch.status === 'ignore' || patch.doNotContact) r.ignored++;
          r.index++;
        }
        window.scrollTo({ top: 0 });
        draw();
      },
    });
    // When the person comes back from the listing, the question is already on screen.
    const onBack = () => { if (document.visibilityState === 'visible') showConfirm(); };
    document.addEventListener('visibilitychange', onBack, { once: true });
    box.append(progress, sheet);
  };
  draw();
  return [el('div', { class: 'headline' }, el('h1', {}, 'Mode rafale'), el('p', { class: 'muted' }, 'Une annonce à la fois : ouvrir, coller le message, envoyer, revenir. Chaque envoi reste le vôtre.')), box];
}

// ---------- écran Réglages ----------
async function loadSettings() {
  const r = await api('GET', '/api/settings');
  state.settings = r.settings; state.draft = clone(r.settings); state.settingsMeta = r;
}

const previewDebounced = debounce(async () => {
  try {
    const p = await api('POST', '/api/settings/preview', state.draft);
    state.preview = p;
    const node = document.getElementById('preview-count');
    if (node) node.replaceChildren(...[].concat(previewText()));
  } catch { /* silencieux */ }
}, 350);

function previewText() {
  const p = state.preview;
  if (!p) return el('span', {}, 'Calcul en cours…');
  return [el('b', {}, `${fmt.plural(p.pass, 'annonce', 'annonces')} sur 7 jours`), el('span', {}, `avec ces réglages, sur ${fmt.plural(p.total, 'annonce reçue', 'annonces reçues')}`)];
}

function onDraftChange() {
  const dirty = JSON.stringify(state.draft) !== JSON.stringify(state.settings);
  const btn = document.getElementById('save-settings');
  if (btn) btn.disabled = !dirty;
  previewDebounced();
}

/** Unsaved changes in the shared draft? When there are none, the draft is reloaded so the screen shows what the server has. */
const draftDirty = () => Boolean(state.settings && state.draft && JSON.stringify(state.draft) !== JSON.stringify(state.settings));

async function renderReglages() {
  if (!state.settings || !draftDirty()) await loadSettings();
  const d = state.draft;
  state.preview = null; previewDebounced();

  const field = (label, input, help) => el('div', { class: 'field' }, el('label', {}, label), input, help ? el('span', { class: 'help' }, help) : null);
  const text = (obj, key, attrs = {}) => el('input', { class: 'input', value: obj[key] ?? '', ...attrs, oninput: (e) => { obj[key] = attrs.type === 'number' ? Number(e.target.value) : e.target.value; onDraftChange(); } });
  const toggle = (obj, key, title, help, onchange) => {
    const t = el('button', { class: 'toggle', role: 'switch', type: 'button', 'aria-checked': String(!!obj[key]), onclick: () => { obj[key] = !obj[key]; t.setAttribute('aria-checked', String(obj[key])); onDraftChange(); onchange?.(obj[key]); } });
    return el('div', { class: 'switch', onclick: (e) => { if (e.target !== t) t.click(); } }, el('div', { class: 'text' }, el('b', {}, title), help ? el('span', {}, help) : null), t);
  };
  const chipList = (arr, { onToggle, pressed, addLabel, onAdd, removable } = {}) => {
    const wrap = el('div', { class: 'chips' });
    const draw = () => {
      wrap.replaceChildren(...arr.map((item) => el('button', { class: 'chip', type: 'button', 'aria-pressed': pressed ? String(pressed(item)) : null, onclick: () => { onToggle?.(item); draw(); onDraftChange(); } }, item, removable ? el('span', { class: 'x', title: 'Retirer', onclick: (e) => { e.stopPropagation(); arr.splice(arr.indexOf(item), 1); draw(); onDraftChange(); } }, '×') : null)));
      if (onAdd) {
        const add = el('button', { class: 'chip add', type: 'button', onclick: () => {
          const input = el('input', { class: 'input', placeholder: addLabel, style: 'max-width:220px', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = input.value.trim(); if (v) onAdd(v); draw(); onDraftChange(); } if (e.key === 'Escape') draw(); }, onblur: () => { const v = input.value.trim(); if (v) { onAdd(v); onDraftChange(); } draw(); } });
          add.replaceWith(input); input.focus();
        } }, '+ ' + addLabel);
        wrap.append(add);
      }
    };
    draw();
    return wrap;
  };

  // Concession
  const dealer = el('section', { class: 'card section' }, el('h2', {}, 'Vous'),
    el('p', { class: 'muted small' }, 'Ces informations remplissent automatiquement les messages.'),
    el('div', { class: 'grid2' }, field('Prénom', text(d.dealer, 'firstName', { autocomplete: 'given-name', placeholder: 'Votre prénom' })), field('Nom', text(d.dealer, 'lastName', { autocomplete: 'family-name', placeholder: 'Votre nom' }))),
    el('div', { class: 'grid2' }, field('Concession', text(d.dealer, 'company', { placeholder: 'Nom de la concession' })), field('Ville de la concession', text(d.dealer, 'city', { placeholder: 'Bordeaux' }))),
    field('Téléphone', text(d.dealer, 'phone', { type: 'tel', inputmode: 'tel', placeholder: '06 12 34 56 78' }), 'Il figure dans chaque message : c’est ce qui permet au vendeur de vous joindre.'));

  // Zone
  const radiusLabel = el('b', {}, `${d.zone.radiusKm} km`);
  const slider = el('input', { class: 'slider', type: 'range', min: 25, max: 250, step: 25, value: d.zone.radiusKm, oninput: (e) => { d.zone.radiusKm = Number(e.target.value); radiusLabel.textContent = `${d.zone.radiusKm} km`; onDraftChange(); } });
  const zone = el('section', { class: 'card section' }, el('h2', {}, 'Zone'),
    el('div', { class: 'grid2' }, field('Ville de référence', text(d.zone, 'city', { placeholder: 'Bordeaux' })), field('Code postal (facultatif)', text(d.zone, 'postalCode', { inputmode: 'numeric', placeholder: '33000' }), 'Utile si la ville porte un nom courant.')),
    el('div', { class: 'field' }, el('div', { class: 'row between' }, el('label', {}, 'Rayon autour de la ville'), radiusLabel), slider),
    field('Kilométrage maximum', el('div', { class: 'input-affix' }, text(d, 'maxKm', { type: 'number', inputmode: 'numeric', min: 0, step: 5000 }), el('span', {}, 'km')), 'Les annonces sans kilométrage indiqué sont gardées.'),
    el('div', {}, toggle(d, 'privateOnly', 'Particuliers uniquement', 'Écarte les annonces de professionnels quand le site le précise.'),
      toggle(d, 'specialOnly', 'Supercar et collection uniquement', 'Garde une voiture si elle dépasse le prix plancher, si elle est assez ancienne, ou si son modèle est dans la liste de la famille. Réglable famille par famille ci-dessous.', (on) => document.querySelectorAll('details.adv').forEach((x) => x.classList.toggle('hidden', !on)))));

  // Familles
  const famLabels = Object.fromEntries(state.settingsMeta.families.map((f) => [f.key, f.label]));
  const families = el('section', { class: 'section' }, el('h2', {}, 'Marques suivies'),
    el('p', { class: 'muted small' }, 'Touchez une marque pour l’activer ou la désactiver. Les mots-clés servent à reconnaître les versions sportives et de collection.'),
    ...Object.keys(famLabels).map((key) => {
      const f = d.families[key];
      const box = el('div', { class: 'family', dataset: { enabled: String(f.enabled) } });
      const t = el('button', { class: 'toggle', role: 'switch', type: 'button', 'aria-checked': String(f.enabled), onclick: () => { f.enabled = !f.enabled; t.setAttribute('aria-checked', String(f.enabled)); box.dataset.enabled = String(f.enabled); onDraftChange(); } });
      const known = () => Array.from(new Set([...f.known, ...f.brands]));
      box.append(
        el('div', { class: 'fhead' }, el('h3', {}, famLabels[key]), t),
        el('div', { class: 'fbody' },
          chipList(known(), { pressed: (b) => f.brands.includes(b), onToggle: (b) => { const i = f.brands.indexOf(b); if (i >= 0) f.brands.splice(i, 1); else f.brands.push(b); }, addLabel: 'Ajouter une marque', onAdd: (b) => { if (!f.known.includes(b)) f.known.push(b); if (!f.brands.includes(b)) f.brands.push(b); } }),
          el('details', { class: 'adv' + (d.specialOnly ? '' : ' hidden') }, el('summary', {}, 'Règle supercar et collection'),
            el('div', { class: 'body' },
              el('div', { class: 'grid2' },
                field('Prix à partir duquel on garde', el('div', { class: 'input-affix' }, text(f, 'minPrice', { type: 'number', inputmode: 'numeric', min: 0, step: 5000 }), el('span', {}, '€')), '0 pour ne pas tenir compte du prix.'),
                field('Ou année jusqu’à', text(f, 'maxYear', { type: 'number', inputmode: 'numeric', min: 0, max: 2100 }), 'Les voitures de cette année ou plus anciennes sont gardées. 0 pour ignorer.')),
              el('div', { class: 'field' }, el('label', {}, 'Ou modèles et mots-clés'), chipList(f.keywords, { removable: true, addLabel: 'Ajouter un mot-clé', onAdd: (k) => { if (!f.keywords.includes(k)) f.keywords.push(k); } }), el('span', { class: 'help' }, 'Un mot-clé présent dans le titre de l’annonce suffit à garder la voiture.'))))));
      return box;
    }));

  // Notifications
  const notif = el('section', { class: 'card section' }, el('h2', {}, 'Notifications'),
    toggle(d.notifications, 'push', 'Notification à chaque nouvelle annonce', 'Sur le téléphone ou l’ordinateur où l’application est ouverte ou installée.'),
    el('div', { class: 'row' },
      el('button', { class: 'btn', type: 'button', onclick: enablePush }, 'Activer sur cet appareil'),
      el('button', { class: 'btn quiet', type: 'button', onclick: async () => { try { const r = await api('POST', '/api/push/test'); toast(r.detail, !r.ok); } catch (e) { toast(e.message, true); } } }, 'Envoyer un test'),
      el('span', { class: 'muted small', id: 'push-status' }, pushStatusText())),
    el('details', { class: 'adv' }, el('summary', {}, 'Telegram (facultatif)'),
      el('div', { class: 'body' },
        el('p', { class: 'muted small' }, 'Pour recevoir aussi un message Telegram : créez un bot avec @BotFather, collez son jeton ici, envoyez-lui un message puis indiquez votre identifiant (obtenu avec @userinfobot).'),
        el('div', { class: 'grid2' }, field('Jeton du bot', text(d.notifications, 'telegramToken', { autocomplete: 'off' })), field('Identifiant de conversation', text(d.notifications, 'telegramChatId', { inputmode: 'numeric' }))),
        el('div', {}, el('button', { class: 'btn small', type: 'button', onclick: async () => { try { const r = await api('POST', '/api/telegram/test', { token: d.notifications.telegramToken, chatId: d.notifications.telegramChatId }); toast(r.detail, !r.ok); } catch (e) { toast(e.message, true); } } }, 'Envoyer un test Telegram')))));

  const saveBtn = el('button', { class: 'btn primary', id: 'save-settings', disabled: true, onclick: async () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement…';
    try {
      const r = await api('PUT', '/api/settings', state.draft);
      state.settings = r.settings; state.draft = clone(r.settings); state.preview = r.preview;
      toast(r.warning ? r.warning : 'Réglages enregistrés', Boolean(r.warning));
      await render();
    } catch (e) { toast(e.message, true); saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer'; }
  } }, 'Enregistrer');
  const savebar = el('div', { class: 'savebar' }, el('div', { class: 'count', id: 'preview-count' }, previewText()), saveBtn);

  return [el('div', { class: 'headline' }, el('h1', {}, 'Réglages'), el('p', { class: 'muted' }, 'Le compteur en bas se met à jour à chaque changement, avant même d’enregistrer.')), dealer, zone, families, notif, savebar];
}

// ---------- notifications push ----------
function pushStatusText() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'Non prises en charge par ce navigateur.';
  if (Notification.permission === 'denied') return 'Refusées dans les réglages du navigateur.';
  if (state.pushStatus === 'active') return 'Activées sur cet appareil.';
  return 'Pas encore activées sur cet appareil.';
}

async function checkPushStatus() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    state.pushStatus = sub ? 'active' : 'inactive';
  } catch { state.pushStatus = 'inconnu'; }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function enablePush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d’abord l’application à l’écran d’accueil.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Notifications refusées.');
    const reg = await navigator.serviceWorker.ready;
    const { key } = await api('GET', '/api/push/key');
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    await api('POST', '/api/push/subscribe', { subscription: sub.toJSON() });
    state.pushStatus = 'active';
    const s = document.getElementById('push-status'); if (s) s.textContent = pushStatusText();
    toast('Notifications activées sur cet appareil.');
    if (state.route === 'annonces') render();
  } catch (e) { toast(e.message, true); }
}

// ---------- écran Messages ----------
async function renderMessages() {
  if (!state.settings || !draftDirty()) await loadSettings();
  const d = state.draft;
  const fams = state.settingsMeta.families;
  let current = state.currentFamily || fams[0].key;
  const vars = state.settingsMeta.variables;

  const body = el('div', { class: 'stack' });
  const tabs = el('div', { class: 'filterbar', role: 'tablist' });
  const drawTabs = () => tabs.replaceChildren(...fams.map((f) => el('button', { class: 'chip', role: 'tab', 'aria-pressed': String(f.key === current), onclick: () => { current = f.key; state.currentFamily = f.key; drawTabs(); drawBody(); } }, f.label)));

  const drawBody = () => {
    const t = d.templates[current];
    body.replaceChildren();
    t.variants.forEach((text, i) => {
      const ta = el('textarea', { class: 'input', rows: 10, spellcheck: true }, text);
      const warn = el('div', { class: 'stack' });
      const preview = el('div', { class: 'preview' }, '…');
      const refresh = debounce(async () => {
        try { const r = await api('POST', '/api/templates/preview', { family: current, text: ta.value }); preview.textContent = r.text; warn.replaceChildren(...r.warnings.map((w) => el('div', { class: 'note warn' }, w))); } catch { /* silencieux */ }
      }, 300);
      ta.addEventListener('input', () => { t.variants[i] = ta.value; onDraftChange(); refresh(); });
      refresh();
      const insertVar = (name) => { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText(`{${name}}`, s, e, 'end'); ta.dispatchEvent(new Event('input')); ta.focus(); };
      body.append(el('div', { class: 'variant' },
        el('div', { class: 'vhead' }, el('h3', {}, `Variante ${i + 1}`), t.variants.length > 1 ? el('button', { class: 'btn quiet small danger', onclick: () => { t.variants.splice(i, 1); onDraftChange(); drawBody(); } }, 'Supprimer') : null),
        ta,
        el('div', { class: 'vars' }, Object.keys(vars).map((k) => el('button', { class: 'chip', type: 'button', title: vars[k], onclick: () => insertVar(k) }, `{${k}}`))),
        warn,
        el('div', { class: 'field' }, el('label', {}, 'Aperçu sur une annonce'), preview)));
    });
    body.append(el('button', { class: 'btn', onclick: () => { t.variants.push(t.variants[0] || 'Bonjour,\n\n'); onDraftChange(); drawBody(); } }, '+ Ajouter une variante'));
  };
  drawTabs(); drawBody();

  const saveBtn = el('button', { class: 'btn primary', id: 'save-settings', disabled: JSON.stringify(state.draft) === JSON.stringify(state.settings), onclick: async () => {
    try { const r = await api('PUT', '/api/settings', state.draft); state.settings = r.settings; state.draft = clone(r.settings); toast('Messages enregistrés'); saveBtn.disabled = true; }
    catch (e) { toast(e.message, true); }
  } }, 'Enregistrer');

  return [
    el('div', { class: 'headline' }, el('h1', {}, 'Messages'), el('p', { class: 'muted' }, 'Un message par famille de marques, avec plusieurs variantes tirées au hasard pour ne pas envoyer toujours le même texte. Les accolades sont remplacées automatiquement.')),
    tabs,
    el('div', { class: 'note' }, 'Écrivez comme vous parlez. Pas de tiret long, pas d’émoji, pas de formule toute faite : l’aperçu vous le signale.'),
    body,
    el('div', { class: 'savebar' }, el('div', { class: 'count' }, el('span', {}, 'Les messages déjà retouchés sur une annonce ne changent pas.')), saveBtn),
  ];
}

// ---------- écran Sources ----------
async function renderSources() {
  if (!state.settings || !draftDirty()) await loadSettings();
  const d = state.draft;
  const src = await api('GET', '/api/sources');
  state.sources = src;

  const field = (label, input, help) => el('div', { class: 'field' }, el('label', {}, label), input, help ? el('span', { class: 'help' }, help) : null);
  const text = (obj, key, attrs = {}) => el('input', { class: 'input', value: obj[key] ?? '', ...attrs, oninput: (e) => { obj[key] = attrs.type === 'number' ? Number(e.target.value) : e.target.value; } });

  const status = (run) => run ? el('span', { class: 'badge ' + (run.ok ? 'ok' : 'warn') }, run.ok ? 'Fonctionne' : 'Problème') : el('span', { class: 'badge' }, 'Jamais vérifiée');

  // Boîte mail
  const mailMsg = el('div');
  const mailbox = el('section', { class: 'card section' },
    el('div', { class: 'row between' }, el('h2', {}, 'Boîte mail des alertes'), status(src.imap.lastRun)),
    el('p', { class: 'muted small' }, 'Les sites envoient leurs nouvelles annonces par email sur une adresse Gmail créée pour ça. L’application la lit toutes les deux minutes.'),
    src.imap.lastRun ? el('p', { class: 'small', style: src.imap.lastRun.ok ? '' : 'color:var(--danger)' }, `${fmt.ago(src.imap.lastRun.last_run_at)} : ${src.imap.lastRun.detail}`) : null,
    el('div', { class: 'grid2' }, field('Adresse Gmail dédiée', text(d.imap, 'user', { type: 'email', autocomplete: 'off', placeholder: 'alertes.concession@gmail.com' })),
      field('Mot de passe d’application', text(d.imap, 'pass', { type: 'password', autocomplete: 'new-password' }), 'Pas le mot de passe Gmail habituel : un mot de passe d’application, voir ci-dessous.')),
    el('details', { class: 'adv' }, el('summary', {}, 'Obtenir un mot de passe d’application Gmail'),
      el('div', { class: 'body' }, el('ol', { style: 'margin:0;padding-left:20px' },
        el('li', {}, 'Créez l’adresse Gmail dédiée (ou utilisez une adresse existante réservée aux alertes).'),
        el('li', {}, 'Dans le compte Google : Sécurité, puis activez la validation en deux étapes.'),
        el('li', {}, 'Toujours dans Sécurité, ouvrez « Mots de passe des applications », donnez un nom (AutoVeille) et copiez le code de 16 caractères ici.')))),
    el('details', { class: 'adv' }, el('summary', {}, 'Autre fournisseur que Gmail'),
      el('div', { class: 'body' }, el('div', { class: 'grid2' }, field('Serveur IMAP', text(d.imap, 'host')), field('Port', text(d.imap, 'port', { type: 'number' }))), field('Dossier', text(d.imap, 'mailbox')))),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: async () => { mailMsg.replaceChildren(el('span', { class: 'muted small' }, 'Test en cours…')); try { const r = await api('POST', '/api/sources/imap/test', d.imap); mailMsg.replaceChildren(el('div', { class: 'note ' + (r.ok ? 'ok' : 'warn') }, r.detail)); } catch (e) { mailMsg.replaceChildren(el('div', { class: 'note warn' }, e.message)); } } }, 'Tester la connexion'),
      el('button', { class: 'btn primary', onclick: async () => { try { const r = await api('PUT', '/api/settings', state.draft); state.settings = r.settings; state.draft = clone(r.settings); toast('Boîte mail enregistrée'); await render(); } catch (e) { toast(e.message, true); } } }, 'Enregistrer')),
    mailMsg);

  // Sites : l'état de l'alerte sur chacun, lu dans l'email de confirmation du site quand il existe.
  const setDone = async (s, done) => {
    d.alertsDone = { ...(d.alertsDone || {}), [s.key]: done };
    try { const r = await api('PUT', '/api/settings', state.draft); state.settings = r.settings; state.draft = clone(r.settings); toast(done ? `Alerte ${s.label} notée comme créée` : 'Noté'); await render(); } catch (err) { toast(err.message, true); }
  };
  const siteRow = (s) => {
    const a = s.alert;
    const done = Boolean(s.done || a);
    const status = a ? el('span', { class: 'badge ok' }, 'Alerte active') : done ? el('span', { class: 'badge ok' }, 'Alerte créée') : el('span', { class: 'badge warn' }, 'À créer');
    const manage = (a && a.manageUrl) || s.manageUrl || s.searchUrl;
    const confirmed = a ? el('p', { class: 'small' }, el('b', {}, 'Ce que le site enverra : '), a.criteria, a.confirmedAt ? el('span', { class: 'muted' }, ` (confirmé par le site ${fmt.ago(a.confirmedAt)})`) : null) : null;
    const issues = (s.issues || []).map((m) => el('div', { class: 'note warn' }, m));
    if (!issues.length && s.advice) issues.push(el('div', { class: 'note' }, s.advice));
    const howTo = el('p', { class: 'small muted' }, s.prefilled ? `La recherche pré-remplie prend ${s.alertRadiusKm} km autour de ${d.zone.city || 'la ville'}, ${fmt.int(s.alertMaxKm)} km au compteur maximum, vendeurs particuliers, toutes marques : exprès plus large que vos réglages. ` : '', s.help);
    const buttons = done
      ? el('div', { class: 'row' },
        el('a', { class: 'btn small', href: manage, target: '_blank', rel: 'noopener' }, svg('open'), 'Modifier l’alerte sur le site'),
        a ? null : el('button', { class: 'btn quiet small', type: 'button', onclick: () => setDone(s, false) }, 'Pas encore créée'))
      : el('div', { class: 'row' },
        el('a', { class: 'btn primary small', href: s.searchUrl, target: '_blank', rel: 'noopener' }, svg('open'), s.prefilled ? 'Créer l’alerte (recherche pré-remplie)' : 'Créer l’alerte sur le site'),
        el('button', { class: 'btn quiet small', type: 'button', onclick: () => setDone(s, true) }, 'C’est fait'));
    return el('div', { class: 'site' },
      el('div', { class: 'shead' }, el('h3', {}, s.label), status),
      confirmed,
      ...issues,
      done && !issues.length ? null : howTo,
      buttons);
  };
  const sites = el('section', { class: 'card section' }, el('h2', {}, 'Les alertes sur les sites'),
    el('p', { class: 'muted small' }, 'Chaque site envoie ses nouvelles annonces à la boîte mail ci-dessus. L’alerte se crée une fois, sur le site, et volontairement large (toutes marques, particuliers, un rayon et un kilométrage plus grands que vos réglages) : c’est l’application qui trie, et ce qu’elle écarte reste consultable dans « Écartées par les filtres ». Quand le site confirme l’alerte par email, elle apparaît ci-dessous avec ses critères.'),
    ...src.sites.filter((s) => MAIN_SITES.includes(s.key)).map(siteRow),
    el('details', { class: 'adv' }, el('summary', {}, 'Autres sites, facultatifs'), el('div', { class: 'body' }, ...src.sites.filter((s) => !MAIN_SITES.includes(s.key)).map(siteRow))));

  // Lecture directe
  const httpList = el('div', { class: 'stack' });
  const drawHttp = () => {
    httpList.replaceChildren(...d.httpSites.map((s) => {
      const run = (src.httpSites.find((x) => x.id === s.id) || {}).lastRun;
      return el('div', { class: 'site' },
        el('div', { class: 'shead' }, el('h3', {}, s.name), el('div', { class: 'row' }, status(run), el('button', { class: 'btn quiet small danger', onclick: () => { d.httpSites.splice(d.httpSites.indexOf(s), 1); drawHttp(); } }, 'Retirer'))),
        el('p', { class: 'small muted ellip' }, s.url),
        run ? el('p', { class: 'small' }, `${fmt.ago(run.last_run_at)} : ${run.detail}`) : null);
    }));
  };
  drawHttp();
  const newSite = { name: '', url: '' };
  const testMsg = el('div');
  const http = el('section', { class: 'card section' }, el('h2', {}, 'Un site sans alerte email'),
    el('p', { class: 'muted small' }, 'Réservé aux sites qui ne proposent pas d’alerte : collez l’adresse d’une page de résultats de recherche. L’application la relit toutes les 30 minutes, seulement si le site autorise la lecture automatique (sinon elle vous le dit).'),
    httpList,
    el('div', { class: 'grid2' }, field('Nom du site', text(newSite, 'name', { placeholder: 'Annonces-Automobile' })), field('Adresse de la page de résultats', text(newSite, 'url', { type: 'url', placeholder: 'https://…' }))),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: async () => { testMsg.replaceChildren(el('span', { class: 'muted small' }, 'Lecture en cours…')); try { const r = await api('POST', '/api/sources/http/test', { url: newSite.url }); testMsg.replaceChildren(el('div', { class: 'note ' + (r.ok ? 'ok' : 'warn') }, r.detail, r.sample?.length ? el('ul', { style: 'margin:6px 0 0;padding-left:18px' }, r.sample.map((x) => el('li', {}, `${x.title}${x.price ? ', ' + fmt.int(x.price) + ' €' : ''}${x.km ? ', ' + fmt.int(x.km) + ' km' : ''}${x.city ? ', ' + x.city : ''}`))) : null)); } catch (e) { testMsg.replaceChildren(el('div', { class: 'note warn' }, e.message)); } } }, 'Tester cette page'),
      el('button', { class: 'btn primary', onclick: async () => { if (!newSite.url) return toast('Indiquez l’adresse de la page.', true); d.httpSites.push({ id: Math.random().toString(36).slice(2, 10), name: newSite.name || 'Site', url: newSite.url, enabled: true }); try { const r = await api('PUT', '/api/settings', state.draft); state.settings = r.settings; state.draft = clone(r.settings); toast('Site ajouté'); await render(); } catch (e) { toast(e.message, true); } } }, 'Ajouter ce site')),
    testMsg,
    d.httpSites.length ? el('div', {}, el('button', { class: 'btn small', onclick: async () => { try { const r = await api('PUT', '/api/settings', state.draft); state.settings = r.settings; state.draft = clone(r.settings); toast('Enregistré'); await render(); } catch (e) { toast(e.message, true); } } }, 'Enregistrer les sites')) : null);

  // Journal
  const checkBtn = el('button', { class: 'btn', onclick: async () => { checkBtn.disabled = true; checkBtn.textContent = 'Vérification…'; try { const r = await api('POST', '/api/sources/check-now'); toast(r.mail.detail, !r.mail.ok); await render(); } catch (e) { toast(e.message, true); checkBtn.disabled = false; checkBtn.textContent = 'Vérifier maintenant'; } } }, 'Vérifier maintenant');
  const rereadBtn = el('button', { class: 'btn quiet small', onclick: async () => {
    if (!confirm('Relire toute la boîte mail depuis le début ? Les annonces déjà connues sont complétées, pas dupliquées. Utile après une mise à jour de l’application.')) return;
    rereadBtn.disabled = true; rereadBtn.textContent = 'Relecture…';
    try { const r = await api('POST', '/api/sources/reread'); toast(r.mail.detail, !r.mail.ok); await render(); } catch (e) { toast(e.message, true); rereadBtn.disabled = false; rereadBtn.textContent = 'Tout relire'; }
  } }, 'Tout relire');
  const journal = el('section', { class: 'card section' },
    el('div', { class: 'row between' }, el('h2', {}, 'Derniers emails reçus'), el('div', { class: 'row' }, rereadBtn, checkBtn)),
    src.emails.length
      ? el('table', { class: 'emails' }, el('thead', {}, el('tr', {}, el('th', {}, 'Reçu'), el('th', {}, 'Site'), el('th', {}, 'Sujet'), el('th', { class: 'n' }, 'Annonces'))),
        el('tbody', {}, src.emails.map((e) => {
          const tr = el('tr', { style: 'cursor:pointer', onclick: () => { detail.classList.toggle('hidden'); } }, el('td', {}, fmt.ago(e.received_at || e.processed_at)), el('td', {}, e.site || e.sender), el('td', { class: 'ellip', title: e.subject }, e.subject), el('td', { class: 'n' }, e.error ? el('span', { class: 'badge warn' }, 'Erreur') : [String(e.parsed_count), el('span', { class: 'unit' }, e.parsed_count > 1 ? ' annonces' : ' annonce')]));
          const detail = el('tr', { class: 'hidden' }, el('td', { colspan: 4 }, e.error ? el('div', { class: 'note warn' }, e.error) : (e.parsed?.listings?.length ? el('ul', { style: 'margin:0;padding-left:18px' }, e.parsed.listings.map((l) => el('li', {}, `${l.title}${l.price ? ', ' + fmt.int(l.price) + ' €' : ''}${l.km ? ', ' + fmt.int(l.km) + ' km' : ''}${l.year ? ', ' + l.year : ''}${l.city ? ', ' + l.city : ''}${l.sellerType === 'pro' ? ' (pro)' : ''}`))) : el('span', { class: 'muted small' }, `Aucune annonce reconnue dans cet email${e.parsed?.pending ? ' (' + e.parsed.pending + ' lien(s) non résolus)' : ''}.`))));
          return [tr, detail];
        })))
      : el('p', { class: 'muted small' }, 'Aucun email traité pour le moment.'));

  const advanced = el('details', { class: 'adv card section', open: d.httpSites.length > 0 }, el('summary', {}, 'Avancé : un site sans alerte email'), el('div', { class: 'body' }, http));
  http.classList.remove('card');
  return [el('div', { class: 'headline' }, el('h1', {}, 'Sites'), el('p', { class: 'muted' }, 'D’où viennent les annonces, et comment vérifier que tout fonctionne.')), mailbox, sites, journal, advanced];
}

// ---------- démarrage ----------
(async () => {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch { /* pas bloquant */ }
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'refresh') render(); });
  }
  await checkPushStatus();
  await render();
  setInterval(() => { if (state.me?.authenticated && (state.route === 'annonces' || state.route === 'annonce') && document.visibilityState === 'visible' && !document.activeElement?.matches('textarea')) render(); }, 60_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.route === 'annonces') render(); });
})();
