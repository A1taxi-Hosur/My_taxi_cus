import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, MapPin, Navigation, Car, User, Phone, Star, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';
import { realtimeService } from '../services/realtimeService';
import { locationService } from '../services/locationService';

interface RideStatusCardProps {
  ride: any;
  onStatusChange?: (status: string) => void;
}

export default function RideStatusCard({ ride, onStatusChange }: RideStatusCardProps) {
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (ride.driver_id && ride.drivers?.user_id) {
      // Subscribe to driver location updates
      const subscription = realtimeService.subscribeToDriverLocation(
        ride.drivers.user_id,
        (location) => {
          setDriverLocation(location);
          setLastUpdate(new Date());
          
          // Calculate ETA based on current status
          if (ride.status === 'accepted' || ride.status === 'driver_arrived') {
            const etaMinutes = locationService.calculateETA(
              location,
              { latitude: ride.pickup_latitude, longitude: ride.pickup_longitude }
            );
            setEta(etaMinutes);
          } else if (ride.status === 'in_progress' && ride.destination_latitude) {
            const etaMinutes = locationService.calculateETA(
              location,
              { latitude: ride.destination_latitude, longitude: ride.destination_longitude }
            );
            setEta(etaMinutes);
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [ride.driver_id, ride.status]);

  const getStatusInfo = () => {
    switch (ride.status) {
      case 'requested':
        return {
          icon: Clock,
          title: 'Finding Driver',
          subtitle: 'Looking for the best driver nearby',
          color: '#F59E0B',
          backgroundColor: '#FEF3C7',
        };
      case 'accepted':
        return {
          icon: Car,
          title: 'Driver Assigned',
          subtitle: eta ? `Driver arriving in ${eta} min` : 'Driver is on the way',
          color: '#2563EB',
          backgroundColor: '#DBEAFE',
        };
      case 'driver_arrived':
        return {
          icon: MapPin,
          title: 'Driver Arrived',
          subtitle: 'Your driver is waiting at pickup location',
          color: '#059669',
          backgroundColor: '#D1FAE5',
        };
      case 'in_progress':
        return {
          icon: Navigation,
          title: 'Trip in Progress',
          subtitle: eta ? `Arriving in ${eta} min` : 'Enjoy your ride!',
          color: '#7C3AED',
          backgroundColor: '#EDE9FE',
        };
      case 'completed':
        return {
          icon: CheckCircle,
          title: 'Trip Completed',
          subtitle: 'Thank you for riding with us!',
          color: '#059669',
          backgroundColor: '#D1FAE5',
        };
      case 'cancelled':
        return {
          icon: AlertCircle,
          title: 'Trip Cancelled',
          subtitle: ride.cancellation_reason || 'Trip was cancelled',
          color: '#DC2626',
          backgroundColor: '#FEE2E2',
        };
      default:
        return {
          icon: Clock,
          title: 'Processing',
          subtitle: 'Please wait...',
          color: '#6B7280',
          backgroundColor: '#F3F4F6',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC']}
        style={styles.card}
      >
        <View style={styles.statusHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.backgroundColor }]}>
            <StatusIcon size={16} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.title}
            </Text>
          </View>
          <Text style={styles.rideCode}>#{ride.ride_code}</Text>
        </View>

        <Text style={styles.statusSubtitle}>{statusInfo.subtitle}</Text>

        {/* Driver Information */}
        {ride.drivers && (
          <View style={styles.driverSection}>
            <View style={styles.driverHeader}>
              <Text style={styles.driverTitle}>Driver Details</Text>
              {driverLocation && (
                <Text style={styles.lastUpdate}>
                  Updated {Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 1000)}s ago
                </Text>
              )}
            </View>
            
            <View style={styles.driverInfo}>
              <View style={styles.driverDetails}>
                <View style={styles.driverItem}>
                  <User size={16} color="#6B7280" />
                  <Text style={styles.driverText}>{ride.drivers.users.full_name}</Text>
                  <View style={styles.ratingContainer}>
                    <Star size={12} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.ratingText}>{ride.drivers.rating}</Text>
                  </View>
                </View>
                
                <View style={styles.driverItem}>
                  <Car size={16} color="#6B7280" />
                  <Text style={styles.driverText}>
                    {ride.drivers.vehicles.make} {ride.drivers.vehicles.model}
                  </Text>
                </View>
                
                <View style={styles.plateContainer}>
                  <Text style={styles.plateText}>
                    {ride.drivers.vehicles.registration_number}
                  </Text>
                </View>
              </View>
              
              {ride.drivers.users.phone && (
                <TouchableOpacity style={styles.callButton}>
                  <Phone size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Location Information */}
        <View style={styles.locationSection}>
          <View style={styles.locationItem}>
            <Navigation size={16} color="#059669" />
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationText}>{ride.pickup_address}</Text>
            </View>
          </View>
          
          {ride.destination_address && (
            <View style={styles.locationItem}>
              <MapPin size={16} color="#DC2626" />
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>Destination</Text>
                <Text style={styles.locationText}>{ride.destination_address}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Fare Information */}
        {ride.fare_amount && (
          <View style={styles.fareSection}>
            <Text style={styles.fareLabel}>Trip Fare</Text>
            <Text style={styles.fareAmount}>₹{ride.fare_amount}</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  rideCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  driverSection: {
    marginBottom: 20,
  },
  driverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  lastUpdate: {
    fontSize: 12,
    color: '#6B7280',
  },
  driverInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
  },
  driverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  driverText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 12,
    color: '#92400E',
    marginLeft: 2,
    fontWeight: '600',
  },
  plateContainer: {
    marginTop: 4,
  },
  plateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationSection: {
    marginBottom: 20,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationDetails: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
  },
  fareSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  fareLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  sharingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sharingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 4,
  },
  sharingText: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
  },
});