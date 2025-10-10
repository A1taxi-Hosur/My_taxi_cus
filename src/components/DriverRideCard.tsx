import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Navigation, Phone, CircleCheck as CheckCircle, Play, Square } from 'lucide-react-native';
import { rideService } from '../services/rideService';

interface DriverRideCardProps {
  ride: any;
  driverId: string;
  onRideUpdate?: () => void;
}

export default function DriverRideCard({ ride, driverId, onRideUpdate }: DriverRideCardProps) {
  const [loading, setLoading] = useState(false);

  const handleAcceptRide = async () => {
    setLoading(true);
    const { error } = await rideService.acceptRide(ride.id, driverId);
    
    if (error) {
      Alert.alert('Error', 'Failed to accept ride. It may have been taken by another driver.');
    } else {
      onRideUpdate?.();
    }
    setLoading(false);
  };

  const handleDriverArrived = async () => {
    setLoading(true);
    const { error } = await rideService.driverArrived(ride.id, driverId);
    
    if (error) {
      Alert.alert('Error', 'Failed to update arrival status.');
    } else {
      onRideUpdate?.();
    }
    setLoading(false);
  };

  const handleStartTrip = async () => {
    setLoading(true);
    const { error } = await rideService.startTrip(ride.id, driverId);
    
    if (error) {
      Alert.alert('Error', 'Failed to start trip.');
    } else {
      onRideUpdate?.();
    }
    setLoading(false);
  };

  const handleCompleteTrip = async () => {
    Alert.alert(
      'Complete Trip',
      'Are you sure you want to complete this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setLoading(true);
            const { error } = await rideService.completeTrip(ride.id, driverId);
            
            if (error) {
              Alert.alert('Error', 'Failed to complete trip.');
            } else {
              onRideUpdate?.();
            }
            setLoading(false);
          },
        },
      ]
    );
  };

  const getActionButton = () => {
    switch (ride.status) {
      case 'requested':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAcceptRide}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Accept Ride</Text>
              </>
            )}
          </TouchableOpacity>
        );

      case 'accepted':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.arrivedButton]}
            onPress={handleDriverArrived}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Navigation size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>I've Arrived</Text>
              </>
            )}
          </TouchableOpacity>
        );

      case 'driver_arrived':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Play size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Start Trip</Text>
              </>
            )}
          </TouchableOpacity>
        );

      case 'in_progress':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={handleCompleteTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Square size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Complete Trip</Text>
              </>
            )}
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (ride.status) {
      case 'requested':
        return '#F59E0B';
      case 'accepted':
        return '#2563EB';
      case 'driver_arrived':
        return '#059669';
      case 'in_progress':
        return '#7C3AED';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = () => {
    switch (ride.status) {
      case 'requested':
        return 'New Request';
      case 'accepted':
        return 'Heading to Pickup';
      case 'driver_arrived':
        return 'Arrived at Pickup';
      case 'in_progress':
        return 'Trip in Progress';
      default:
        return ride.status;
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC']}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
          <Text style={styles.rideCode}>#{ride.ride_code}</Text>
        </View>

        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>
            {ride.users?.full_name || 'Customer'}
          </Text>
          {ride.users?.phone && (
            <TouchableOpacity style={styles.phoneButton}>
              <Phone size={16} color="#2563EB" />
              <Text style={styles.phoneText}>{ride.users.phone_number}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationItem}>
            <Navigation size={16} color="#059669" />
            <Text style={styles.locationText}>{ride.pickup_address}</Text>
          </View>
          {ride.destination_address && (
            <View style={styles.locationItem}>
              <MapPin size={16} color="#DC2626" />
              <Text style={styles.locationText}>{ride.destination_address}</Text>
            </View>
          )}
        </View>

        <View style={styles.fareContainer}>
          <Text style={styles.fareLabel}>Fare Amount</Text>
          <Text style={styles.fareAmount}>₹{ride.fare_amount}</Text>
        </View>

        {getActionButton()}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rideCode: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  customerInfo: {
    marginBottom: 16,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 14,
    color: '#2563EB',
    marginLeft: 8,
    fontWeight: '500',
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  acceptButton: {
    backgroundColor: '#059669',
  },
  arrivedButton: {
    backgroundColor: '#2563EB',
  },
  startButton: {
    backgroundColor: '#7C3AED',
  },
  completeButton: {
    backgroundColor: '#DC2626',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});