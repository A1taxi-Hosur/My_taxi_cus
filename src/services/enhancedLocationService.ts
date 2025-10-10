import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import * as Location from 'expo-location';
import { googleMapsService } from './googleMapsService';

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

interface LocationWithAddress {
  coords: LocationCoords;
  address: string;
  timestamp: number;
}

class EnhancedLocationService {
  private watchId: number | null = null;
  private isTracking = false;
  private lastKnownLocation: LocationObject | null = null;
  private locationCache = new Map<string, { address: string; timestamp: number }>();

  async requestLocationPermission(): Promise<boolean> {
    try {
      console.log('🔍 Requesting location permission for platform:', Platform.OS);
      
      if (Platform.OS === 'web') {
        return new Promise((resolve) => {
          if (navigator.geolocation) {
            // For web, we need to actually request permission
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
              if (result.state === 'granted') {
                resolve(true);
              } else if (result.state === 'prompt') {
                // Try to get position to trigger permission prompt
                navigator.geolocation.getCurrentPosition(
                  () => resolve(true),
                  () => resolve(false),
                  { timeout: 5000 }
                );
              } else {
                console.warn('⚠️ Geolocation permission denied by browser');
                resolve(false);
              }
            }).catch(() => {
              // Fallback for browsers that don't support permissions API
              navigator.geolocation.getCurrentPosition(
                () => resolve(true),
                () => resolve(false),
                { timeout: 5000 }
              );
            });
          } else {
            console.warn('⚠️ Geolocation not supported in this browser');
            resolve(false);
          }
        });
      }

      if (Platform.OS === 'android') {
        console.log('📱 Requesting Android location permissions...');
        
        // Request both fine and coarse location permissions
        const fineLocationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission Required',
            message: 'A1 Taxi needs access to your location to find nearby drivers and provide accurate pickup services.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Deny',
            buttonPositive: 'Allow',
          }
        );
        
        console.log('📱 Fine location permission result:', fineLocationGranted);
        
        if (fineLocationGranted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Android fine location permission granted');
          return true;
        }
        
        // If fine location denied, try coarse location as fallback
        const coarseLocationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          {
            title: 'Basic Location Permission',
            message: 'A1 Taxi needs basic location access to provide ride services.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Deny',
            buttonPositive: 'Allow',
          }
        );
        
        console.log('📱 Coarse location permission result:', coarseLocationGranted);
        return coarseLocationGranted === PermissionsAndroid.RESULTS.GRANTED;
      }

      // For iOS
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ Error requesting location permission:', error);
      return false;
    }
  }

  async getCurrentLocationWithAddress(): Promise<LocationWithAddress | null> {
    try {
      console.log('🔍 Enhanced Location Service: Getting current location with address...');
      const location = await this.getCurrentLocation();
      if (!location) {
        console.error('❌ Enhanced Location Service: Failed to get location');
        return null;
      }

      console.log('📍 Enhanced Location Service: Got location:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      });

      const address = await this.reverseGeocodeWithGoogle(
        location.coords.latitude,
        location.coords.longitude
      );

      console.log('🏠 Enhanced Location Service: Got address:', address);

      return {
        coords: location.coords,
        address,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Error getting location with address:', error);
      return null;
    }
  }

  async getCurrentLocation(): Promise<LocationObject | null> {
    console.log('📍 Enhanced Location Service: Starting location detection...');
    console.log('🌍 Platform:', Platform.OS);
    
    try {
      // For Android, check if permission is already granted before requesting
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (!hasPermission) {
          console.log('📱 Location permission not granted, requesting...');
          const granted = await this.requestLocationPermission();
          if (!granted) {
            console.error('❌ Enhanced Location Service: Location permission denied');
            return null;
          }
        }
      } else {
        const hasPermission = await this.requestLocationPermission();
        if (!hasPermission) {
          console.error('❌ Enhanced Location Service: Location permission denied');
          return null;
        }
      }

      console.log('✅ Enhanced Location Service: Permission granted, attempting detection...');

      if (Platform.OS === 'web') {
        return this.getCurrentLocationWeb();
      }

      // Try high-accuracy GPS first
      try {
        console.log('🎯 Enhanced Location Service: Attempting high accuracy GPS...');
        const location = await this.getCurrentLocationHighAccuracy();
        if (location && this.isValidCoordinate(location.coords.latitude, location.coords.longitude)) {
          console.log('✅ Enhanced Location Service: High accuracy location obtained:', {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy + 'm'
          });
          return location;
        }
      } catch (geoError) {
        console.warn('⚠️ Enhanced Location Service: High accuracy GPS failed, trying standard:', geoError.message);
      }

      // Fallback to standard accuracy
      console.log('🔄 Enhanced Location Service: Falling back to standard accuracy...');
      return await this.getCurrentLocationStandard();

    } catch (error) {
      console.error('❌ Enhanced Location Service: All location methods failed:', error);
      return null;
    }
  }

  private async getCurrentLocationHighAccuracy(): Promise<LocationObject | null> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
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
            resolve(location);
          } else {
            reject(new Error('Invalid coordinates'));
          }
        },
        (error) => reject(error),
        {
          accuracy: {
            android: 'high',
            ios: 'bestForNavigation',
          },
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 5000,
          distanceFilter: 0,
          forceRequestLocation: true,
          forceLocationManager: false,
          showLocationDialog: true,
        }
      );
    });
  }

  private async getCurrentLocationStandard(): Promise<LocationObject | null> {
    console.log('📱 Using Expo Location for standard accuracy...');
    
    const expoLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeout: 20000,
      maximumAge: 5000,
    });

    console.log('📍 Expo Location result:', {
      lat: expoLocation.coords.latitude,
      lng: expoLocation.coords.longitude,
      accuracy: expoLocation.coords.accuracy + 'm'
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
      console.log('✅ Valid standard accuracy location obtained');
      this.lastKnownLocation = location;
      return location;
    }

    throw new Error('Invalid coordinates from standard location');
  }

  private async getCurrentLocationWeb(): Promise<LocationObject | null> {
    return new Promise((resolve, reject) => {
      console.log('🌐 Enhanced Location Service: Getting web geolocation...');
      
      if (!navigator.geolocation) {
        console.error('❌ Enhanced Location Service: Geolocation not supported in browser');
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('📍 Enhanced Location Service: Web geolocation result:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy + 'm'
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
            console.log('✅ Enhanced Location Service: Valid web location obtained');
            this.lastKnownLocation = location;
            resolve(location);
          } else {
            console.error('❌ Enhanced Location Service: Invalid web coordinates:', location.coords);
            reject(new Error('Invalid web coordinates'));
          }
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 1000,
        }
      );
    });
  }

  async reverseGeocodeWithGoogle(latitude: number, longitude: number): Promise<string> {
    try {
      console.log('🗺️ Reverse geocoding coordinates:', { latitude, longitude });
      
      try {
        // Use Google Maps Geocoding API through proxy for accurate address
        const address = await googleMapsService.reverseGeocode(latitude, longitude);
        
        if (address && !address.startsWith('Location (')) {
          console.log('✅ Geocoded address:', address);
          return address;
        }
        
        throw new Error('No valid address from geocoding API');
      } catch (geocodeError) {
        console.warn('⚠️ Google geocoding failed, using coordinate fallback:', geocodeError.message);
        
        // Fallback to coordinate display
        const fallbackAddress = `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        console.log('⚠️ Using fallback address:', fallbackAddress);
        return fallbackAddress;
      }
    } catch (error) {
      console.warn('⚠️ Reverse geocoding error, using coordinates:', error.message);
      return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
    }
  }

  async calculateAccurateDistance(
    pickup: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<{ distance: number; duration: number; polyline?: string } | null> {
    try {
      console.log('🗺️ Calculating distance using haversine formula (fallback method)');
      
      // Use haversine calculation for distance
      const distance = this.calculateHaversineDistance(
        pickup.latitude,
        pickup.longitude,
        destination.latitude,
        destination.longitude
      );

      console.log('📏 Haversine distance calculated:', distance, 'km');

      return {
        distance,
        duration: (distance / 30) * 60, // Estimate 30 km/h average speed
      };
    } catch (error) {
      console.error('Error calculating accurate distance:', error);
      
      // Fallback to haversine calculation
      const distance = this.calculateHaversineDistance(
        pickup.latitude,
        pickup.longitude,
        destination.latitude,
        destination.longitude
      );

      return {
        distance,
        duration: (distance / 30) * 60,
      };
    }
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !(latitude === 0 && longitude === 0)
    );
  }

  // Start continuous location tracking
  async startLocationTracking(userId: string, onLocationUpdate: (location: LocationObject) => void): Promise<boolean> {
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      if (Platform.OS === 'web') {
        this.startWebLocationTracking(onLocationUpdate);
        return true;
      }

      this.watchId = Geolocation.watchPosition(
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
            onLocationUpdate(location);
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
          distanceFilter: 5, // Update every 5 meters
          interval: 3000, // Update every 3 seconds
          fastestInterval: 1000,
          forceRequestLocation: true,
          forceLocationManager: false,
          showLocationDialog: true,
        }
      );

      this.isTracking = true;
      return true;
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      return false;
    }
  }

  private startWebLocationTracking(onLocationUpdate: (location: LocationObject) => void) {
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
              onLocationUpdate(location);
            }
          },
          (error) => console.error('❌ Web location tracking error:', error),
          { enableHighAccuracy: true, maximumAge: 3000 }
        );
      }
    };

    const intervalId = setInterval(trackLocation, 3000);
    this.watchId = intervalId as any;
    this.isTracking = true;
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
  }

  getIsTracking(): boolean {
    return this.isTracking;
  }

  calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  getLastKnownLocation(): LocationObject | null {
    return this.lastKnownLocation;
  }
}

export const enhancedLocationService = new EnhancedLocationService();