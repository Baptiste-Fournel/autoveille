import { HTTP_SITE_ADDRESS_MISSING } from '../../domain/presentation/httpSites.js';
import type { RawListing } from '../../domain/vehicle/types.js';
import { type ReadSitePageDependencies, readSitePage } from './readSitePage.js';

export interface HttpSiteTest {
  readonly ok: boolean;
  readonly detail: string;
  readonly sample?: readonly RawListing[];
}

const SAMPLE_SIZE = 5;

export const testHttpSite = async (dependencies: ReadSitePageDependencies, address: string): Promise<HttpSiteTest> => {
  const url = address.trim();
  if (!url) {
    return { ok: false, detail: HTTP_SITE_ADDRESS_MISSING };
  }
  const reading = await readSitePage(dependencies, url);
  return { ok: reading.ok, detail: reading.detail, sample: reading.listings.slice(0, SAMPLE_SIZE) };
};
