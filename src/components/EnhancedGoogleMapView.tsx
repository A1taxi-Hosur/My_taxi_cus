import React, { useRef, useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';

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
  const mapRef = useRef<MapView>(null);
  const {
    initialRegion,
    pickupCoords,
    destinationCoords,
    driverLocation,
    availableDrivers,
    showRoute,
    style,
    showUserLocation = true,
    followUserLocation = false,
    routeCoordinates,
  } = props;

  useEffect(() => {
    if (mapRef.current && pickupCoords && destinationCoords) {
      mapRef.current.fitToCoordinates([pickupCoords, destinationCoords], {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [pickupCoords, destinationCoords]);

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, style]}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={initialRegion}
      showsUserLocation={showUserLocation}
      showsMyLocationButton={true}
      followsUserLocation={followUserLocation}
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
          rotation={driverLocation.heading}
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
          rotation={driver.heading}
        />
      ))}

      {showRoute && routeCoordinates && routeCoordinates.length > 0 && (
        <Polyline
          coordinates={routeCoordinates}
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
});
