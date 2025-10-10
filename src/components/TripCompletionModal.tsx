import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck as CheckCircle, Star, MapPin, Navigation, Car, User, Clock, Download, Chrome as Home, RotateCcw, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../utils/supabase';
import { billService } from '../services/billService';
import { useAuth } from '../contexts/AuthContext';
import { useRideNotifications } from '../hooks/useRideNotifications';

const { width, height } = Dimensions.get('window');

export default function TripCompletionModal() {
  const router = useRouter();
  const { user } = useAuth();
  const { notifications, markAsRead } = useRideNotifications();
  const [visible, setVisible] = useState(false);
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [driverAppFareBreakdown, setDriverAppFareBreakdown] = useState<any>(null);
  const [processedNotificationIds, setProcessedNotificationIds] = useState<Set<string>>(() => {
    // Load processed IDs from localStorage to persist across re-renders
    try {
      const stored = localStorage.getItem('processedTripCompletionNotifications');
      if (stored) {
        const ids = JSON.parse(stored);
        console.log('🏁 [MODAL] Loaded processed notification IDs from storage:', ids);
        return new Set(ids);
      }
    } catch (error) {
      console.error('Error loading processed notification IDs:', error);
    }
    return new Set();
  });
  const [currentNotificationId, setCurrentNotificationId] = useState<string | null>(null);

  // Persist processed notification IDs to localStorage
  const addToProcessedNotifications = (notificationId: string) => {
    setProcessedNotificationIds(prev => {
      const newSet = new Set([...prev, notificationId]);
      try {
        localStorage.setItem('processedTripCompletionNotifications', JSON.stringify(Array.from(newSet)));
      } catch (error) {
        console.error('Error saving processed notification IDs:', error);
      }
      return newSet;
    });
  };
  
  useEffect(() => {
    console.log('🏁 [MODAL] ===== CHECKING FOR TRIP COMPLETION NOTIFICATIONS =====');
    console.log('🏁 [MODAL] Total notifications:', notifications.length);
    console.log('🏁 [MODAL] Trip completed notifications:', notifications.filter(n => n.type === 'trip_completed').length);
    console.log('🏁 [MODAL] All trip completed (any status):', notifications.filter(n => n.type === 'trip_completed').length);
    console.log('🏁 [MODAL] Unread trip completed:', notifications.filter(n => n.type === 'trip_completed' && n.status === 'unread').length);
    console.log('🏁 [MODAL] Read trip completed:', notifications.filter(n => n.type === 'trip_completed' && n.status === 'read').length);
    console.log('🏁 [MODAL] Current modal state:', { visible, hasRide: !!ride });
    
    // DETAILED ANALYSIS OF ALL TRIP_COMPLETED NOTIFICATIONS
    console.log('🏁 [MODAL] ===== DETAILED TRIP COMPLETION ANALYSIS =====');
    const tripCompletedNotifications = notifications.filter(n => n.type === 'trip_completed');
    
    tripCompletedNotifications.forEach((notification, index) => {
      console.log(`🏁 [MODAL] Trip Completion ${index + 1}:`, {
        id: notification.id,
        type: notification.type,
        status: notification.status,
        title: notification.title,
        message: notification.message,
        created_at: notification.created_at,
        age_minutes: Math.round((Date.now() - new Date(notification.created_at).getTime()) / 1000 / 60),
        data_keys: Object.keys(notification.data || {}),
        full_data: notification.data,
        has_ride_id: !!(notification.data?.ride_id || notification.data?.rideId),
        has_booking_id: !!(notification.data?.booking_id || notification.data?.bookingId),
        ride_id_value: notification.data?.ride_id || notification.data?.rideId,
        booking_id_value: notification.data?.booking_id || notification.data?.bookingId,
        is_test: (notification.data?.ride_id || notification.data?.rideId || '').toString().startsWith('test-'),
        already_processed: processedNotificationIds.has(notification.id),
      });
    });
    
    // Show real trip completion notifications from driver app (including recent read ones)
    const realTripCompletions = notifications.filter(n => {
      const isRightType = n.type === 'trip_completed';
      
      // Check if notification is recent (within last 5 minutes) OR unread
      const notificationAge = Date.now() - new Date(n.created_at).getTime();
      const isRecent = notificationAge < 5 * 60 * 1000; // 5 minutes
      const isUnread = n.status === 'unread';
      const isRecentOrUnread = isUnread || isRecent;
      
      const notProcessed = !processedNotificationIds.has(n.id);
      const hasRideData = !!(n.data?.ride_id || n.data?.booking_id || n.data?.rideId || n.data?.bookingId);
      const notTestData = !n.data?.rideId?.startsWith('test-');
      const notTestData2 = !n.data?.ride_id?.startsWith('test-');
      
      if (isRightType) {
        console.log(`🏁 [MODAL] DETAILED CHECK for notification ${n.id}:`, {
          id: n.id,
          type: n.type,
          status: n.status,
          title: n.title,
          message: n.message,
          created_at: n.created_at,
          age_minutes: Math.round(notificationAge / 1000 / 60),
          
          // Filtering criteria
        isRightType,
        isUnread,
        isRecent,
        isRecentOrUnread,
        notificationAge: Math.round(notificationAge / 1000) + 's',
        hasRideData,
        notTestData,
        willShow: isRightType && isRecentOrUnread && notProcessed && hasRideData && notTestData,
          
          // Data analysis
          data_exists: !!n.data,
          data_keys: Object.keys(n.data || {}),
          ride_id_snake: n.data?.ride_id,
          ride_id_camel: n.data?.rideId,
          booking_id_snake: n.data?.booking_id,
          booking_id_camel: n.data?.bookingId,
          
          // Final decision
          will_show: isRightType && isRecentOrUnread && notProcessed && hasRideData && notTestData,
          blocking_reasons: [
            !isRightType && 'wrong_type',
            !isRecentOrUnread && 'not_recent_or_unread',
            !notProcessed && 'already_processed',
            !hasRideData && 'no_ride_data',
            !notTestData && 'is_test_data'
          ].filter(Boolean),
          
          // Full notification data for debugging
          full_notification_data: n.data
        });
      }
      
      return isRightType && isRecentOrUnread && notProcessed && hasRideData && notTestData;
    });

    console.log('🏁 [MODAL] Real trip completions found:', realTripCompletions.length);
    
    if (realTripCompletions.length > 0) {
      console.log('🏁 [MODAL] ===== FOUND REAL TRIP COMPLETIONS =====');
      realTripCompletions.forEach((n, index) => {
        console.log(`🏁 [MODAL] Real Trip Completion ${index + 1}:`, {
          id: n.id,
          status: n.status,
          title: n.title,
          message: n.message,
          age_minutes: Math.round((Date.now() - new Date(n.created_at).getTime()) / 1000 / 60),
          data_structure: {
            has_data: !!n.data,
            data_keys: Object.keys(n.data || {}),
            ride_id_formats: {
              snake_case: n.data?.ride_id,
              camel_case: n.data?.rideId,
            },
            booking_id_formats: {
              snake_case: n.data?.booking_id,
              camel_case: n.data?.bookingId,
            },
            fare_data: {
              fare_amount: n.data?.fare_amount,
              fareAmount: n.data?.fareAmount,
              total_fare: n.data?.total_fare,
            },
            driver_data: {
              driver_name: n.data?.driver_name,
              driverName: n.data?.driverName,
              vehicle_info: n.data?.vehicle_info,
              vehicleInfo: n.data?.vehicleInfo,
            },
            breakdown_data: {
              fare_breakdown: !!n.data?.fare_breakdown,
              driverAppFareBreakdown: !!n.data?.driverAppFareBreakdown,
              breakdown_keys: Object.keys(n.data?.fare_breakdown || {}),
            }
          },
          full_data: n.data
        });
      });
    }
    
    if (realTripCompletions.length > 0 && !visible && !ride) {
      const latestNotification = realTripCompletions[0];
      
      console.log('🏁 [MODAL] ===== SHOWING TRIP COMPLETION MODAL =====');
      console.log('🏁 [MODAL] Notification details:', {
        id: latestNotification.id,
        title: latestNotification.title,
        message: latestNotification.message,
        rideId: latestNotification.data?.ride_id || latestNotification.data?.rideId,
        bookingId: latestNotification.data?.booking_id || latestNotification.data?.bookingId,
        fareAmount: latestNotification.data?.fare_amount || latestNotification.data?.fareAmount,
        hasDriverAppBreakdown: !!(latestNotification.data?.fare_breakdown || latestNotification.data?.driverAppFareBreakdown),
        allDataKeys: Object.keys(latestNotification.data || {})
      });
      
      // Mark as processed immediately
      addToProcessedNotifications(latestNotification.id);
      setCurrentNotificationId(latestNotification.id);
      
      // Set fare breakdown
      if (latestNotification.data?.fare_breakdown || latestNotification.data?.driverAppFareBreakdown) {
        setDriverAppFareBreakdown(latestNotification.data.fare_breakdown || latestNotification.data.driverAppFareBreakdown);
      }
      
      // Create ride object
      const rideFromNotification = {
        id: latestNotification.data?.ride_id || latestNotification.data?.rideId || latestNotification.data?.booking_id || latestNotification.data?.bookingId,
        ride_code: latestNotification.data?.ride_code || latestNotification.data?.rideCode || `TRIP-${(latestNotification.data?.ride_id || latestNotification.data?.rideId || latestNotification.data?.booking_id || latestNotification.data?.bookingId || '').substring(0, 6).toUpperCase()}`,
        fare_amount: latestNotification.data?.fare_amount || latestNotification.data?.fareAmount || 0,
        distance_km: latestNotification.data?.distance_km || latestNotification.data?.distance || 0,
        duration_minutes: latestNotification.data?.duration_minutes || latestNotification.data?.duration || 0,
        booking_type: latestNotification.data?.booking_type || latestNotification.data?.bookingType || 'regular',
        vehicle_type: latestNotification.data?.vehicle_type || latestNotification.data?.vehicleType || 'sedan',
        pickup_address: latestNotification.data?.pickup_address || latestNotification.data?.pickupAddress,
        destination_address: latestNotification.data?.destination_address || latestNotification.data?.destinationAddress,
        payment_method: latestNotification.data?.payment_method || latestNotification.data?.paymentMethod || 'cash',
        payment_status: latestNotification.data?.payment_status || latestNotification.data?.paymentStatus || 'completed',
        updated_at: latestNotification.data?.completed_at || latestNotification.data?.completedAt || latestNotification.created_at,
        status: 'completed',
        rental_hours: latestNotification.data?.rental_hours || latestNotification.data?.rentalHours,
        special_instructions: latestNotification.data?.special_instructions || latestNotification.data?.specialInstructions,
        isScheduledBooking: latestNotification.data?.is_scheduled_booking || latestNotification.data?.isScheduledBooking,
        drivers: (latestNotification.data?.driver_name || latestNotification.data?.driverName) ? {
          users: {
            full_name: latestNotification.data.driver_name || latestNotification.data.driverName,
            phone_number: latestNotification.data.driver_phone || latestNotification.data.driverPhone
          },
          vehicles: (latestNotification.data.vehicle_info || latestNotification.data.vehicleInfo) ? {
            make: (latestNotification.data.vehicle_info || latestNotification.data.vehicleInfo).split(' ')[0],
            model: (latestNotification.data.vehicle_info || latestNotification.data.vehicleInfo).split(' ').slice(1).join(' '),
            registration_number: latestNotification.data.registration_number || latestNotification.data.registrationNumber,
            color: latestNotification.data.vehicle_color || latestNotification.data.vehicleColor
          } : null,
          rating: latestNotification.data.driver_rating || latestNotification.data.driverRating
        } : null
      };
      
      setRide(rideFromNotification);
      setVisible(true);
      
      console.log('🏁 [MODAL] Modal should now be visible with ride data');
      console.log('🏁 [MODAL] Ride object created:', {
        id: rideFromNotification.id,
        ride_code: rideFromNotification.ride_code,
        fare_amount: rideFromNotification.fare_amount,
        booking_type: rideFromNotification.booking_type,
        hasDriverData: !!rideFromNotification.drivers
      });
    }
  }, [notifications, processedNotificationIds, visible, ride]);
  
  const handleRating = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting');
      return;
    }

    setSubmittingRating(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          rating: rating,
          updated_at: new Date().toISOString()
        })
        .eq('id', ride.id);

      if (error) {
        console.error('Error submitting rating:', error);
        Alert.alert('Error', 'Failed to submit rating');
        return;
      }

      console.log('✅ Rating submitted successfully:', { rating });
      Alert.alert('Thank You!', 'Your rating has been submitted successfully');
      
      // Update local ride data
      setRide(prev => ({ ...prev, rating }));
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleDownloadBill = async () => {
    try {
      console.log('📄 Download bill requested for completed ride:', ride.ride_code);
      await billService.downloadBill(ride);
      
      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Bill downloaded successfully!');
      }
    } catch (error) {
      console.error('Error downloading bill:', error);
      Alert.alert('Error', 'Failed to download bill. Please try again.');
    }
  };

  const handleClose = () => {
    // Mark notification as read when modal is closed
    if (currentNotificationId) {
      markAsRead(currentNotificationId);
    }
    
    setVisible(false);
    setRide(null);
    setRating(0);
    setDriverAppFareBreakdown(null);
    setCurrentNotificationId(null);
  };

  const handleBookAnother = () => {
    // Mark notification as read when booking another ride
    if (currentNotificationId) {
      markAsRead(currentNotificationId);
    }
    
    setVisible(false);
    setRide(null);
    setRating(0);
    setDriverAppFareBreakdown(null);
    setCurrentNotificationId(null);
    router.push('/');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

  if (!visible || !ride) {
    return null;
  }
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <LinearGradient
        colors={['#F0F9FF', '#E0F2FE']}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header with close button */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <CheckCircle size={32} color="#10B981" />
              <Text style={styles.headerTitle}>Trip Completed!</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <X size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          {/* Trip Summary */}
          <View style={styles.tripSummary}>
            <View style={styles.summaryRow}>
              <MapPin size={20} color="#64748B" />
              <Text style={styles.summaryLabel}>Distance:</Text>
              <Text style={styles.summaryValue}>{ride.distance_km?.toFixed(2) || '0'} km (Actual)</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Clock size={20} color="#64748B" />
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>{Math.round(ride.duration_minutes || 0)} minutes (Actual)</Text>
            </View>
          </View>

          {/* Route Details */}
          <View style={styles.routeSection}>
            <Text style={styles.sectionTitle}>Route Details</Text>
            <View style={styles.addressContainer}>
              <View style={styles.addressItem}>
                <View style={[styles.addressDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.addressText}>{ride.pickup_address}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.addressItem}>
                <View style={[styles.addressDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.addressText}>{ride.destination_address}</Text>
              </View>
            </View>
          </View>

          {/* Driver App Fare Breakdown */}
          {driverAppFareBreakdown && (
            <View style={styles.fareSection}>
              <Text style={styles.sectionTitle}>Fare Breakdown (Driver App Calculation)</Text>
              <View style={styles.fareCard}>
                {/* Outstation fare breakdown */}
                {driverAppFareBreakdown.type === 'outstation' && (
                  <>
                    <View style={styles.fareItem}>
                      <Text style={styles.fareLabel}>
                        {driverAppFareBreakdown.within_allowance ? 
                          `Daily Allowance (${driverAppFareBreakdown.daily_km_limit}km × ${driverAppFareBreakdown.days} day${driverAppFareBreakdown.days > 1 ? 's' : ''})` :
                          `Total Distance (${driverAppFareBreakdown.km_used?.toFixed(1)}km × ₹${driverAppFareBreakdown.per_km_rate}/km)`
                        }
                      </Text>
                      <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.distance_fare)}</Text>
                    </View>
                    
                    <View style={styles.fareItem}>
                      <Text style={styles.fareLabel}>
                        Driver Allowance ({driverAppFareBreakdown.days} day${driverAppFareBreakdown.days > 1 ? 's' : ''} × ₹{driverAppFareBreakdown.driver_charge_per_day}/day)
                      </Text>
                      <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.driver_allowance)}</Text>
                    </View>
                    
                    {driverAppFareBreakdown.base_fare > 0 && (
                      <View style={styles.fareItem}>
                        <Text style={styles.fareLabel}>Base Fare</Text>
                        <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.base_fare)}</Text>
                      </View>
                    )}
                    
                    <View style={styles.fareItem}>
                      <Text style={styles.fareLabel}>Distance Summary</Text>
                      <Text style={styles.fareValue}>
                        {driverAppFareBreakdown.km_used?.toFixed(1)}km {driverAppFareBreakdown.within_allowance ? '(Within Allowance)' : '(Exceeds Allowance)'}
                      </Text>
                    </View>
                  </>
                )}
                
                {/* Rental fare breakdown */}
                {driverAppFareBreakdown.type === 'rental' && (
                  <>
                    <View style={styles.fareItem}>
                      <Text style={styles.fareLabel}>
                        Base Package ({driverAppFareBreakdown.rental_hours}h • {driverAppFareBreakdown.km_included}km included)
                      </Text>
                      <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.base_fare)}</Text>
                    </View>
                    
                    {driverAppFareBreakdown.extra_km > 0 && (
                      <View style={styles.fareItem}>
                        <Text style={styles.fareLabel}>
                          Extra Distance ({driverAppFareBreakdown.extra_km?.toFixed(1)}km × ₹{driverAppFareBreakdown.extra_km_rate}/km)
                        </Text>
                        <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.extra_km_fare)}</Text>
                      </View>
                    )}
                    
                    {driverAppFareBreakdown.extra_minutes > 0 && (
                      <View style={styles.fareItem}>
                        <Text style={styles.fareLabel}>
                          Extra Time ({driverAppFareBreakdown.extra_minutes}min × ₹{driverAppFareBreakdown.extra_min_rate}/min)
                        </Text>
                        <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.extra_time_fare)}</Text>
                      </View>
                    )}
                  </>
                )}
                
                {/* Airport fare breakdown */}
                {driverAppFareBreakdown.type === 'airport' && (
                  <>
                    <View style={styles.fareItem}>
                      <Text style={styles.fareLabel}>Base Fare</Text>
                      <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.base_fare)}</Text>
                    </View>
                    
                    <View style={styles.fareItem}>
                      <Text style={styles.fareLabel}>
                        Distance Fare ({driverAppFareBreakdown.distance?.toFixed(1)}km × ₹{driverAppFareBreakdown.per_km_rate}/km)
                      </Text>
                      <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.distance_fare)}</Text>
                    </View>
                    
                    {driverAppFareBreakdown.airport_fee > 0 && (
                      <View style={styles.fareItem}>
                        <Text style={styles.fareLabel}>Airport Fee</Text>
                        <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.airport_fee)}</Text>
                      </View>
                    )}
                  </>
                )}
                
                {/* Regular ride fare breakdown */}
                {driverAppFareBreakdown.type === 'regular' && (
                  <>
                    <View style={styles.fareItem}>
                      <Text style={styles.fareLabel}>Base Fare (covers first {driverAppFareBreakdown.base_km_covered || 4}km)</Text>
                      <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.base_fare)}</Text>
                    </View>
                    
                    {driverAppFareBreakdown.distance_fare > 0 && (
                      <View style={styles.fareItem}>
                        <Text style={styles.fareLabel}>
                          Distance Fare ({Math.max(0, (driverAppFareBreakdown.distance || 0) - (driverAppFareBreakdown.base_km_covered || 4)).toFixed(1)}km × ₹{driverAppFareBreakdown.per_km_rate}/km)
                        </Text>
                        <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.distance_fare)}</Text>
                      </View>
                    )}
                    
                    {driverAppFareBreakdown.time_fare > 0 && (
                      <View style={styles.fareItem}>
                        <Text style={styles.fareLabel}>
                          Time Fare ({driverAppFareBreakdown.duration}min × ₹{driverAppFareBreakdown.per_min_rate}/min)
                        </Text>
                        <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.time_fare)}</Text>
                      </View>
                    )}
                    
                    {driverAppFareBreakdown.platform_fee > 0 && (
                      <View style={styles.fareItem}>
                        <Text style={styles.fareLabel}>Platform Fee ({driverAppFareBreakdown.platform_fee_percent}%)</Text>
                        <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.platform_fee)}</Text>
                      </View>
                    )}
                    
                    {driverAppFareBreakdown.surge_fare > 0 && (
                      <View style={styles.fareItem}>
                        <Text style={styles.fareLabel}>Surge Charges</Text>
                        <Text style={styles.fareValue}>{formatCurrency(driverAppFareBreakdown.surge_fare)}</Text>
                      </View>
                    )}
                  </>
                )}
                
                <View style={styles.separator} />
                
                <View style={styles.totalFareItem}>
                  <Text style={styles.totalFareLabel}>Total Fare</Text>
                  <Text style={styles.totalFareValue}>{formatCurrency(ride.fare_amount)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Driver Information */}
          {ride.drivers && (
            <View style={styles.driverSection}>
              <Text style={styles.sectionTitle}>Driver Information</Text>
              <View style={styles.driverCard}>
                <View style={styles.driverHeader}>
                  <View style={styles.driverAvatar}>
                    <User size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>
                      {ride.drivers.users?.full_name || 'Driver'}
                    </Text>
                    {ride.drivers.rating && (
                      <View style={styles.driverRating}>
                        <Star size={14} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.driverRatingText}>
                          {ride.drivers.rating} rating
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {ride.drivers.vehicles && (
                  <View style={styles.vehicleInfo}>
                    <Car size={16} color="#6B7280" />
                    <Text style={styles.vehicleText}>
                      {`${ride.drivers.vehicles.make || ''} ${ride.drivers.vehicles.model || ''} • ${ride.drivers.vehicles.color || ''}`}
                    </Text>
                    <View style={styles.plateContainer}>
                      <Text style={styles.plateText}>
                        {ride.drivers.vehicles.registration_number || 'N/A'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Payment Information */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.paymentCard}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Method</Text>
                <Text style={styles.paymentValue}>
                  {ride.payment_method?.charAt(0).toUpperCase() + ride.payment_method?.slice(1) || 'Cash'}
                </Text>
              </View>
            </View>
          </View>

          {/* Rating Section */}
          {!ride.rating && (
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>Rate Your Experience</Text>
              <View style={styles.ratingCard}>
                <Text style={styles.ratingPrompt}>How was your ride?</Text>
                
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRating(star)}
                      style={styles.starButton}
                    >
                      <Star
                        size={32}
                        color="#F59E0B"
                        fill={star <= rating ? "#F59E0B" : "transparent"}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitRatingButton,
                    rating === 0 && styles.disabledButton
                  ]}
                  onPress={handleRating}
                  disabled={rating === 0 || submittingRating}
                >
                  {submittingRating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitRatingText}>Submit Rating</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bill Actions */}
          <View style={styles.billSection}>
            <Text style={styles.sectionTitle}>Bill & Receipt</Text>
            <View style={styles.billActionsContainer}>
              <TouchableOpacity
                style={styles.billActionButton}
                onPress={handleDownloadBill}
                activeOpacity={0.7}
              >
                <Download size={20} color="#2563EB" />
                <Text style={styles.billActionText}>Download Bill</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.bookAnotherButton}
              onPress={handleBookAnother}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#2563EB', '#1D4ED8']}
                style={styles.bookAnotherGradient}
              >
                <RotateCcw size={20} color="#FFFFFF" />
                <Text style={styles.bookAnotherText}>Book Another Ride</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.goHomeButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Home size={20} color="#374151" />
              <Text style={styles.goHomeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Loading trip details...</Text>
          </View>
        )}
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
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
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tripSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#64748B',
    marginLeft: 12,
    flex: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  routeSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  addressContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 5,
    marginVertical: 8,
  },
  fareSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  fareCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  fareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fareLabel: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  totalFareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  totalFareLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalFareValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  driverSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  driverCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverRatingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  vehicleText: {
    fontSize: 14,
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
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
  },
  paymentSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  paymentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  ratingSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  ratingCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  ratingPrompt: {
    fontSize: 16,
    color: '#92400E',
    marginBottom: 16,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  starButton: {
    padding: 8,
  },
  submitRatingButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitRatingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  billSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  billActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  billActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 0.45,
    justifyContent: 'center',
  },
  billActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  bookAnotherButton: {
    borderRadius: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bookAnotherGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
  },
  bookAnotherText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  goHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 18,
  },
  goHomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
});