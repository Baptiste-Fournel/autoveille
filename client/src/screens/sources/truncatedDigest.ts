import type { TruncatedDigestDto } from '../../../../src/shared/api';

export const DIGEST_NOTICE_DAYS = 3;

const DAY_MS = 86_400_000;

export interface RecentDigest extends TruncatedDigestDto {
  readonly at: string;
}

export const recentDigest = (digest: TruncatedDigestDto | null, now: number): RecentDigest | null => {
  if (digest === null || digest.at === null) {
    return null;
  }
  return now - new Date(digest.at).getTime() < DIGEST_NOTICE_DAYS * DAY_MS ? { ...digest, at: digest.at } : null;
};
