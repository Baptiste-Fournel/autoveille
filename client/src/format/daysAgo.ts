const DAY_MS = 86_400_000;

export const daysAgo = (iso: string | null | undefined, now: number): string => {
  if (!iso) {
    return '';
  }
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) {
    return 'aujourd’hui';
  }
  return days === 1 ? 'hier' : `il y a ${days} j`;
};
