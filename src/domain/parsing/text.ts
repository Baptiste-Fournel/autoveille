export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function withoutDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function fold(text: string): string {
  return withoutDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function titleCase(text: string): string {
  return cleanText(text)
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((part) => (part.length > 1 || /\p{L}/u.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}
