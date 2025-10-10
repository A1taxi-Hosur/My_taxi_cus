import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Car, MapPin, Clock, Star } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import DriverRideCard from './DriverRideCard';

export default function DriverDashboard() {
  const { user } = useAuth();
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [rideRequests, setRideRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDriverData();
      fetchRideRequests();
      
      // Subscribe to new ride requests
      const subscription = supabase
        .channel('driver_ride_requests')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
          filter: `status=eq.requested`,
        }, () => {
          fetchRideRequests();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchDriverData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          vehicles!fk_drivers_vehicle (*)
        `)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      setDriver(data);
      setIsOnline(data.status === 'online');

      // Fetch current assigned ride
      const { data: currentRideData } = await supabase
        .from('rides')
        .select(`
          *,
          users (
            full_name,
            phone
          )
        `)
        .eq('driver_id', data.id)
        .in('status', ['accepted', 'driver_arrived', 'in_progress'])
        .single();

      if (currentRideData) {
        setCurrentRide(currentRideData);
      }

    } catch (error) {
      console.error('Error fetching driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRideRequests = async () => {
    if (!driver) return;

    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          users (
            full_name,
            phone
          )
        `)
        .eq('status', 'requested')
        .eq('vehicle_type', driver.vehicles?.vehicle_type)
        .order('created_at', { ascending: true })
        .limit(5);

      if (error) throw error;
      setRideRequests(data || []);
    } catch (error) {
      console.error('Error fetching ride requests:', error);
    }
  };

  const toggleOnlineStatus = async () => {
    if (!driver) return;

    const newStatus = isOnline ? 'offline' : 'online';
    
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: newStatus })
        .eq('id', driver.id);

      if (error) throw error;
      
      setIsOnline(!isOnline);
      
      if (newStatus === 'offline') {
        setRideRequests([]);
      } else {
        fetchRideRequests();
      }
    } catch (error) {
      console.error('Error updating driver status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Driver profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#E2E8F0']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Driver Dashboard</Text>
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={toggleOnlineStatus}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={isOnline ? '#2563EB' : '#F3F4F6'}
              />
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Star size={20} color="#F59E0B" />
              <Text style={styles.statValue}>{driver.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <Car size={20} color="#2563EB" />
              <Text style={styles.statValue}>{driver.total_rides}</Text>
              <Text style={styles.statLabel}>Total Rides</Text>
            </View>
          </View>

          {currentRide && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Ride</Text>
              <DriverRideCard
                ride={currentRide}
                driverId={driver.id}
                onRideUpdate={fetchDriverData}
              />
            </View>
          )}

          {isOnline && !currentRide && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Available Rides ({rideRequests.length})
              </Text>
              {rideRequests.length > 0 ? (
                rideRequests.map((ride) => (
                  <DriverRideCard
                    key={ride.id}
                    ride={ride}
                    driverId={driver.id}
                    onRideUpdate={() => {
                      fetchDriverData();
                      fetchRideRequests();
                    }}
                  />
                ))
              ) : (
                <View style={styles.noRidesContainer}>
                  <MapPin size={48} color="#9CA3AF" />
                  <Text style={styles.noRidesText}>No ride requests available</Text>
                  <Text style={styles.noRidesSubtext}>
                    Stay online to receive ride requests
                  </Text>
                </View>
              )}
            </View>
          )}

          {!isOnline && (
            <View style={styles.offlineContainer}>
              <Clock size={48} color="#9CA3AF" />
              <Text style={styles.offlineText}>You're currently offline</Text>
              <Text style={styles.offlineSubtext}>
                Turn on your status to start receiving ride requests
              </Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginRight: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
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
  noRidesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noRidesText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  noRidesSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  offlineContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  offlineText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  offlineSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});