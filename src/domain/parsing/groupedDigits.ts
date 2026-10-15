export function parseGroupedDigits(digits: string): number {
  return Number(digits.replace(/[\s.]/g, ''));
}

export const digitGroups = (digits: string): readonly string[] => digits.split(/[ .]/);
