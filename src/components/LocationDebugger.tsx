import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

export function useLocationTracking() {
  const { user } = useAuth();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  const startTracking = async () => {
    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return false;
      }

      // Start watching position
      watchSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (newLocation) => {
          setLocation(newLocation);
          updateLocationInDatabase(newLocation);
        }
      );

      setIsTracking(true);
      setError(null);
      return true;
    } catch (err) {
      setError('Failed to start location tracking');
      console.error('Location tracking error:', err);
      return false;
    }
  };

  const stopTracking = () => {
    if (watchSubscription.current) {
      watchSubscription.current.remove();
      watchSubscription.current = null;
    }
    setIsTracking(false);
  };

  const updateLocationInDatabase = async (location: Location.LocationObject) => {
    if (!user) return;

    try {
      await apiService.updateLocation(user.id, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        accuracy: location.coords.accuracy,
      });
    } catch (error) {
      console.error('Error updating location in database:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied, using default location');
        // Return default Hosur location
        const defaultLocation = {
          coords: {
            latitude: 12.1372,
            longitude: 77.8253,
            altitude: null,
            accuracy: 10,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as Location.LocationObject;
        
        setLocation(defaultLocation);
        return defaultLocation;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });

      setLocation(currentLocation);
      console.log('Location tracking - current location:', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy
      });
      
      if (currentLocation) {
        updateLocationInDatabase(currentLocation);
      }
      return currentLocation;
    } catch (err) {
      setError('Failed to get current location, using default');
      console.error('Get location error:', err);
      return null;
    }
  };

  return {
    location,
    isTracking,
    error,
    startTracking,
    stopTracking,
    getCurrentLocation,
  };
}