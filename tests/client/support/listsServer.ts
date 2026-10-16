import { vi } from 'vitest';
import type { ListedStatus, OverviewResponse, RejectedKindCountsDto, VehicleDto } from '../../../src/shared/api';
import { type FakeServer, json } from './fakeServer';
import { serverForSignedInDealer } from './testApplication';
import { overviewWith } from './vehicles';

export const THURSDAY_MORNING = new Date('2026-10-16T09:00:00.000Z');

export const itIsThursdayMorning = (): void => {
  vi.useFakeTimers({ now: THURSDAY_MORNING, toFake: ['Date'] });
};

export interface ListsServerOptions {
  readonly overview?: OverviewResponse;
  readonly kinds?: RejectedKindCountsDto;
}

export const serverWithLists = (
  lists: Partial<Record<ListedStatus, readonly VehicleDto[]>>,
  { overview = overviewWith(), kinds }: ListsServerOptions = {},
): FakeServer => {
  const server = serverForSignedInDealer();
  server.on('GET', '/api/overview', () => json(200, overview));
  server.on('GET', '/api/vehicles', (request) => {
    const status = request.query.get('status') ?? 'nouveau';
    const vehicles = Object.entries(lists).find(([listed]) => listed === status)?.[1] ?? [];
    return json(200, status === 'ecartees' ? { vehicles, nextCursor: null, kinds } : { vehicles, nextCursor: null });
  });
  return server;
};
