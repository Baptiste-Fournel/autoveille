export const earlierPublishedAt = (current: string | null, candidate: string | undefined): string | undefined =>
  candidate && (!current || candidate < current) ? candidate : undefined;
