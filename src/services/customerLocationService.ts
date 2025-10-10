import * as Location from 'expo-location';
import { supabase } from '../utils/supabase';
import { locationService } from './locationService';

class CustomerLocationService {
  private watchSubscription: Location.LocationSubscription | null = null;
  private isSharing = false;
  private currentRideId: string | null = null;

  async startSharingLocation(userId: string, rideId: string) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      this.currentRideId = rideId;
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        async (location) => {
          await this.updateCustomerLocation(userId, location);
        }
      );

      this.isSharing = true;
      return true;
    } catch (error) {
      console.error('Error starting customer location sharing:', error);
      return false;
    }
  }

  stopSharingLocation() {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    this.isSharing = false;
    this.currentRideId = null;
  }

  private async updateCustomerLocation(userId: string, location: Location.LocationObject) {
    try {
      const { error } = await supabase
        .from('live_locations')
        .upsert({
          user_id: userId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading || null,
          speed: location.coords.speed || null,
          accuracy: location.coords.accuracy || null,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error updating customer location:', error);
      }
    } catch (error) {
      console.error('Error updating customer location:', error);
    }
  }

  async getCurrentLocation(userId: string) {
    try {
      const { data, error } = await supabase
        .from('live_locations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error getting customer location:', error);
      return { data: null, error };
    }
  }

  getIsSharing() {
    return this.isSharing;
  }

  getCurrentRideId() {
    return this.currentRideId;
  }
}

export const customerLocationService = new CustomerLocationService();