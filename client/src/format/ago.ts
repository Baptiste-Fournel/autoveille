const MINUTE_S = 60;

const HOUR_S = 3600;

const DAY_S = 86400;

const TWO_DAYS_S = 172800;

const clockTime = (date: Date): string => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const ago = (iso: string | null | undefined, now: number): string => {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const elapsed = (now - date.getTime()) / 1000;
  const today = new Date(now);
  if (elapsed < MINUTE_S) {
    return 'à l’instant';
  }
  if (elapsed < HOUR_S) {
    return `il y a ${Math.floor(elapsed / MINUTE_S)} min`;
  }
  if (elapsed < DAY_S && date.getDate() === today.getDate()) {
    return `aujourd’hui à ${clockTime(date)}`;
  }
  if (elapsed < TWO_DAYS_S) {
    return `hier à ${clockTime(date)}`;
  }
  const sameYear = date.getFullYear() === today.getFullYear();
  return `le ${date.toLocaleDateString('fr-FR', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })}`;
};
