import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';

interface EnhancedGoogleMapViewProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  pickupCoords?: {
    latitude: number;
    longitude: number;
  };
  destinationCoords?: {
    latitude: number;
    longitude: number;
  };
  driverLocation?: {
    latitude: number;
    longitude: number;
    heading?: number;
  };
  availableDrivers?: Array<{
    driver_id: string;
    latitude: number;
    longitude: number;
    heading?: number;
    vehicle_type?: string;
  }>;
  showRoute?: boolean;
  style?: any;
  showUserLocation?: boolean;
  followUserLocation?: boolean;
  routeCoordinates?: Array<{ latitude: number; longitude: number }>;
}

export default function EnhancedGoogleMapView(props: EnhancedGoogleMapViewProps) {
  const {
    initialRegion,
    pickupCoords,
    destinationCoords,
    driverLocation,
    availableDrivers,
    style,
  } = props;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webContainer, style]}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.title}>🗺️ Map View</Text>
          <Text style={styles.subtitle}>Interactive map (native only)</Text>

          {initialRegion && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                📍 Center: {initialRegion.latitude.toFixed(4)}, {initialRegion.longitude.toFixed(4)}
              </Text>
            </View>
          )}

          {pickupCoords && (
            <View style={styles.markerInfo}>
              <Text style={styles.markerText}>
                🟢 Pickup: {pickupCoords.latitude.toFixed(4)}, {pickupCoords.longitude.toFixed(4)}
              </Text>
            </View>
          )}

          {destinationCoords && (
            <View style={styles.markerInfo}>
              <Text style={styles.markerText}>
                🔴 Destination: {destinationCoords.latitude.toFixed(4)}, {destinationCoords.longitude.toFixed(4)}
              </Text>
            </View>
          )}

          {driverLocation && (
            <View style={styles.markerInfo}>
              <Text style={styles.markerText}>
                🚗 Driver: {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
              </Text>
            </View>
          )}

          {availableDrivers && availableDrivers.length > 0 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                🚕 {availableDrivers.length} drivers nearby
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  const MapView = require('react-native-maps').default;
  const { Marker, PROVIDER_GOOGLE, Polyline } = require('react-native-maps');
  const mapRef = useRef<any>(null);

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, style]}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={initialRegion}
      showsUserLocation={props.showUserLocation}
      showsMyLocationButton={true}
      followsUserLocation={props.followUserLocation}
      showsCompass={true}
      showsScale={true}
    >
      {pickupCoords && (
        <Marker
          coordinate={pickupCoords}
          title="Pickup Location"
          pinColor="green"
        />
      )}

      {destinationCoords && (
        <Marker
          coordinate={destinationCoords}
          title="Destination"
          pinColor="red"
        />
      )}

      {driverLocation && (
        <Marker
          coordinate={driverLocation}
          title="Driver"
          pinColor="blue"
        />
      )}

      {availableDrivers && availableDrivers.map((driver) => (
        <Marker
          key={driver.driver_id}
          coordinate={{
            latitude: driver.latitude,
            longitude: driver.longitude,
          }}
          title={`Driver - ${driver.vehicle_type || 'Unknown'}`}
          pinColor="blue"
        />
      ))}

      {props.showRoute && props.routeCoordinates && props.routeCoordinates.length > 0 && (
        <Polyline
          coordinates={props.routeCoordinates}
          strokeColor="#4F46E5"
          strokeWidth={4}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  webContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
  },
  markerInfo: {
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
    minWidth: 250,
  },
  markerText: {
    fontSize: 12,
    color: '#1F2937',
    textAlign: 'center',
  },
});
