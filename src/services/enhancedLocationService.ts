export const enhancedLocationService = {
  async requestLocationPermission(): Promise<boolean> {
    return false;
  },

  async getCurrentLocationWithAddress() {
    return null;
  },

  calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return 0;
  },
};
