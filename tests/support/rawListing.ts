import type { RawListing } from '../../src/domain/vehicle/types.js';

export const rawListing = (title: string, fields: Partial<RawListing> = {}): RawListing => ({
  site: 'test',
  siteLabel: 'Test',
  externalId: '1',
  url: 'https://x/1',
  title,
  ...fields,
});
