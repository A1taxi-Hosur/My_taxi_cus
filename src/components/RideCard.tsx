import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, User, Car, Phone, Navigation } from 'lucide-react-native';
import { rideService } from '../services/rideService';

interface RideCardProps {
  ride: any & {
    drivers?: {
      users: { full_name: string; phone: string };
      vehicles: { make: string; model: string; license_plate: string };
    };
  };
}

export default function RideCard({ ride }: RideCardProps) {
  const [rideStatus, setRideStatus] = useState(ride.status);

  useEffect(() => {
    // Subscribe to ride status changes
    const subscription = rideService.subscribeToRideUpdates(ride.id, (updatedRide) => {
      setRideStatus(updatedRide.status);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [ride.id]);

  const getStatusInfo = () => {
    switch (rideStatus) {
      case 'requested':
        return {
          text: 'Looking for Driver',
          color: '#F59E0B',
          backgroundColor: '#FEF3C7',
        };
      case 'accepted':
        return {
          text: 'Driver Assigned',
          color: '#059669',
          backgroundColor: '#D1FAE5',
        };
      case 'driver_arrived':
        return {
          text: 'Driver Arrived',
          color: '#2563EB',
          backgroundColor: '#DBEAFE',
        };
      case 'in_progress':
        return {
          text: 'Trip in Progress',
          color: '#7C3AED',
          backgroundColor: '#EDE9FE',
        };
      case 'completed':
        return {
          text: 'Trip Completed',
          color: '#059669',
          backgroundColor: '#D1FAE5',
        };
      case 'cancelled':
        return {
          text: 'Trip Cancelled',
          color: '#DC2626',
          backgroundColor: '#FEE2E2',
        };
      default:
        return {
          text: 'Unknown Status',
          color: '#6B7280',
          backgroundColor: '#F3F4F6',
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleCancelRide = () => {
    if (rideStatus === 'requested' || rideStatus === 'accepted' || rideStatus === 'driver_arrived') {
      Alert.alert(
        'Cancel Ride',
        'Are you sure you want to cancel this ride?',
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Yes, Cancel', 
            onPress: cancelRide,
            style: 'destructive' 
          },
        ]
      );
    }
  };

  const cancelRide = async () => {
    try {
      const { error } = await rideService.cancelRide(ride.id, ride.customer_id, 'Cancelled by customer');

      if (error) throw error;
    } catch (error) {
      console.error('Error cancelling ride:', error);
      Alert.alert('Error', 'Failed to cancel the ride. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC']}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>
          <Text style={styles.bookingType}>
            {ride.booking_type.charAt(0).toUpperCase() + ride.booking_type.slice(1)} Ride
          </Text>
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationItem}>
            <Navigation size={16} color="#059669" />
            <Text style={styles.locationText}>{ride.pickup_location}</Text>
          </View>
          {ride.destination_location && (
            <View style={styles.locationItem}>
              <MapPin size={16} color="#DC2626" />
              <Text style={styles.locationText}>{ride.destination_location}</Text>
            </View>
          )}
        </View>

        {ride.drivers && (
          <View style={styles.driverContainer}>
            <Text style={styles.driverTitle}>Driver Information</Text>
            <View style={styles.driverInfo}>
              <View style={styles.driverDetails}>
                <View style={styles.driverItem}>
                  <User size={16} color="#6B7280" />
                  <Text style={styles.driverText}>{ride.drivers.users.full_name}</Text>
                </View>
                <View style={styles.driverItem}>
                  <Car size={16} color="#6B7280" />
                  <Text style={styles.driverText}>
                    {ride.drivers.vehicles?.make} {ride.drivers.vehicles?.model}
                  </Text>
                </View>
                <View style={styles.driverItem}>
                  <Text style={styles.plateText}>{ride.drivers.vehicles?.registration_number}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.callButton}>
                <Phone size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {ride.fare_amount && (
          <View style={styles.fareContainer}>
            <Text style={styles.fareLabel}>Fare Amount</Text>
            <Text style={styles.fareAmount}>₹{ride.fare_amount}</Text>
          </View>
        )}

        {(rideStatus === 'requested' || rideStatus === 'accepted' || rideStatus === 'driver_arrived') && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelRide}
          >
            <Text style={styles.cancelButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
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
    fontSize: 14,
    fontWeight: '600',
  },
  bookingType: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  driverContainer: {
    marginBottom: 16,
  },
  driverTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
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
    marginBottom: 4,
  },
  driverText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  plateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
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
  cancelButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
});