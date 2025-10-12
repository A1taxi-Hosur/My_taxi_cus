import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

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
  showRoute?: boolean;
  style?: any;
  showUserLocation?: boolean;
  followUserLocation?: boolean;
}

export default function EnhancedGoogleMapView(props: EnhancedGoogleMapViewProps) {
  return (
    <View style={[styles.container, props.style]}>
      <Text style={styles.placeholder}>Map View</Text>
      <Text style={styles.info}>Live tracking map will display here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 8,
  },
  info: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
