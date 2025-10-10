import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin, Navigation, Car } from 'lucide-react-native';
import Geolocation from 'react-native-geolocation-service';
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY, HOSUR_COORDINATES } from '../config/maps';

interface GoogleMapViewProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  pickupCoords?: { latitude: number; longitude: number };
  destinationCoords?: { latitude: number; longitude: number };
  driverLocation?: { latitude: number; longitude: number };
  showRoute?: boolean;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
  style?: any;
}

export default function GoogleMapView({
  initialRegion,
  pickupCoords,
  destinationCoords,
  driverLocation,
  showRoute = false,
  onMapPress,
  style,
}: GoogleMapViewProps) {
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [currentUserLocation, setCurrentUserLocation] = useState<any>(null);
  const [mapRegion, setMapRegion] = useState(initialRegion || HOSUR_COORDINATES);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);

  useEffect(() => {
    requestLocationPermissionAndGetLocation();
  }, []);

  useEffect(() => {
    if (showRoute && pickupCoords && destinationCoords) {
      calculateRouteWithDirections();
    }
  }, [pickupCoords, destinationCoords, showRoute]);

  useEffect(() => {
    // Fit map to show all markers when they change
    if (mapRef.current) {
      setTimeout(() => {
        fitToMarkers();
      }, 500);
    }
  }, [pickupCoords, destinationCoords, driverLocation, currentUserLocation]);

  const requestLocationPermissionAndGetLocation = async () => {
    try {
      console.log('🗺️ GoogleMapView: Requesting location permission...');
      
      let hasPermission = false;

      if (Platform.OS === 'android') {
        const { PermissionsAndroid } = require('react-native');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to show you on the map.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else if (Platform.OS === 'ios') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        hasPermission = status === 'granted';
      } else {
        // Web platform
        hasPermission = true;
      }

      console.log('🗺️ GoogleMapView: Permission granted:', hasPermission);
      setLocationPermissionGranted(hasPermission);

      if (hasPermission) {
        getCurrentLocationForMap();
      }
    } catch (error) {
      console.error('🗺️ GoogleMapView: Permission error:', error);
    }
  };

  const getCurrentLocationForMap = () => {
    console.log('🗺️ GoogleMapView: Getting current location for map...');

    if (Platform.OS === 'web') {
      // Use browser geolocation for web
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            console.log('🗺️ GoogleMapView: Web location obtained:', userLocation);
            setCurrentUserLocation(userLocation);
            animateToLocation(userLocation);
          },
          (error) => {
            console.error('🗺️ GoogleMapView: Web geolocation error:', error);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      }
      return;
    }

    // Use react-native-geolocation-service for mobile
    Geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        console.log('🗺️ GoogleMapView: Native location obtained:', userLocation);
        console.log('🗺️ GoogleMapView: Accuracy:', position.coords.accuracy, 'meters');
        
        setCurrentUserLocation(userLocation);
        animateToLocation(userLocation);
      },
      (error) => {
        console.error('🗺️ GoogleMapView: Geolocation error:', error);
        Alert.alert(
          'Location Error',
          'Unable to get your current location for the map. Using default location.',
          [{ text: 'OK' }]
        );
      },
      {
        accuracy: {
          android: 'high',
          ios: 'bestForNavigation',
        },
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        distanceFilter: 0,
        forceRequestLocation: true,
        forceLocationManager: false,
        showLocationDialog: true,
      }
    );
  };

  const animateToLocation = (location: { latitude: number; longitude: number }) => {
    const newRegion = {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    
    console.log('🗺️ GoogleMapView: Animating to location:', newRegion);
    setMapRegion(newRegion);
    
    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  };

  const calculateRouteWithDirections = async () => {
    if (!pickupCoords || !destinationCoords) return;

    try {
      const origin = `${pickupCoords.latitude},${pickupCoords.longitude}`;
      const destination = `${destinationCoords.latitude},${destinationCoords.longitude}`;
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`
      );
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const points = data.routes[0].overview_polyline.points;
        const decodedPoints = decodePolyline(points);
        setRouteCoordinates(decodedPoints);
      } else {
        // Fallback to straight line
        setRouteCoordinates([pickupCoords, destinationCoords]);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      // Fallback to straight line
      setRouteCoordinates([pickupCoords, destinationCoords]);
    }
  };

  // Decode Google polyline
  const decodePolyline = (encoded: string) => {
    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      poly.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    return poly;
  };

  const fitToMarkers = () => {
    if (!mapRef.current) return;

    const coordinates = [
      ...(currentUserLocation ? [currentUserLocation] : []),
      ...(pickupCoords ? [pickupCoords] : []),
      ...(destinationCoords ? [destinationCoords] : []),
      ...(driverLocation ? [driverLocation] : []),
    ];

    if (coordinates.length > 0) {
      console.log('🗺️ GoogleMapView: Fitting to markers:', coordinates.length);
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={mapRegion}
        showsUserLocation={locationPermissionGranted}
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        onPress={(event) => {
          if (onMapPress) {
            onMapPress(event.nativeEvent.coordinate);
          }
        }}
        mapType="standard"
        loadingEnabled={true}
        loadingIndicatorColor="#2563EB"
        loadingBackgroundColor="#FFFFFF"
      >
        {/* Current User Location Marker (custom) */}
        {currentUserLocation && (
          <Marker 
            coordinate={currentUserLocation} 
            identifier="current_user"
            title="Your Location"
          >
            <View style={styles.currentLocationMarker}>
              <View style={styles.currentLocationDot} />
            </View>
          </Marker>
        )}

        {/* Pickup Marker */}
        {pickupCoords && (
          <Marker coordinate={pickupCoords} identifier="pickup" title="Pickup Location">
            <View style={[styles.markerContainer, styles.pickupMarker]}>
              <Navigation size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Destination Marker */}
        {destinationCoords && (
          <Marker coordinate={destinationCoords} identifier="destination" title="Destination">
            <View style={[styles.markerContainer, styles.destinationMarker]}>
              <MapPin size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Driver Marker */}
        {driverLocation && (
          <Marker coordinate={driverLocation} identifier="driver" title="Driver Location">
            <View style={styles.driverMarker}>
              <Car size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {showRoute && routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2563EB"
            strokeWidth={4}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  currentLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  markerContainer: {
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
  pickupMarker: {
    backgroundColor: '#059669',
  },
  destinationMarker: {
    backgroundColor: '#DC2626',
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
});