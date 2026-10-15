export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function standaloneWordPattern(word: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\d])${escapeRegExp(word)}(?=$|[^\\p{L}\\d])`, 'iu');
}
