import type { EmailKind } from './emailKind.js';

interface DigestCount {
  readonly site: string | null | undefined;
  readonly kind: EmailKind;
  readonly announced: number | undefined;
  readonly received: number;
}

export interface TruncatedNewAdsDigest {
  readonly site: string;
  readonly announced: number;
  readonly received: number;
}

const MISSING_ADS_WORTH_A_NOTIFICATION = 3;

export const truncatedNewAdsDigest = ({ site, kind, announced, received }: DigestCount): TruncatedNewAdsDigest | undefined =>
  site && kind === 'new' && announced && announced > received ? { site, announced, received } : undefined;

export const notifiesTruncatedDigest = (digest: TruncatedNewAdsDigest): boolean =>
  digest.announced - digest.received >= MISSING_ADS_WORTH_A_NOTIFICATION;
