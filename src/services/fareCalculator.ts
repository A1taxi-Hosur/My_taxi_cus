export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare: number;
  platformFee: number;
  deadheadCharge: number;
  deadheadDistance: number;
  totalFare: number;
  distance: number;
  duration: number;
}

export interface FareConfig {
  vehicle_type: string;
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  surge_multiplier: number;
  platform_fee?: number;
  platform_fee_percent?: number;
}

export const fareCalculator = {
  async calculateFare(
    pickup: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    vehicleType: string
  ): Promise<FareBreakdown | null> {
    return null;
  },

  async getAllVehicleConfigs(): Promise<FareConfig[]> {
    return [];
  },
};
