export class VehicleNotFound extends Error {
  readonly vehicleId: number;

  constructor(vehicleId: number) {
    super(String(vehicleId));
    this.name = 'VehicleNotFound';
    this.vehicleId = vehicleId;
  }
}
