export interface NamedVehicle {
  readonly make?: string | null;
  readonly model?: string | null;
}

export const vehicleName = (vehicle: NamedVehicle, listingTitle: string): string =>
  [vehicle.make, vehicle.model].filter(Boolean).join(' ') || listingTitle;
