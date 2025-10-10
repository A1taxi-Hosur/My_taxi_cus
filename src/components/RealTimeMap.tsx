import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { Navigation, MapPin, Car } from 'lucide-react-native';
import GoogleMapView from './GoogleMapView';
import { realtimeService } from '../services/realtimeService';
import { apiService } from '../services/apiService';

interface RealTimeMapProps {
  rideId: string;
  pickupCoords: { latitude: number; longitude: number };
  destinationCoords?: { latitude: number; longitude: number };
  driverLocation?: { latitude: number; longitude: number };
  showDriverLocation?: boolean;
}

export default function RealTimeMap({
  rideId,
  pickupCoords,
  destinationCoords,
  driverLocation: initialDriverLocation,
  showDriverLocation = false,
}: RealTimeMapProps) {
  const mapRef = useRef<MapView>(null);
  const [driverLocation, setDriverLocation] = useState(initialDriverLocation);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: pickupCoords.latitude,
    longitude: pickupCoords.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    if (showDriverLocation && rideId) {
      // Subscribe to driver location updates
      const subscription = realtimeService.subscribeToDriverLocation(
        rideId,
        (location) => {
          setDriverLocation(location);
          
          // Update map region to include driver location
          if (mapRef.current) {
            const coordinates = [
              pickupCoords,
              location,
              ...(destinationCoords ? [destinationCoords] : []),
            ];
            
            mapRef.current.fitToCoordinates(coordinates, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [rideId, showDriverLocation]);

  useEffect(() => {
    // Calculate route between pickup and destination
    if (destinationCoords) {
      calculateRoute();
    }
  }, [pickupCoords, destinationCoords]);

  const calculateRoute = async () => {
    try {
      // In a production app, you would use Google Directions API or similar
      // For demo purposes, we'll create a simple straight line
      const route = [
        pickupCoords,
        destinationCoords!,
      ];
      setRouteCoordinates(route);
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  };

  const centerOnDriver = () => {
    if (driverLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }
  };

  const fitToMarkers = () => {
    if (mapRef.current) {
      const coordinates = [
        pickupCoords,
        ...(destinationCoords ? [destinationCoords] : []),
        ...(driverLocation ? [driverLocation] : []),
      ];
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }
  };

  return (
    <View style={styles.container}>
      <GoogleMapView
        initialRegion={{
          latitude: pickupCoords.latitude,
          longitude: pickupCoords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        pickupCoords={pickupCoords}
        destinationCoords={destinationCoords}
        driverLocation={driverLocation}
        showRoute={!!destinationCoords}
        style={styles.map}
      />

      {/* Map Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={fitToMarkers}
        >
          <Text style={styles.controlButtonText}>Fit View</Text>
        </TouchableOpacity>
        
        {showDriverLocation && driverLocation && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={centerOnDriver}
          >
            <Car size={16} color="#2563EB" />
            <Text style={styles.controlButtonText}>Driver</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'column',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  controlButtonText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
    marginLeft: 4,
  },
});