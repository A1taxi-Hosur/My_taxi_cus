import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { MapPin, Navigation, Car } from 'lucide-react-native';
import { GOOGLE_MAPS_API_KEY, HOSUR_COORDINATES } from '../config/maps';
import { googleMapsService } from '../services/googleMapsService';
import { enhancedLocationService } from '../services/enhancedLocationService';
import { AvailableDriver } from '../services/driverLocationService';

interface EnhancedGoogleMapViewProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  pickupCoords?: { latitude: number; longitude: number };
  destinationCoords?: { latitude: number; longitude: number };
  driverLocation?: { latitude: number; longitude: number };
  availableDrivers?: AvailableDriver[];
  showRoute?: boolean;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onRouteReady?: (result: { distance: number; duration: number }) => void;
  style?: any;
  showUserLocation?: boolean;
  followUserLocation?: boolean;
}

export interface MapRef {
  fitToCoordinates: (coordinates: any[], options?: any) => void;
  animateToRegion: (region: any, duration?: number) => void;
  getMapBoundaries: () => Promise<any>;
}

const EnhancedGoogleMapView = forwardRef<MapRef, EnhancedGoogleMapViewProps>(({
  initialRegion,
  pickupCoords,
  destinationCoords,
  driverLocation,
  availableDrivers = [],
  showRoute = false,
  onMapPress,
  onRouteReady,
  style,
  showUserLocation = true,
  followUserLocation = false,
}, ref) => {
  const mapRef = useRef<MapView>(null);
  const [mapRegion, setMapRegion] = useState(initialRegion || HOSUR_COORDINATES);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coordinates: any[], options?: any) => {
      if (mapRef.current && isMapReady) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
          animated: true,
          ...options,
        });
      }
    },
    animateToRegion: (region: any, duration: number = 1000) => {
      if (mapRef.current && isMapReady) {
        mapRef.current.animateToRegion(region, duration);
      }
    },
    getMapBoundaries: async () => {
      if (mapRef.current && isMapReady) {
        return await mapRef.current.getMapBoundaries();
      }
      return null;
    },
  }));

  useEffect(() => {
    if (showUserLocation) {
      getCurrentUserLocation();
    }
  }, [showUserLocation]);

  useEffect(() => {
    if (showRoute && pickupCoords && destinationCoords) {
      calculateAndDisplayRoute();
    }
  }, [showRoute, pickupCoords, destinationCoords]);

  useEffect(() => {
    if (isMapReady) {
      console.log('🗺️ [MAP] ===== FITTING MAP TO MARKERS =====');
      console.log('🗺️ [MAP] Available drivers for markers:', availableDrivers.length);
      console.log('🗺️ [MAP] Driver details for markers:', availableDrivers.map(d => ({
        driver_id: d.driver_id,
        vehicle_type: d.vehicle_type,
        coordinates: { lat: d.latitude, lng: d.longitude }
      })));
      fitMapToMarkers();
    }
  }, [isMapReady, pickupCoords, destinationCoords, driverLocation, userLocation, availableDrivers]);

  const getCurrentUserLocation = async () => {
    try {
      const location = await enhancedLocationService.getCurrentLocation();
      if (location) {
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Update map region if no other coordinates are set
        if (!pickupCoords && !destinationCoords) {
          setMapRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      }
    } catch (error) {
      console.error('Error getting user location:', error);
    }
  };

  const calculateAndDisplayRoute = async () => {
    if (!pickupCoords || !destinationCoords) return;

    try {
      console.log('🗺️ Calculating route between:', pickupCoords, 'and', destinationCoords);
      
      // Use Google Directions API through proxy for accurate routing
      const directions = await googleMapsService.getDirections(
        { lat: pickupCoords.latitude, lng: pickupCoords.longitude },
        { lat: destinationCoords.latitude, lng: destinationCoords.longitude }
      );

      if (directions) {
        console.log('✅ Got directions from Google API:', directions);
        
        // Decode polyline for route display
        const decodedRoute = googleMapsService.decodePolyline(directions.polyline.points);
        setRouteCoordinates(decodedRoute);
        
        onRouteReady?.({
          distance: directions.distance.value / 1000, // Convert to km
          duration: directions.duration.value / 60, // Convert to minutes
        });
      } else {
        console.log('⚠️ Google Directions failed, using fallback calculation');
        // Fallback to simple distance calculation
        const distance = enhancedLocationService.calculateHaversineDistance(
          pickupCoords.latitude,
          pickupCoords.longitude,
          destinationCoords.latitude,
          destinationCoords.longitude
        );
        
        const duration = (distance / 30) * 60; // Estimate 30 km/h average speed
        
        // Set simple straight line route
        setRouteCoordinates([pickupCoords, destinationCoords]);
        
        onRouteReady?.({
          distance,
          duration,
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      
      // Always show at least a straight line
      const distance = enhancedLocationService.calculateHaversineDistance(
        pickupCoords.latitude,
        pickupCoords.longitude,
        destinationCoords.latitude,
        destinationCoords.longitude
      );
      
      setRouteCoordinates([pickupCoords, destinationCoords]);
      
      onRouteReady?.({
        distance,
        duration: (distance / 30) * 60,
      });
    }
  };


  const fitMapToMarkers = () => {
    if (!mapRef.current || !isMapReady) return;

    const coordinates = [
      ...(userLocation && showUserLocation ? [userLocation] : []),
      ...(pickupCoords ? [pickupCoords] : []),
      ...(destinationCoords ? [destinationCoords] : []),
      ...(driverLocation ? [driverLocation] : []),
    ];

    if (coordinates.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
          animated: true,
        });
      }, 500);
    } else if (coordinates.length === 1) {
      mapRef.current.animateToRegion({
        ...coordinates[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  const handleMapReady = () => {
    console.log('🗺️ Map is ready');
    setIsMapReady(true);
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={mapRegion}
        showsUserLocation={showUserLocation && Platform.OS !== 'web'}
        followsUserLocation={followUserLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={false}
        onMapReady={handleMapReady}
        onPress={(event) => {
          if (onMapPress) {
            onMapPress(event.nativeEvent.coordinate);
          }
        }}
        mapType="standard"
        loadingEnabled={true}
        loadingIndicatorColor="#2563EB"
        loadingBackgroundColor="#FFFFFF"
        pitchEnabled={true}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
      >
        {/* User Location Marker (for web or custom styling) */}
        {userLocation && showUserLocation && Platform.OS === 'web' && (
          <Marker 
            coordinate={userLocation} 
            identifier="user_location"
            title="Your Location"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationDot} />
            </View>
          </Marker>
        )}

        {/* Pickup Marker */}
        {pickupCoords && (
          <Marker 
            coordinate={pickupCoords} 
            identifier="pickup" 
            title="Pickup Location"
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={[styles.markerContainer, styles.pickupMarker]}>
              <Navigation size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Destination Marker */}
        {destinationCoords && (
          <Marker 
            coordinate={destinationCoords} 
            identifier="destination" 
            title="Destination"
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={[styles.markerContainer, styles.destinationMarker]}>
              <MapPin size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Driver Marker */}
        {driverLocation && (
          <Marker 
            coordinate={driverLocation} 
            identifier="driver" 
            title="Driver Location"
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driverLocation.heading || 0}
          >
            <View style={styles.driverMarker}>
              <Car size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Available Drivers Markers */}
        {availableDrivers && availableDrivers.length > 0 && availableDrivers.map((driver, index) => {
          console.log(`🗺️ [MAP] Rendering marker ${index + 1} for driver:`, {
            driver_id: driver.driver_id,
            vehicle_type: driver.vehicle_type,
            coordinates: { lat: driver.latitude, lng: driver.longitude },
            marker_key: `available_driver_${driver.driver_id}`,
            marker_identifier: `available_driver_${driver.driver_id}`
          });
          
          return (
          <Marker
            key={`available_driver_${driver.driver_id}`}
            coordinate={{
              latitude: driver.latitude,
              longitude: driver.longitude,
            }}
            identifier={`available_driver_${driver.driver_id}`}
            title={`${driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1)} Driver`}
            description={`Rating: ${driver.rating} ⭐ • ${driver.distance ? driver.distance.toFixed(1) + 'km away' : 'Nearby'}`}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driver.heading || 0}
          >
            <View style={styles.carIconContainer}>
              <Text style={[
                styles.carIcon,
                { color: getVehicleColor(driver.vehicle_type) }
              ]}>
                🚗
              </Text>
            </View>
          </Marker>
          );
        })}
        
        {/* Debug: Log total markers being rendered */}
        {availableDrivers && availableDrivers.length > 0 && console.log('🗺️ [MAP] Total driver markers rendered:', availableDrivers.length)}

        {/* Route using MapViewDirections for better accuracy */}
        {showRoute && pickupCoords && destinationCoords && isMapReady && GOOGLE_MAPS_API_KEY && (
          <MapViewDirections
            origin={pickupCoords}
            destination={destinationCoords}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={4}
            strokeColor="#2563EB"
            optimizeWaypoints={true}
            precision="high"
            timePrecision="now"
            onReady={(result) => {
              console.log('Route ready:', {
                distance: result.distance,
                duration: result.duration,
              });
              
              // Clear fallback route when real route is ready
              setRouteCoordinates([]);
              
              onRouteReady?.({
                distance: result.distance,
                duration: result.duration,
              });
            }}
            onError={(errorMessage) => {
              console.error('Route error:', errorMessage);
              // Set fallback straight line route
              setRouteCoordinates([pickupCoords, destinationCoords]);
            }}
          />
        )}

        {/* Fallback route polyline if MapViewDirections fails */}
        {showRoute && routeCoordinates.length > 1 && (!GOOGLE_MAPS_API_KEY || Platform.OS === 'web') && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2563EB"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
            geodesic={true}
          />
        )}
      </MapView>
    </View>
  );
});

// Get color for different vehicle types
const getVehicleColor = (vehicleType: string): string => {
  const colorMap: { [key: string]: string } = {
    'hatchback': '#059669',
    'hatchback_ac': '#0891B2',
    'sedan': '#2563EB',
    'sedan_ac': '#7C3AED',
    'suv': '#DC2626',
    'suv_ac': '#EA580C',
  };
  return colorMap[vehicleType] || '#6B7280';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  userLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  pickupMarker: {
    backgroundColor: '#059669',
  },
  destinationMarker: {
    backgroundColor: '#DC2626',
  },
  driverMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  availableDriverMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  carIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  carIcon: {
    fontSize: 24,
  },
});

export default EnhancedGoogleMapView;