export function formatInteger(value: number): string {
  return value.toLocaleString('fr-FR').replace(/[\u00a0\u202f]/g, ' ');
}
