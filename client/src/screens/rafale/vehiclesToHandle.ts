import type { VehicleDto, VehiclesQuery } from '../../../../src/shared/api';
import type { ApiClient } from '../../api/client';

const TO_HANDLE: VehiclesQuery = { status: 'nouveau' };

const pagesFrom = async (api: Pick<ApiClient, 'vehicles'>, cursor: string | null): Promise<readonly VehicleDto[]> => {
  const page = await api.vehicles(cursor === null ? TO_HANDLE : { ...TO_HANDLE, cursor });
  return page.nextCursor === null ? page.vehicles : [...page.vehicles, ...(await pagesFrom(api, page.nextCursor))];
};

export const vehiclesToHandle = async (api: Pick<ApiClient, 'vehicles'>): Promise<readonly VehicleDto[]> =>
  (await pagesFrom(api, null)).filter((vehicle) => vehicle.matched && !vehicle.doNotContact);
