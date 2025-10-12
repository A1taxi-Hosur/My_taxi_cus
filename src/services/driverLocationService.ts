export interface AvailableDriver {
  driver_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  vehicle_type?: string;
  rating?: number;
  distance?: number;
  updated_at?: string;
}

export const driverLocationService = {
  startPolling(
    latitude: number,
    longitude: number,
    callback: (drivers: AvailableDriver[]) => void,
    vehicleType?: string,
    interval?: number
  ) {},

  stopPolling() {},
};
