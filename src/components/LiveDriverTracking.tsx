import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation, MapPin, Car } from 'lucide-react-native';
import AnimatedDriverMarker from './AnimatedDriverMarker';
import AnimatedETAProgressRing from './AnimatedETAProgressRing';

const { width } = Dimensions.get('window');

interface LiveDriverTrackingProps {
  driverLocation: {
    latitude: number;
    longitude: number;
    heading?: number;
  } | null;
  pickupLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  driverInfo: {
    name: string;
    vehicle: string;
    plateNumber: string;
    phone?: string;
  };
  onDriverArrived?: () => void;
}

export default function LiveDriverTracking({
  driverLocation,
  pickupLocation,
  driverInfo,
  onDriverArrived,
}: LiveDriverTrackingProps) {
  const [distance, setDistance] = useState<number>(0);
  const [eta, setEta] = useState<number>(5);
  const [calculatedHeading, setCalculatedHeading] = useState<number>(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (driverLocation) {
      const dist = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        pickupLocation.latitude,
        pickupLocation.longitude
      );
      setDistance(dist);

      const calculatedETA = Math.max(1, Math.round((dist / 30) * 60));
      setEta(calculatedETA);

      const heading = calculateHeading(
        driverLocation.latitude,
        driverLocation.longitude,
        pickupLocation.latitude,
        pickupLocation.longitude
      );
      setCalculatedHeading(heading);

      if (dist < 0.05) {
        onDriverArrived?.();
      }
    }
  }, [driverLocation, pickupLocation]);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateHeading = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(dLon);
    const heading = Math.atan2(y, x);
    return ((heading * 180) / Math.PI + 360) % 360;
  };

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient colors={['#FFFFFF', '#F9FAFB']} style={styles.card}>
        <View style={styles.header}>
          <View style={styles.driverIconContainer}>
            <Car size={24} color="#2563EB" />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.driverName}>{driverInfo.name}</Text>
            <Text style={styles.vehicleInfo}>
              {driverInfo.vehicle} • {driverInfo.plateNumber}
            </Text>
          </View>
        </View>

        <View style={styles.etaSection}>
          <AnimatedETAProgressRing
            etaMinutes={eta}
            maxETA={15}
            size={100}
            strokeWidth={6}
          />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Navigation size={16} color="#059669" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Distance</Text>
              <Text style={styles.infoValue}>{formatDistance(distance)}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <MapPin size={16} color="#DC2626" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Pickup</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {pickupLocation.address}
              </Text>
            </View>
          </View>
        </View>

        {driverLocation && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live tracking</Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  driverIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  etaSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  infoSection: {
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
