import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Navigation, Phone, User, Car, Star, Clock, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { rideService } from '../../src/services/rideService';
import { useRideTracking } from '../../src/hooks/useRideTracking';
import EnhancedGoogleMapView from '../../src/components/EnhancedGoogleMapView';
import { realtimeService } from '../../src/services/realtimeService';
import { useRideNotifications } from '../../src/hooks/useRideNotifications';
import { useRouter } from 'expo-router';
import { CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';
import { supabase } from '../../src/utils/supabase';
import { notificationService } from '../../src/services/notificationService';

export default function RidesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { notifications, markAsRead } = useRideNotifications();
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eta, setEta] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedRideForCancel, setSelectedRideForCancel] = useState<any>(null);

  const handleCancelRide = (ride: any) => {
    console.log('🚫 [DEBUG] handleCancelRide called for ride:', ride.id);
    
    if (cancelling) {
      console.log('🚫 [DEBUG] Already cancelling, ignoring click');
      return;
    }
    
    setSelectedRideForCancel(ride);
    setShowCancelModal(true);
  };

  const performCancellation = async () => {
    if (!selectedRideForCancel || !user) {
      console.error('🚫 [ERROR] Missing ride or user data');
      return;
    }

    console.log('🚫 [RIDES] performCancellation called for:', {
      rideId: selectedRideForCancel.id,
      userId: user.id,
      currentStatus: selectedRideForCancel.status,
      isScheduledBooking: selectedRideForCancel.isScheduledBooking
    });

    setCancelling(true);
    setShowCancelModal(false);

    try {
      if (selectedRideForCancel.isScheduledBooking) {
        // Handle scheduled booking cancellation via edge function
        console.log('🚫 [RIDES] Cancelling scheduled booking:', selectedRideForCancel.id);

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/cancel-booking`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            bookingId: selectedRideForCancel.id,
            userId: user.id,
            cancellationReason: 'Cancelled by customer'
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          console.error('🚫 [RIDES] Scheduled booking cancellation failed:', result.error);
          throw new Error(result.error || 'Failed to cancel booking. Please try again.');
        }

        const result = await response.json();

        if (!result.success) {
          console.error('🚫 [RIDES] Scheduled booking cancellation failed:', result.error);
          throw new Error(result.error || 'Failed to cancel booking. Please try again.');
        }

        console.log('🚫 [RIDES] ✅ Scheduled booking cancelled successfully');

        // Send cancellation notification to customer for scheduled booking
        try {
          await notificationService.sendRideCancelled(user.id, {
            ...selectedRideForCancel,
            cancellation_reason: 'Cancelled by customer'
          });
          console.log('✅ [RIDES] Cancellation notification sent for scheduled booking');
        } catch (notificationError) {
          console.warn('⚠️ [RIDES] Cancellation notification failed (non-blocking):', notificationError);
        }
      } else {
        // Handle regular ride cancellation
        console.log('🚫 [RIDES] Cancelling regular ride:', selectedRideForCancel.id);

        const { data, error } = await rideService.cancelRide(selectedRideForCancel.id, user.id);

        if (error) {
          console.error('🚫 [RIDES] Regular ride cancellation failed:', error);
          throw new Error('Failed to cancel ride. Please try again.');
        }

        console.log('🚫 [RIDES] ✅ Regular ride cancelled successfully');
      }

      console.log('🚫 [RIDES] ✅ Cancellation completed successfully');
      
      // Remove cancelled ride from active rides and refresh
      setActiveRides(prev => prev.filter(r => r.id !== selectedRideForCancel.id));
      setTimeout(() => {
        fetchActiveRides();
      }, 500);
      
    } catch (error) {
      console.error('🚫 [RIDES] ❌ Exception during cancellation:', error);
      
      // Show error to user
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      Alert.alert('Cancellation Failed', errorMessage);
      
    } finally {
      setCancelling(false);
      setSelectedRideForCancel(null);
      console.log('🚫 [RIDES] performCancellation completed');
    }
  };

  useEffect(() => {
    if (user) {
      fetchActiveRides();
    }
  }, [user]);

  useEffect(() => {
    // Subscribe to driver location updates and ride/booking status updates for all active rides
    const subscriptions: any[] = [];

    activeRides.forEach(ride => {
      // Subscribe to ride/booking status updates
      if (ride.isScheduledBooking) {
        console.log('📡 [RIDES] Subscribing to booking updates:', ride.id);
        const statusSub = realtimeService.subscribeToBooking(ride.id, (updatedBooking) => {
          console.log('🔔 [RIDES] Booking update received:', updatedBooking);

          // If booking is cancelled or completed, remove from active rides
          if (updatedBooking.status === 'cancelled' || updatedBooking.status === 'completed') {
            console.log('🔔 [RIDES] Removing ride from active list, status:', updatedBooking.status);
            setActiveRides(prev => prev.filter(r => r.id !== updatedBooking.id));
            return;
          }

          // Update the ride in the activeRides array
          setActiveRides(prev => prev.map(r =>
            r.id === updatedBooking.id
              ? {
                  ...r,
                  status: updatedBooking.status === 'assigned' ? 'accepted' : updatedBooking.status,
                  pickup_otp: updatedBooking.pickup_otp,
                  drop_otp: updatedBooking.drop_otp,
                  driver_id: updatedBooking.assigned_driver_id,
                }
              : r
          ));
          // Refresh to get full driver details if driver was just assigned
          if (updatedBooking.status === 'assigned' && updatedBooking.assigned_driver_id) {
            setTimeout(() => fetchActiveRides(), 1000);
          }
        });
        subscriptions.push(statusSub);
      } else if (ride.id) {
        console.log('📡 [RIDES] Subscribing to ride updates:', ride.id);
        const statusSub = realtimeService.subscribeToRide(ride.id, (updatedRide) => {
          console.log('🔔 [RIDES] Ride update received:', updatedRide);

          // If ride is cancelled or completed, remove from active rides
          if (updatedRide.status === 'cancelled' || updatedRide.status === 'completed') {
            console.log('🔔 [RIDES] Removing ride from active list, status:', updatedRide.status);
            setActiveRides(prev => prev.filter(r => r.id !== updatedRide.id));
            return;
          }

          // Update the ride in the activeRides array
          setActiveRides(prev => prev.map(r =>
            r.id === updatedRide.id
              ? {
                  ...r,
                  status: updatedRide.status,
                  pickup_otp: updatedRide.pickup_otp,
                  drop_otp: updatedRide.drop_otp,
                  driver_id: updatedRide.driver_id,
                }
              : r
          ));
        });
        subscriptions.push(statusSub);
      }

      // Subscribe to driver location updates if driver assigned
      if (ride.driver_id && (ride.drivers?.user_id || ride.assigned_driver?.user_id)) {
        const driverUserId = ride.drivers?.user_id || ride.assigned_driver?.user_id;
        console.log('📍 [RIDES] Subscribing to driver location:', driverUserId);
        const locationSub = realtimeService.subscribeToDriverLocation(
          driverUserId,
          (location) => {
            setDriverLocation(location);
            calculateETA(location, ride);
          }
        );
        subscriptions.push(locationSub);
      }
    });

    return () => {
      console.log('🧹 [RIDES] Cleaning up subscriptions');
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [activeRides]);

  // Separate effect for handling notifications to avoid infinite loops
  useEffect(() => {
    // Don't auto-mark notifications as read - let user see them
  }, [notifications.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchActiveRides();
    setRefreshing(false);
  };

  const fetchActiveRides = async () => {
    if (!user) return;

    console.log('🔍 [RIDES] Starting comprehensive active rides fetch for user:', user.id);

    try {
      const allActiveRides: any[] = [];
      
      console.log('🔍 [RIDES] Step 1: Fetching active regular rides via edge function...');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/ride-api/active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      let regularRides = [];
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          regularRides = result.data;
          console.log('🔍 [RIDES] ✅ Found', regularRides.length, 'active regular rides');
          allActiveRides.push(...regularRides);
        }
      } else {
        console.error('🔍 [RIDES] Error fetching regular rides:', await response.text());
      }
      
      console.log('🔍 [RIDES] Step 2: Fetching active scheduled bookings via edge function...');

      let scheduledBookings = [];
      const bookingsResponse = await fetch(`${supabaseUrl}/functions/v1/get-active-bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (bookingsResponse.ok) {
        const bookingsResult = await bookingsResponse.json();
        scheduledBookings = bookingsResult.data || [];

        if (scheduledBookings && scheduledBookings.length > 0) {
          console.log('🔍 [RIDES] ✅ Found', scheduledBookings.length, 'active scheduled bookings');

          // Convert all scheduled bookings to ride format for UI compatibility
          const convertedBookings = scheduledBookings.map((booking: any) => ({
            id: booking.id,
            ride_code: `${booking.booking_type.toUpperCase().substring(0, 3)}-${booking.id.substring(0, 6).toUpperCase()}`,
            customer_id: booking.customer_id,
            driver_id: booking.assigned_driver_id,
            pickup_address: booking.pickup_address,
            pickup_latitude: booking.pickup_latitude,
            pickup_longitude: booking.pickup_longitude,
            destination_address: booking.destination_address,
            destination_latitude: booking.destination_latitude,
            destination_longitude: booking.destination_longitude,
            status: booking.status === 'assigned' ? 'accepted' : booking.status,
            fare_amount: booking.estimated_fare,
            vehicle_type: booking.vehicle_type,
            booking_type: booking.booking_type,
            pickup_otp: booking.pickup_otp,
            drop_otp: booking.drop_otp,
            created_at: booking.created_at,
            updated_at: booking.updated_at,
            drivers: booking.assigned_driver,
            assigned_driver: booking.assigned_driver,
            scheduled_time: booking.scheduled_time,
            rental_hours: booking.rental_hours,
            special_instructions: booking.special_instructions,
            isScheduledBooking: true,
          }));

          allActiveRides.push(...convertedBookings);
        }
      } else {
        console.error('🔍 [RIDES] Error fetching scheduled bookings:', await bookingsResponse.text());
      }
      
      // Sort all rides by creation date (newest first)
      allActiveRides.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log('🔍 [RIDES] ✅ Total active rides found:', {
        total: allActiveRides.length,
        regular_rides: regularRides?.length || 0,
        scheduled_bookings: scheduledBookings?.length || 0,
        rides_summary: allActiveRides.map(r => ({
          id: r.id,
          type: r.isScheduledBooking ? 'scheduled' : 'regular',
          booking_type: r.booking_type,
          status: r.status
        }))
      });
      
      setActiveRides(allActiveRides);
      
      if (allActiveRides.length === 0) {
        console.log('🔍 [RIDES] ❌ No active rides or scheduled bookings found');
      }

    } catch (error) {
      console.error('🔍 [RIDES] ❌ Exception in fetchActiveRides:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateETA = (driverLoc: any, ride: any) => {
    if (!ride || !driverLoc) return;

    let etaMinutes: number;

    if (ride.status === 'accepted' || ride.status === 'driver_arrived') {
      // ETA to pickup location
      const distance = calculateDistance(
        driverLoc.latitude,
        driverLoc.longitude,
        ride.pickup_latitude,
        ride.pickup_longitude
      );
      etaMinutes = Math.round((distance / 25) * 60); // 25 km/h in city
    } else if (ride.status === 'in_progress' && ride.destination_latitude) {
      // ETA to destination
      const distance = calculateDistance(
        driverLoc.latitude,
        driverLoc.longitude,
        ride.destination_latitude,
        ride.destination_longitude
      );
      etaMinutes = Math.round((distance / 30) * 60); // 30 km/h average
    } else {
      return;
    }

    setEta(etaMinutes);
  };

  const renderRideCard = (ride: any, index: number) => {
    const statusInfo = getStatusInfo(ride);
    const StatusIcon = statusInfo.icon;
    
    return (
      <View key={ride.id} style={[styles.rideCard, index > 0 && styles.additionalRideCard]}>
        {/* Ride Header */}
        <View style={styles.rideHeader}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.backgroundColor }]}>
              <StatusIcon size={16} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.title}
              </Text>
            </View>
            <Text style={styles.rideCode}>#{ride.ride_code}</Text>
          </View>
          
          {/* Cancel Button for each ride - including requested status */}
          {(['requested', 'pending', 'assigned', 'confirmed', 'accepted', 'driver_arrived'].includes(ride.status)) && (
            <TouchableOpacity
              style={[styles.cancelRideButton, cancelling && styles.disabledButton]}
              onPress={() => handleCancelRide(ride)}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling && selectedRideForCancel?.id === ride.id ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Text style={styles.cancelRideButtonText}>Cancel</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.statusSubtitle}>{statusInfo.subtitle}</Text>

        {/* Driver Information */}
        {(ride.drivers || ride.assigned_driver) && (
          <View style={styles.driverSection}>
            <Text style={styles.sectionTitle}>Driver Details</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverHeader}>
                <View style={styles.driverAvatar}>
                  <User size={20} color="#FFFFFF" />
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>
                    {(ride.drivers?.users?.full_name || ride.assigned_driver?.users?.full_name) || 'Driver'}
                  </Text>
                  <View style={styles.ratingContainer}>
                    <Star size={12} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.ratingText}>
                      {(ride.drivers?.rating || ride.assigned_driver?.rating) || '5.0'} ({(ride.drivers?.total_rides || ride.assigned_driver?.total_rides) || 0} trips)
                    </Text>
                  </View>
                </View>
                {(ride.drivers?.users?.phone_number || ride.assigned_driver?.users?.phone_number) && (
                  <TouchableOpacity style={styles.callButton}>
                    <Phone size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>

              {(ride.drivers?.vehicles || ride.assigned_driver?.vehicles) && (
                <View style={styles.vehicleInfo}>
                  <Car size={14} color="#6B7280" />
                  <Text style={styles.vehicleText}>
                    {`${(ride.drivers?.vehicles?.make || ride.assigned_driver?.vehicles?.make) || ''} ${(ride.drivers?.vehicles?.model || ride.assigned_driver?.vehicles?.model) || ''}`} • {(ride.drivers?.vehicles?.color || ride.assigned_driver?.vehicles?.color)}
                  </Text>
                  <View style={styles.plateContainer}>
                    <Text style={styles.plateText}>
                      {(ride.drivers?.vehicles?.registration_number || ride.assigned_driver?.vehicles?.registration_number) || 'N/A'}
                    </Text>
                  </View>
                </View>
              )}

              {driverLocation && (
                <View style={styles.locationUpdateContainer}>
                  <View style={styles.locationUpdateDot} />
                  <Text style={styles.locationUpdateText}>
                    Live location • Updated {Math.floor((Date.now() - new Date(driverLocation.updated_at).getTime()) / 1000)}s ago
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Trip Information */}
        <View style={styles.tripSection}>
          <Text style={styles.sectionTitle}>Trip Information</Text>
          <View style={styles.tripCard}>
            <View style={styles.locationContainer}>
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

            <View style={styles.tripDetails}>
              <View style={styles.tripDetailItem}>
                <Clock size={14} color="#6B7280" />
                <Text style={styles.tripDetailText}>
                  {ride.isScheduledBooking ? 'Scheduled for' : 'Booked at'} {formatTime(ride.scheduled_time || ride.created_at)}
                </Text>
              </View>
              
              <View style={styles.tripDetailItem}>
                <Text style={styles.fareLabel}>Fare: </Text>
                <Text style={styles.fareAmount}>₹{ride.fare_amount}</Text>
              </View>

              <View style={styles.tripDetailItem}>
                <Text style={styles.bookingTypeLabel}>Type: </Text>
                <Text style={styles.bookingTypeText}>
                  {ride.booking_type.charAt(0).toUpperCase() + ride.booking_type.slice(1)}
                  {ride.rental_hours ? ` (${ride.rental_hours}h)` : ''}
                </Text>
              </View>
              
              {ride.special_instructions && (
                <View style={styles.tripDetailItem}>
                  <Text style={styles.instructionsLabel}>Instructions: </Text>
                  <Text style={styles.instructionsText} numberOfLines={2}>
                    {ride.special_instructions}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* OTP Display */}
        {ride.pickup_otp && (
          <View style={styles.otpSection}>
            <Text style={styles.sectionTitle}>Trip OTP</Text>
            <View style={styles.otpCard}>
              <View style={styles.otpItem}>
                <Text style={styles.otpLabel}>Pickup OTP:</Text>
                <Text style={styles.otpCode}>{ride.pickup_otp}</Text>
              </View>
              <Text style={styles.otpInstructions}>
                Share the pickup OTP with your driver when they arrive.
              </Text>
            </View>
          </View>
        )}

        {/* OTP Status based on ride status */}
        {ride.status === 'driver_arrived' && !ride.pickup_otp && (
          <View style={styles.otpPendingSection}>
            <Text style={styles.sectionTitle}>Waiting for Pickup OTP</Text>
            <View style={styles.otpPendingCard}>
              <ActivityIndicator size="small" color="#F59E0B" />
              <Text style={styles.otpPendingText}>
                Driver will generate pickup OTP when ready
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const getStatusInfo = (ride: any) => {
    switch (ride?.status) {
      case 'pending':
        return {
          icon: Clock,
          title: 'Pending Assignment',
          subtitle: 'Waiting for admin to assign driver',
          color: '#F59E0B',
          backgroundColor: '#FEF3C7',
        };
      case 'requested':
        return {
          icon: Clock,
          title: 'Finding Driver',
          subtitle: 'Looking for the best driver nearby',
          color: '#F59E0B',
          backgroundColor: '#FEF3C7',
        };
      case 'assigned':
      case 'confirmed':
      case 'accepted':
        return {
          icon: Car,
          title: 'Driver Assigned',
          subtitle: eta ? `Driver arriving in ${formatETA(eta)}` : 'Driver is on the way',
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
          subtitle: eta ? `Arriving in ${formatETA(eta)}` : 'Enjoy your ride!',
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

  const formatETA = (minutes: number): string => {
    if (minutes < 1) return 'Arriving now';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Handle ride completion - show completion notification and refresh
  useEffect(() => {
    const completedRides = activeRides.filter(ride => 
      ride.status === 'completed' || ride.status === 'cancelled'
    );
    
    if (completedRides.length > 0) {
      // Remove completed rides from active list
      setActiveRides(prev => prev.filter(ride => 
        ride.status !== 'completed' && ride.status !== 'cancelled'
      ));
    }
  }, [activeRides, notifications]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (activeRides.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#F8FAFC', '#E2E8F0']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <Text style={styles.title}>My Rides</Text>
          </View>

          <View style={styles.noRideContainer}>
            <View style={styles.noRideIcon}>
              <Car size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.noRideTitle}>No Active Rides</Text>
            <Text style={styles.noRideText}>
              You don't have any active rides at the moment.
            </Text>
            <TouchableOpacity
              style={styles.bookRideButton}
              onPress={() => router.push('/(tabs)')}
              activeOpacity={0.8}
            >
              <Text style={styles.bookRideButtonText}>Book a Ride</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#E2E8F0']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Rides</Text>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2563EB']}
              tintColor="#2563EB"
            />
          }
        >
          {/* Real-time Map for first ride */}
          {activeRides.map((ride, index) => renderRideCard(ride, index))}
        </ScrollView>

        {/* Cancel Confirmation Modal */}
        {showCancelModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Cancel Ride?</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to cancel this ride ({selectedRideForCancel?.ride_code})? This action cannot be undone.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    console.log('🚫 [DEBUG] User selected "No" - keeping ride');
                    setShowCancelModal(false);
                    setSelectedRideForCancel(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelButtonText}>No, Keep Ride</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={() => {
                    console.log('🚫 [DEBUG] User selected "Yes" - proceeding with cancellation');
                    performCancellation();
                  }}
                  activeOpacity={0.8}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalConfirmButtonText}>Yes, Cancel</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  additionalRideCard: {
    marginTop: 8,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  rideCode: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  driverSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  driverCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  vehicleText: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  plateContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  plateText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#92400E',
  },
  locationUpdateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 8,
  },
  locationUpdateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 6,
  },
  locationUpdateText: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
  },
  tripSection: {
    marginBottom: 20,
  },
  tripCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
  },
  locationContainer: {
    marginBottom: 16,
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
  tripDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  tripDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripDetailText: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 8,
  },
  fareLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  fareAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  bookingTypeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  bookingTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  instructionsLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  instructionsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  otpSection: {
    marginBottom: 20,
  },
  otpCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 20,
  },
  otpItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  otpLabel: {
    fontSize: 16,
    color: '#374151',
  },
  otpCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
    fontFamily: 'monospace',
  },
  otpInstructions: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  otpPendingSection: {
    marginBottom: 20,
  },
  otpPendingCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpPendingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    textAlign: 'center',
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
  noRideIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noRideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noRideTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  noRideText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  bookRideButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  bookRideButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cancelRideButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  disabledButton: {
    opacity: 0.5,
  },
  cancelRideButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  modalConfirmButton: {
    backgroundColor: '#DC2626',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});