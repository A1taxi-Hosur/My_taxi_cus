import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import * as Location from 'expo-location';
import { supabase } from '../utils/supabase';

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

interface LocationObject {
  coords: LocationCoords;
  timestamp: number;
}

class LocationService {
  private watchId: number | null = null;
  private isTracking = false;
  private lastKnownLocation: LocationObject | null = null;

  async requestLocationPermission(): Promise<boolean> {
    try {
      console.log('🔍 Requesting location permission for platform:', Platform.OS);
      
      if (Platform.OS === 'web') {
        // For web, use browser geolocation
        return new Promise((resolve) => {
          if (navigator.geolocation) {
            console.log('🌐 Web geolocation available, testing...');
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log('✅ Web geolocation test successful:', {
                  lat: position.coords.latitude,
                  lon: position.coords.longitude,
                  accuracy: position.coords.accuracy
                });
                resolve(true);
              },
              (error) => {
                console.error('❌ Web geolocation test failed:', error);
                resolve(false);
              },
              { timeout: 10000 }
            );
          } else {
            console.log('❌ Web geolocation not available');
            resolve(false);
          }
        });
      }

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to find nearby drivers.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log('📱 Android location permission:', hasPermission ? 'GRANTED' : 'DENIED');
        return hasPermission;
      }

      // For iOS, use Expo Location
      const { status } = await Location.requestForegroundPermissionsAsync();
      const hasPermission = status === 'granted';
      console.log('🍎 iOS location permission:', hasPermission ? 'GRANTED' : 'DENIED');
      return hasPermission;
    } catch (error) {
      console.error('❌ Error requesting location permission:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationObject | null> {
    console.log('📍 Starting location detection process...');
    console.log('🌍 Platform:', Platform.OS);
    
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        console.error('❌ Location permission denied');
        throw new Error('Location permission denied');
      }

      console.log('✅ Location permission granted, getting position...');

      if (Platform.OS === 'web') {
        return this.getCurrentLocationWeb();
      }

      // Try React Native Geolocation Service first
      console.log('🎯 Trying React Native Geolocation Service...');
      try {
        const location = await this.getCurrentLocationGeolocation();
        if (location && this.isValidCoordinate(location.coords.latitude, location.coords.longitude)) {
          console.log('✅ Geolocation Service successful');
          return location;
        }
      } catch (geoError) {
        console.warn('⚠️ Geolocation Service failed, trying Expo Location:', geoError);
      }

      // Fallback to Expo Location
      console.log('🔄 Falling back to Expo Location...');
      return await this.getCurrentLocationExpo();

    } catch (error) {
      console.error('❌ All location methods failed:', error);
      throw error;
    }
  }

  private async getCurrentLocationGeolocation(): Promise<LocationObject | null> {
    return new Promise((resolve, reject) => {
      console.log('🎯 Getting position with Geolocation Service...');
      
      Geolocation.getCurrentPosition(
        (position) => {
          console.log('📍 Raw Geolocation Service position:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: new Date(position.timestamp).toLocaleString()
          });
          
          const location: LocationObject = {
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed,
            },
            timestamp: position.timestamp,
          };

          // Validate coordinates
          if (this.isValidCoordinate(location.coords.latitude, location.coords.longitude)) {
            console.log('✅ Valid coordinates from Geolocation Service');
            
            // Check accuracy
            if (location.coords.accuracy && location.coords.accuracy > 100) {
              console.warn('⚠️ Low accuracy GPS reading:', location.coords.accuracy + 'm');
            } else {
              console.log('✅ Good accuracy GPS reading:', location.coords.accuracy + 'm');
            }
            
            this.lastKnownLocation = location;
            resolve(location);
          } else {
            console.error('❌ Invalid coordinates from Geolocation Service:', location.coords);
            reject(new Error('Invalid GPS coordinates from Geolocation Service'));
          }
        },
        (error) => {
          console.error('❌ Geolocation Service error:', {
            code: error.code,
            message: error.message,
            PERMISSION_DENIED: error.PERMISSION_DENIED,
            POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
            TIMEOUT: error.TIMEOUT
          });
          reject(error);
        },
        {
          accuracy: {
            android: 'high',
            ios: 'bestForNavigation',
          },
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 5000, // Use cached location if less than 5 seconds old
          distanceFilter: 0,
          forceRequestLocation: true,
          forceLocationManager: false,
          showLocationDialog: true,
        }
      );
    });
  }

  private async getCurrentLocationWeb(): Promise<LocationObject | null> {
    return new Promise((resolve, reject) => {
      console.log('🌐 Getting web geolocation...');
      
      if (!navigator.geolocation) {
        console.error('❌ Geolocation not supported in this browser');
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('📍 Raw web geolocation position:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp).toLocaleString()
          });
          
          const location: LocationObject = {
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed,
            },
            timestamp: position.timestamp,
          };

          if (this.isValidCoordinate(location.coords.latitude, location.coords.longitude)) {
            console.log('✅ Valid web coordinates');
            this.lastKnownLocation = location;
            resolve(location);
          } else {
            console.error('❌ Invalid web coordinates:', location.coords);
            reject(new Error('Invalid web coordinates'));
          }
        },
        (error) => {
          console.error('❌ Web Geolocation error:', {
            code: error.code,
            message: error.message
          });
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 5000,
        }
      );
    });
  }

  private async getCurrentLocationExpo(): Promise<LocationObject | null> {
    console.log('🔄 Getting Expo Location...');
    
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.error('❌ Expo Location permission denied');
      throw new Error('Expo Location permission denied');
    }

    const expoLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
      timeout: 30000,
      maximumAge: 5000,
    });

    console.log('📍 Raw Expo Location position:', {
      latitude: expoLocation.coords.latitude,
      longitude: expoLocation.coords.longitude,
      accuracy: expoLocation.coords.accuracy,
      timestamp: new Date(expoLocation.timestamp).toLocaleString()
    });

    const location: LocationObject = {
      coords: {
        latitude: expoLocation.coords.latitude,
        longitude: expoLocation.coords.longitude,
        accuracy: expoLocation.coords.accuracy,
        altitude: expoLocation.coords.altitude,
        heading: expoLocation.coords.heading,
        speed: expoLocation.coords.speed,
      },
      timestamp: expoLocation.timestamp,
    };

    if (this.isValidCoordinate(location.coords.latitude, location.coords.longitude)) {
      console.log('✅ Valid Expo Location coordinates');
      this.lastKnownLocation = location;
      return location;
    } else {
      console.error('❌ Invalid Expo Location coordinates:', location.coords);
      throw new Error('Invalid Expo coordinates');
    }
  }

  async startLocationTracking(userId: string): Promise<boolean> {
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      console.log('🎯 Starting location tracking for user:', userId);

      if (Platform.OS === 'web') {
        this.startWebLocationTracking(userId);
        return true;
      }

      this.watchId = Geolocation.watchPosition(
        (position) => {
          console.log('📍 Location tracking update:', {
            userId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });

          const location: LocationObject = {
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed,
            },
            timestamp: position.timestamp,
          };

          if (this.isValidCoordinate(location.coords.latitude, location.coords.longitude)) {
            this.lastKnownLocation = location;
            this.updateLocationInDatabase(userId, location);
          }
        },
        (error) => {
          console.error('❌ Location tracking error:', error);
        },
        {
          accuracy: {
            android: 'high',
            ios: 'bestForNavigation',
          },
          enableHighAccuracy: true,
          distanceFilter: 5,
          interval: 5000,
          fastestInterval: 2000,
          forceRequestLocation: true,
          forceLocationManager: false,
          showLocationDialog: true,
        }
      );

      this.isTracking = true;
      console.log('✅ Location tracking started successfully');
      return true;
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      return false;
    }
  }

  private startWebLocationTracking(userId: string) {
    const trackLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location: LocationObject = {
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            };

            if (this.isValidCoordinate(location.coords.latitude, location.coords.longitude)) {
              this.lastKnownLocation = location;
              this.updateLocationInDatabase(userId, location);
            }
          },
          (error) => console.error('❌ Web location tracking error:', error),
          { enableHighAccuracy: true, maximumAge: 5000 }
        );
      }
    };

    const intervalId = setInterval(trackLocation, 5000);
    this.watchId = intervalId as any;
    this.isTracking = true;
  }

  private async updateLocationInDatabase(userId: string, location: LocationObject) {
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
        console.error('❌ Error updating location in database:', error);
      } else {
        console.log('✅ Location updated in database for user:', userId);
      }
    } catch (error) {
      console.error('❌ Error updating location:', error);
    }
  }

  stopLocationTracking() {
    if (this.watchId !== null) {
      if (Platform.OS === 'web') {
        clearInterval(this.watchId);
      } else {
        Geolocation.clearWatch(this.watchId);
      }
      this.watchId = null;
    }
    this.isTracking = false;
    console.log('🛑 Location tracking stopped');
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      console.log('🗺️ Reverse geocoding coordinates:', { latitude, longitude });
      
      if (Platform.OS === 'web') {
        return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      }

      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        
        console.log('📍 Geocoded address components:', address);
        
        const addressParts = [
          address.street,
          address.district,
          address.city,
          address.region
        ].filter(Boolean);
        
        const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Unknown location';
        console.log('📍 Final geocoded address:', fullAddress);
        return fullAddress;
      } catch (geocodeError) {
        console.warn('⚠️ Geocoding failed, using coordinates:', geocodeError);
        return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      }
    } catch (error) {
      console.error('❌ Error reverse geocoding:', error);
      return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
    }
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Ensure all coordinates are numbers
    const latitude1 = parseFloat(lat1.toString());
    const longitude1 = parseFloat(lon1.toString());
    const latitude2 = parseFloat(lat2.toString());
    const longitude2 = parseFloat(lon2.toString());

    console.log('📏 Calculating distance between:', {
      point1: { lat: latitude1, lon: longitude1 },
      point2: { lat: latitude2, lon: longitude2 }
    });

    // Validate coordinates
    if (!this.isValidCoordinate(latitude1, longitude1) || !this.isValidCoordinate(latitude2, longitude2)) {
      console.error('❌ Invalid coordinates for distance calculation:', { lat1, lon1, lat2, lon2 });
      return 999;
    }

    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(latitude2 - latitude1);
    const dLon = this.toRadians(longitude2 - longitude1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(latitude1)) * Math.cos(this.toRadians(latitude2)) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    console.log('📏 Calculated distance:', distance.toFixed(2) + ' km');
    
    return distance;
  }

  calculateETA(driverLocation: any, destination: any, averageSpeed = 30): number {
    const distance = this.calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      destination.latitude,
      destination.longitude
    );
    
    const etaMinutes = (distance / averageSpeed) * 60;
    return Math.round(Math.max(etaMinutes, 1));
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private isValidCoordinate(latitude: number, longitude: number): boolean {
    const isValid = (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !(latitude === 0 && longitude === 0) // Reject null island
    );

    if (!isValid) {
      console.error('❌ Invalid coordinates detected:', { latitude, longitude });
    }

    return isValid;
  }

  getIsTracking(): boolean {
    return this.isTracking;
  }

  getLastKnownLocation(): LocationObject | null {
    return this.lastKnownLocation;
  }
}

export const locationService = new LocationService();