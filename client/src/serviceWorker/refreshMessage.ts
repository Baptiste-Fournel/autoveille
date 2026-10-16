import { isRecord } from '../guards/isRecord';

export const REFRESH_MESSAGE = { type: 'refresh' } as const;

export const isRefreshMessage = (data: unknown): boolean => isRecord(data) && data.type === REFRESH_MESSAGE.type;
