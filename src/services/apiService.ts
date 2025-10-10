import { supabase } from '../utils/supabase';

const API_BASE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;

class ApiService {
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Ride API endpoints
  async createRide(rideData: any) {
    return this.makeRequest('/ride-api/create', {
      method: 'POST',
      body: JSON.stringify(rideData),
    });
  }

  async acceptRide(rideId: string, driverId: string) {
    return this.makeRequest('/ride-api/accept', {
      method: 'POST',
      body: JSON.stringify({ rideId, driverId }),
    });
  }

  async updateRideStatus(rideId: string, status: string, driverId: string, data?: any) {
    return this.makeRequest('/ride-api/update-status', {
      method: 'POST',
      body: JSON.stringify({ rideId, status, driverId, data }),
    });
  }

  async findNearbyDrivers(latitude: number, longitude: number, vehicleType: string) {
    return this.makeRequest('/ride-api/find-drivers', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, vehicleType }),
    });
  }

  async getRideDetails(rideId: string) {
    return this.makeRequest(`/ride-api/ride/${rideId}`);
  }

  // Direct notification API
  async sendDriverNotifications(rideId: string, driverUserIds: string[], rideData: any) {
    return this.makeRequest('/notifications/send-ride-request', {
      method: 'POST',
      body: JSON.stringify({
        rideId,
        driverUserIds,
        rideData,
      }),
    });
  }

  // Location API endpoints
  async updateLocation(userId: string, location: any) {
    return this.makeRequest('/location-sync/update', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading,
        speed: location.speed,
        accuracy: location.accuracy,
      }),
    });
  }

  async getDriverLocation(userId: string) {
    return this.makeRequest(`/location-sync/track?userId=${userId}`);
  }
}

export const apiService = new ApiService();