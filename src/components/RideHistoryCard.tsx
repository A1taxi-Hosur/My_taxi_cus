import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin, Calendar, Car, User } from 'lucide-react-native';
import { Ride } from '../types/database';

interface RideHistoryCardProps {
  ride: Ride & {
    drivers?: {
      users: { full_name: string };
      vehicles: { make: string; model: string; license_plate: string };
    };
  };
}

export default function RideHistoryCard({ ride }: RideHistoryCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#059669';
      case 'cancelled':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusDot,
            { backgroundColor: getStatusColor(ride.status) }
          ]} />
          <Text style={[
            styles.statusText,
            { color: getStatusColor(ride.status) }
          ]}>
            {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
          </Text>
        </View>
        <Text style={styles.bookingType}>
          {ride.booking_type.charAt(0).toUpperCase() + ride.booking_type.slice(1)}
        </Text>
      </View>

      <View style={styles.dateContainer}>
        <Calendar size={14} color="#6B7280" />
        <Text style={styles.dateText}>{formatDate(ride.created_at)}</Text>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationItem}>
          <MapPin size={16} color="#059669" />
          <Text style={styles.locationText} numberOfLines={2}>
            {ride.pickup_location}
          </Text>
        </View>
        {ride.destination_location && (
          <View style={styles.locationItem}>
            <MapPin size={16} color="#DC2626" />
            <Text style={styles.locationText} numberOfLines={2}>
              {ride.destination_location}
            </Text>
          </View>
        )}
      </View>

      {ride.drivers && (
        <View style={styles.driverContainer}>
          <User size={14} color="#6B7280" />
          <Text style={styles.driverText}>{ride.drivers.users.full_name}</Text>
          <Car size={14} color="#6B7280" />
          <Text style={styles.vehicleText}>
            {ride.drivers.vehicles.make} {ride.drivers.vehicles.model}
          </Text>
        </View>
      )}

      {ride.fare_amount && (
        <View style={styles.fareContainer}>
          <Text style={styles.fareAmount}>₹{ride.fare_amount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingType: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  driverContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    marginRight: 12,
  },
  vehicleText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    flex: 1,
  },
  fareContainer: {
    alignItems: 'flex-end',
  },
  fareAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
});