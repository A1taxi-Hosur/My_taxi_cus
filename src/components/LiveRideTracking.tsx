import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Navigation, Phone, User, Car, Clock } from 'lucide-react-native';
import { apiService } from '../services/apiService';
import { realtimeService } from '../services/realtimeService';
import RealTimeMap from './RealTimeMap';

interface LiveRideTrackingProps {
  rideId: string;
  onRideComplete?: () => void;
}

export default function LiveRideTracking({ rideId, onRideComplete }: LiveRideTrackingProps) {
  const [ride, setRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    fetchRideDetails();
    
    // Subscribe to ride updates
    const rideSubscription = realtimeService.subscribeToRide(rideId, (updatedRide) => {
      setRide(updatedRide);
      if (updatedRide.status === 'completed' || updatedRide.status === 'cancelled') {
        onRideComplete?.();
      }
    });

    return () => {
      rideSubscription.unsubscribe();
    };
  }, [rideId]);

  const fetchRideDetails = async () => {
    const { data, error } = await apiService.getRideDetails(rideId);
    if (data) {
      setRide(data);
      
      // Subscribe to driver location if driver is assigned
      if (data.driver_id && data.drivers?.user_id) {
        realtimeService.subscribeToDriverLocation(data.drivers.user_id, (location) => {
          setDriverLocation(location);
        });
      }
    }
    setLoading(false);
  };

  const handleCancelRide = async () => {
    if (ride.status === 'in_progress') {
      Alert.alert('Cannot Cancel', 'Trip is already in progress and cannot be cancelled.');
      return;
    }

    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            const { error } = await apiService.updateRideStatus(rideId, 'cancelled', ride.driver_id, {
              cancelled_by: ride.customer_id,
              cancellation_reason: 'Cancelled by customer'
            });
            
            if (error) {
              Alert.alert('Error', 'Failed to cancel the ride. Please try again.');
            }
            setCancelling(false);
          },
        },
      ]
    );
  };

  const getStatusInfo = () => {
    switch (ride?.status) {
      case 'requested':
        return {
          text: 'Finding Driver...',
          color: '#F59E0B',
          backgroundColor: '#FEF3C7',
          description: 'We\'re looking for the best driver for your trip.',
        };
      case 'accepted':
        return {
          text: 'Driver Assigned',
          color: '#2563EB',
          backgroundColor: '#DBEAFE',
          description: 'Your driver is on the way to pick you up.',
        };
      case 'driver_arrived':
        return {
          text: 'Driver Arrived',
          color: '#059669',
          backgroundColor: '#D1FAE5',
          description: 'Your driver has arrived at the pickup location.',
        };
      case 'in_progress':
        return {
          text: 'Trip in Progress',
          color: '#7C3AED',
          backgroundColor: '#EDE9FE',
          description: 'Enjoy your ride! You\'ll be at your destination soon.',
        };
      default:
        return {
          text: 'Unknown Status',
          color: '#6B7280',
          backgroundColor: '#F3F4F6',
          description: '',
        };
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading ride details...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Ride not found</Text>
      </View>
    );
  }

  const statusInfo = getStatusInfo();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC']}
        style={styles.card}
      >
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>
          <Text style={styles.rideCode}>#{ride.ride_code}</Text>
        </View>

        <Text style={styles.statusDescription}>{statusInfo.description}</Text>

        {/* Real-time Map */}
        {showMap && ride && (
          <View style={styles.mapContainer}>
            <RealTimeMap
              rideId={rideId}
              pickupCoords={{
                latitude: ride.pickup_latitude,
                longitude: ride.pickup_longitude,
              }}
              destinationCoords={ride.destination_latitude && ride.destination_longitude ? {
                latitude: ride.destination_latitude,
                longitude: ride.destination_longitude,
              } : undefined}
              driverLocation={driverLocation}
              showDriverLocation={!!ride.driver_id}
              onDriverLocationUpdate={setDriverLocation}
            />
          </View>
        )}

        <View style={styles.locationContainer}>
          <View style={styles.locationItem}>
            <Navigation size={18} color="#059669" />
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationText}>{ride.pickup_address}</Text>
            </View>
          </View>
          
          {ride.destination_address && (
            <View style={styles.locationItem}>
              <MapPin size={18} color="#DC2626" />
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>Destination</Text>
                <Text style={styles.locationText}>{ride.destination_address}</Text>
              </View>
            </View>
          )}
        </View>

        {ride.drivers && (
          <View style={styles.driverContainer}>
            <Text style={styles.sectionTitle}>Driver Details</Text>
            <View style={styles.driverInfo}>
              <View style={styles.driverDetails}>
                <View style={styles.driverItem}>
                  <User size={16} color="#6B7280" />
                  <Text style={styles.driverText}>{ride.drivers.users.full_name}</Text>
                </View>
                <View style={styles.driverItem}>
                  <Car size={16} color="#6B7280" />
                  <Text style={styles.driverText}>
                    {ride.drivers.vehicles.make} {ride.drivers.vehicles.model}
                  </Text>
                </View>
                <View style={styles.plateContainer}>
                  <Text style={styles.plateText}>{ride.drivers.vehicles.registration_number}</Text>
                </View>
              </View>
              
              {ride.drivers.users.phone_number && (
                <TouchableOpacity style={styles.callButton}>
                  <Phone size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.tripDetails}>
          <View style={styles.tripDetailItem}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.tripDetailText}>
              Booked at {formatTime(ride.created_at)}
            </Text>
          </View>
          
          <View style={styles.tripDetailItem}>
            <Text style={styles.fareLabel}>Fare: </Text>
            <Text style={styles.fareAmount}>₹{ride.fare_amount}</Text>
          </View>
        </View>

        {(ride.status === 'requested' || ride.status === 'accepted') && (
          <TouchableOpacity
            style={[styles.cancelButton, cancelling && styles.disabledButton]}
            onPress={handleCancelRide}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel Ride</Text>
            )}
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#DC2626',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  rideCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  mapContainer: {
    height: 250,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  locationContainer: {
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
  driverContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
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
    marginBottom: 6,
  },
  driverText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
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
  tripDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tripDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripDetailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  fareLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  disabledButton: {
    opacity: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
});