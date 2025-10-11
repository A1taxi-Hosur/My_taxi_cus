import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MapPin, Navigation, Clock, X, User, Car, Phone, Star, Copy, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from '../../src/utils/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { realtimeService } from '../../src/services/realtimeService';
import EnhancedGoogleMapView from '../../src/components/EnhancedGoogleMapView';

// Add debug logging for component lifecycle
console.log('🚨 [DEBUG] DriverSearchScreen module loaded');

const { width, height } = Dimensions.get('window');

export default function DriverSearchScreen() {
  console.log('🚨 [DEBUG] DriverSearchScreen component function called');
  
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  console.log('🚨 [DEBUG] DriverSearchScreen hooks initialized:', {
    hasRouter: !!router,
    hasUser: !!user,
    paramsKeys: Object.keys(params),
    paramsValues: params
  });
  
  const [searchStatus, setSearchStatus] = useState<'searching' | 'found' | 'cancelled'>('searching');
  const [estimatedTime, setEstimatedTime] = useState('2-5 min');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rideData, setRideData] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [driverData, setDriverData] = useState<any>(null);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);

  const performCancellation = async () => {
    if (!rideDetails.rideId && !rideDetails.bookingId) {
      console.error('🚫 No ride or booking ID to cancel');
      setShowCancelModal(false);
      router.replace('/(tabs)');
      return;
    }

    console.log('🚫 [DRIVER_SEARCH] Starting cancellation process:', {
      rideId: rideDetails.rideId,
      bookingId: rideDetails.bookingId,
      bookingType: rideDetails.bookingType
    });

    setCancelling(true);
    setShowCancelModal(false);

    try {
      if (rideDetails.rideId) {
        // Cancel regular ride via edge function
        console.log('🚫 Cancelling regular ride via edge function:', rideDetails.rideId);

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/ride-api/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            rideId: rideDetails.rideId,
            userId: user?.id,
            reason: 'Cancelled by customer during driver search',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('🚫 Error cancelling ride:', errorText);
          Alert.alert('Error', 'Failed to cancel ride. Please try again.');
          return;
        }

        const result = await response.json();

        if (result.error) {
          console.error('🚫 Error from edge function:', result.error);
          Alert.alert('Error', 'Failed to cancel ride. Please try again.');
          return;
        }

        console.log('✅ Regular ride cancelled successfully via edge function');
      } else if (rideDetails.bookingId) {
        // Cancel scheduled booking
        console.log('🚫 Cancelling scheduled booking:', rideDetails.bookingId);
        
        const { data, error } = await supabase
          .from('scheduled_bookings')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', rideDetails.bookingId)
          .eq('customer_id', user?.id)
          .in('status', ['pending', 'assigned', 'confirmed'])
          .select();

        if (error) {
          console.error('🚫 Error cancelling booking:', error);
          Alert.alert('Error', 'Failed to cancel booking. Please try again.');
          return;
        }

        if (!data || data.length === 0) {
          console.warn('🚫 No booking found to cancel (may already be cancelled)');
          Alert.alert('Info', 'Booking may already be cancelled or completed.');
        } else {
          console.log('✅ Scheduled booking cancelled successfully');
        }
      }

      // Clear any polling intervals
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        setPollingIntervalId(null);
      }

      // Navigate back to home
      router.replace('/(tabs)');
      
    } catch (error) {
      console.error('🚫 Exception during cancellation:', error);
      Alert.alert('Error', 'Failed to cancel. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  console.log('🚨 [DEBUG] DriverSearchScreen state initialized');

  const SEARCH_TIMEOUT = 120000; // 2 minutes
  const POLL_INTERVAL = 2000; // 2 seconds - more frequent polling

  // Parse ride details from params
  console.log('🚨 [DEBUG] Parsing ride details from params...');
  const rideDetails = {
    rideId: params.rideId as string,
    bookingId: params.bookingId as string,
    pickupLocation: params.pickupLocation as string || 'Current Location',
    destinationLocation: params.destinationLocation as string || 'Destination',
    vehicleType: params.vehicleType as string || 'sedan',
    bookingType: params.bookingType as string || 'regular',
    fareAmount: params.fareAmount as string || '0',
    pickupLatitude: parseFloat(params.pickupLatitude as string || '0'),
    pickupLongitude: parseFloat(params.pickupLongitude as string || '0'),
    destinationLatitude: parseFloat(params.destinationLatitude as string || '0'),
    destinationLongitude: parseFloat(params.destinationLongitude as string || '0'),
  };
  
  console.log('🚨 [DEBUG] Ride details parsed:', rideDetails);

  console.log('🚨 [DEBUG] Driver search initialized with:', {
    rideId: rideDetails.rideId,
    bookingId: rideDetails.bookingId,
    bookingType: rideDetails.bookingType,
    hasRideId: !!rideDetails.rideId,
    hasBookingId: !!rideDetails.bookingId,
    platform: Platform.OS,
    timestamp: new Date().toISOString()
  });

  // Add early return with debug info if critical data is missing
  if (!rideDetails.rideId && !rideDetails.bookingId) {
    console.error('🚨 [DEBUG] CRITICAL: No rideId or bookingId found in params');
    console.error('🚨 [DEBUG] Available params:', params);
    console.error('🚨 [DEBUG] This will cause the component to fail');
  }

  useEffect(() => {
    console.log('🚨 [DEBUG] useEffect for ride monitoring triggered');

    console.log('🔔 [DRIVER_SEARCH] ===== SETTING UP RIDE MONITORING =====');
    console.log('🔔 [DRIVER_SEARCH] Platform:', Platform.OS);
    console.log('🔔 [DRIVER_SEARCH] Available IDs:', {
      rideId: rideDetails.rideId,
      bookingId: rideDetails.bookingId
    });

    let pollingIntervalId: NodeJS.Timeout | null = null;

    // Perform initial check for already assigned driver
    const performInitialCheck = async () => {
      if (rideDetails.bookingId) {
        console.log('🔍 [DRIVER_SEARCH] Performing initial check for booking:', rideDetails.bookingId);
        try {
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

          const response = await fetch(`${supabaseUrl}/functions/v1/get-booking-status?bookingId=${rideDetails.bookingId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });

          if (response.ok) {
            const result = await response.json();
            const bookingData = result.data;

            if (bookingData && bookingData.status === 'assigned' && bookingData.assigned_driver_id) {
              console.log('✅ [DRIVER_SEARCH] Driver already assigned on initial check!');
              await fetchAssignedDriverDetails(bookingData.assigned_driver_id, bookingData);
              return true; // Driver found, no need to start polling
            }
          }
        } catch (error) {
          console.error('❌ [DRIVER_SEARCH] Initial check error:', error);
        }
      }
      return false; // No driver found, need to start polling
    };

    // Start monitoring after initial check
    performInitialCheck().then((driverFound) => {
      if (driverFound) {
        console.log('🔍 [DRIVER_SEARCH] Driver found on initial check, skipping polling setup');
        return;
      }

      // No driver found yet, start polling/subscription
      if (rideDetails.rideId) {
        if (Platform.OS === 'web') {
          console.log('🌐 [DRIVER_SEARCH] Web platform - setting up polling for ride updates');
          pollingIntervalId = setupRidePolling(rideDetails.rideId);
        } else {
          console.log('📱 [DRIVER_SEARCH] Mobile platform - setting up real-time subscription');
          setupRideSubscription(rideDetails.rideId);
        }
      } else if (rideDetails.bookingId) {
        if (Platform.OS === 'web') {
          console.log('🌐 [DRIVER_SEARCH] Web platform - setting up polling for booking updates');
          pollingIntervalId = setupBookingPolling(rideDetails.bookingId);
        } else {
          console.log('📱 [DRIVER_SEARCH] Mobile platform - setting up booking subscription');
          setupBookingSubscription(rideDetails.bookingId);
        }
      }
    });

    // Set timeout for no drivers found
    const timeoutId = setTimeout(() => {
      if (searchStatus === 'searching') {
        console.log('⏰ [DRIVER_SEARCH] Search timeout reached');
        setSearchStatus('cancelled');
        Alert.alert(
          'No Drivers Available',
          'Sorry, no drivers are available at the moment. Please try again later.',
          [
            {
              text: 'Try Again',
              onPress: () => {
                setSearchStatus('searching');
                // Restart polling
                if (rideDetails.rideId && Platform.OS === 'web') {
                  setupRidePolling(rideDetails.rideId);
                } else if (rideDetails.bookingId && Platform.OS === 'web') {
                  setupBookingPolling(rideDetails.bookingId);
                }
              }
            },
            {
              text: 'Go Back',
              onPress: () => router.back(),
              style: 'cancel'
            }
          ]
        );
      }
    }, SEARCH_TIMEOUT);

    return () => {
      console.log('🚨 [DEBUG] useEffect cleanup triggered');
      console.log('🧹 [DRIVER_SEARCH] Cleaning up subscriptions and polling');
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
      clearTimeout(timeoutId);
    };
  }, []); // Empty dependency array to prevent re-runs

  // Setup polling for ride updates (web platform)
  const setupRidePolling = (rideId: string): NodeJS.Timeout => {
    console.log('🚨 [DEBUG] setupRidePolling function called with rideId:', rideId);
    console.log('🌐 [DRIVER_SEARCH] Setting up ride polling for:', rideId);
    
    const intervalId = setInterval(async () => {
      console.log('🚨 [DEBUG] Ride polling interval triggered');
      try {
        // Check if Supabase is properly configured before making requests
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey || 
            supabaseKey.includes('YourActualAnonKeyHere') || 
            supabaseKey.includes('placeholder') ||
            supabaseUrl.includes('placeholder')) {
          console.warn('⚠️ [DRIVER_SEARCH] Supabase not properly configured, skipping ride polling');
          return;
        }

        const { data: rideData, error } = await supabase
          .from('rides')
          .select(`
            *,
            drivers!rides_driver_id_fkey (
              id,
              user_id,
              rating,
              total_rides,
              users!drivers_user_id_fkey (
                full_name,
                phone_number
              ),
              vehicles!fk_drivers_vehicle (
                make,
                model,
                registration_number,
                color,
                vehicle_type
              )
            )
          `)
          .eq('id', rideId)
          .maybeSingle();

        if (error) {
          console.error('🚨 [DEBUG] Ride polling error:', error);
          
          // If it's a network error, don't spam the console
          if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch')) {
            console.warn('⚠️ [DRIVER_SEARCH] Network error during ride polling, will retry...');
          } else {
            console.error('❌ [DRIVER_SEARCH] Polling error:', error);
          }
          return;
        }

        if (rideData && rideData.status === 'accepted' && rideData.driver_id) {
          console.log('🚨 [DEBUG] Driver accepted detected in polling');
          console.log('✅ [DRIVER_SEARCH] Driver accepted via polling!');
          await fetchAcceptedDriverDetails(rideData.driver_id, rideData);
          if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            setPollingIntervalId(null);
          }
        }
      } catch (error) {
        console.error('🚨 [DEBUG] Ride polling exception:', error);
        
        // Handle network errors gracefully
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          console.warn('⚠️ [DRIVER_SEARCH] Network connectivity issue during ride polling, will retry...');
        } else {
          console.error('❌ [DRIVER_SEARCH] Polling exception:', error);
        }
      }
    }, POLL_INTERVAL);

    setPollingIntervalId(intervalId);
    console.log('🚨 [DEBUG] Ride polling setup complete, intervalId:', intervalId);
    return intervalId;
  };

  // Setup polling for booking updates (web platform)
  const setupBookingPolling = (bookingId: string): NodeJS.Timeout => {
    console.log('🚨 [DEBUG] setupBookingPolling function called with bookingId:', bookingId);
    console.log('🌐 [DRIVER_SEARCH] Setting up booking polling for:', bookingId);
    
    const intervalId = setInterval(async () => {
      console.log('🚨 [DEBUG] Booking polling interval triggered');
      try {
        // Check if Supabase is properly configured before making requests
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey ||
            supabaseKey.includes('YourActualAnonKeyHere') ||
            supabaseKey.includes('placeholder') ||
            supabaseUrl.includes('placeholder')) {
          console.warn('⚠️ [DRIVER_SEARCH] Supabase not properly configured, skipping booking polling');
          return;
        }

        // Use edge function to bypass RLS
        const response = await fetch(`${supabaseUrl}/functions/v1/get-booking-status?bookingId=${bookingId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });

        if (!response.ok) {
          console.error('🚨 [DEBUG] Booking polling error:', response.status);
          console.error('❌ [DRIVER_SEARCH] Booking polling error:', response.statusText);

          // If it's a network error, don't spam the console
          if (response.status === 0 || response.status >= 500) {
            console.warn('⚠️ [DRIVER_SEARCH] Network error during polling, will retry...');
          }
          return;
        }

        const result = await response.json();
        const bookingData = result.data;

        if (result.error) {
          console.error('🚨 [DEBUG] Booking polling error:', result.error);
          return;
        }

        if (bookingData && bookingData.status === 'assigned' && bookingData.assigned_driver_id) {
          console.log('🚨 [DEBUG] Driver assigned detected in booking polling');
          console.log('✅ [DRIVER_SEARCH] Driver assigned via polling!');
          await fetchAssignedDriverDetails(bookingData.assigned_driver_id, bookingData);
          if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            setPollingIntervalId(null);
          }
        }
      } catch (error) {
        console.error('🚨 [DEBUG] Booking polling exception:', error);
        
        // Handle network errors gracefully
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          console.warn('⚠️ [DRIVER_SEARCH] Network connectivity issue during polling, will retry...');
        } else {
          console.error('❌ [DRIVER_SEARCH] Booking polling exception:', error);
        }
      }
    }, POLL_INTERVAL);

    setPollingIntervalId(intervalId);
    console.log('🚨 [DEBUG] Booking polling setup complete, intervalId:', intervalId);
    return intervalId;
  };

  // Setup real-time subscription for ride updates (mobile platform)
  const setupRideSubscription = (rideId: string) => {
    console.log('🚨 [DEBUG] setupRideSubscription called with rideId:', rideId);
    console.log('📱 [DRIVER_SEARCH] Setting up ride subscription for:', rideId);
    
    const subscription = realtimeService.subscribeToRide(rideId, async (updatedRide) => {
      console.log('🚨 [DEBUG] Ride subscription update received:', updatedRide);
      console.log('🔔 [DRIVER_SEARCH] Ride update received:', updatedRide);
      
      if (updatedRide.status === 'accepted' && updatedRide.driver_id) {
        console.log('🚨 [DEBUG] Driver accepted via subscription');
        console.log('✅ [DRIVER_SEARCH] Driver accepted via subscription!');
        await fetchAcceptedDriverDetails(updatedRide.driver_id, updatedRide);
      }
    });

    return subscription;
  };

  // Setup real-time subscription for booking updates (mobile platform)
  const setupBookingSubscription = (bookingId: string) => {
    console.log('🚨 [DEBUG] setupBookingSubscription called with bookingId:', bookingId);
    console.log('📱 [DRIVER_SEARCH] Setting up booking subscription for:', bookingId);
    
    const subscription = realtimeService.subscribeToBooking(bookingId, async (updatedBooking) => {
      console.log('🚨 [DEBUG] Booking subscription update received:', updatedBooking);
      console.log('🔔 [DRIVER_SEARCH] Booking update received:', updatedBooking);
      
      if (updatedBooking.status === 'assigned' && updatedBooking.assigned_driver_id) {
        console.log('🚨 [DEBUG] Driver assigned via booking subscription');
        console.log('✅ [DRIVER_SEARCH] Driver assigned via subscription!');
        await fetchAssignedDriverDetails(updatedBooking.assigned_driver_id, updatedBooking);
      }
    });

    return subscription;
  };

  // Start driver location polling
  const startDriverLocationPolling = (driverUserId: string) => {
    console.log('🚨 [DEBUG] startDriverLocationPolling called with userId:', driverUserId);
    console.log('📍 [DRIVER_SEARCH] Starting driver location polling for user:', driverUserId);
    
    const locationPolling = setInterval(async () => {
      console.log('🚨 [DEBUG] Driver location polling interval triggered');
      try {
        const { data: locationData, error } = await supabase
          .from('live_locations')
          .select('*')
          .eq('user_id', driverUserId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && locationData) {
          setDriverLocation(locationData);
          
          // Calculate ETA if we have pickup coordinates
          if (rideDetails.pickupLatitude && rideDetails.pickupLongitude) {
            const distance = calculateDistance(
              locationData.latitude,
              locationData.longitude,
              rideDetails.pickupLatitude,
              rideDetails.pickupLongitude
            );
            const estimatedETA = Math.round((distance / 30) * 60); // Assume 30 km/h in city
            setEta(estimatedETA);
          }
        } else if (error && error.code !== 'PGRST116') {
          // Only log non-empty result errors
          console.error('❌ [DRIVER_SEARCH] Location polling error:', error);
        }
      } catch (error) {
        console.error('🚨 [DEBUG] Location polling error:', error);
        console.error('❌ [DRIVER_SEARCH] Location polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return locationPolling;
  };

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  const fetchAcceptedDriverDetails = async (driverId: string, rideData: any) => {
    console.log('🚨 [DEBUG] fetchAcceptedDriverDetails called with:', { driverId, hasRideData: !!rideData });
    try {
      console.log('🔄 [DRIVER_SEARCH] Fetching accepted driver details for driver ID:', driverId);
      
      // Use the driver data from the ride query if available
      if (rideData && rideData.drivers) {
        console.log('🚨 [DEBUG] Using driver data from ride query');
        console.log('✅ [DRIVER_SEARCH] Using driver data from ride query');
        setDriverData({
          id: rideData.drivers.id,
          name: rideData.drivers.users?.full_name || 'Driver',
          phone: rideData.drivers.users?.phone_number,
          rating: rideData.drivers.rating || 5.0,
          totalRides: rideData.drivers.total_rides || 0,
          vehicle: {
            make: rideData.drivers.vehicles?.make || '',
            model: rideData.drivers.vehicles?.model || '',
            registration: rideData.drivers.vehicles?.registration_number || '',
            color: rideData.drivers.vehicles?.color || '',
            type: rideData.drivers.vehicles?.vehicle_type || '',
          },
        });
        setSearchStatus('found');
        setInitialCheckComplete(true);
        console.log('🚨 [DEBUG] Driver data set, status changed to found');
        
        if (rideData.drivers.user_id) {
          startDriverLocationPolling(rideData.drivers.user_id);
        }
        return;
      }
      
      // If no driver data in ride query, use edge function to bypass RLS
      console.log('🚨 [DEBUG] No driver data in ride query, using edge function');
      console.log('🔄 [DRIVER_SEARCH] Using edge function to fetch driver details (bypasses RLS)');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/driver-details/get-driver?driverId=${driverId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      });
      
      if (!response.ok) {
        console.error('🚨 [DEBUG] Edge function request failed:', response.status, response.statusText);
        console.error('❌ [DRIVER_SEARCH] Edge function request failed:', response.status);
        return;
      }
      
      const { data: driverDetails, error: driverError } = await response.json();
      
      if (driverError || !driverDetails) {
        console.error('🚨 [DEBUG] Edge function returned error:', driverError);
        console.error('❌ [DRIVER_SEARCH] Edge function returned error:', driverError);
        return;
      }
      
      console.log('✅ [DRIVER_SEARCH] Driver details fetched via edge function:', {
        name: driverDetails.users?.full_name,
        phone: driverDetails.users?.phone_number,
        vehicle: driverDetails.vehicles ? `${driverDetails.vehicles.make} ${driverDetails.vehicles.model}` : null
      });
      
      setDriverData({
        id: driverDetails.id,
        name: driverDetails.users?.full_name || 'Driver',
        phone: driverDetails.users?.phone_number,
        rating: driverDetails.rating || 5.0,
        totalRides: driverDetails.total_rides || 0,
        vehicle: {
          make: driverDetails.vehicles?.make || '',
          model: driverDetails.vehicles?.model || '',
          registration: driverDetails.vehicles?.registration_number || '',
          color: driverDetails.vehicles?.color || '',
          type: driverDetails.vehicles?.vehicle_type || '',
        },
      });
      setSearchStatus('found');
      setInitialCheckComplete(true);
      console.log('🚨 [DEBUG] Driver data set from edge function, status changed to found');
      
      if (driverDetails.user_id) {
        startDriverLocationPolling(driverDetails.user_id);
      }
    } catch (error) {
      console.error('🚨 [DEBUG] Exception in fetchAcceptedDriverDetails:', error);
      console.error('❌ [DRIVER_SEARCH] Exception in fetchAcceptedDriverDetails:', error);
    }
  };

  const fetchAssignedDriverDetails = async (driverId: string, bookingData: any) => {
    console.log('🚨 [DEBUG] fetchAssignedDriverDetails called with:', { driverId, hasBookingData: !!bookingData });
    try {
      console.log('🔄 [DRIVER_SEARCH] Fetching assigned driver details for driver ID:', driverId);

      // Check if we already have driver data in bookingData
      if (bookingData?.drivers) {
        console.log('✅ [DRIVER_SEARCH] Using driver data from booking query (already joined)');
        const driverDetails = bookingData.drivers;

        setDriverData({
          id: driverDetails.id,
          name: driverDetails.users?.full_name || 'Driver',
          phone: driverDetails.users?.phone_number,
          rating: driverDetails.rating || 5.0,
          totalRides: driverDetails.total_rides || 0,
          vehicle: {
            make: driverDetails.vehicles?.make || '',
            model: driverDetails.vehicles?.model || '',
            registration: driverDetails.vehicles?.registration_number || '',
            color: driverDetails.vehicles?.color || '',
            type: driverDetails.vehicles?.vehicle_type || '',
          },
        });
        setSearchStatus('found');
        setInitialCheckComplete(true);

        if (driverDetails.user_id) {
          startDriverLocationPolling(driverDetails.user_id);
        }
        return;
      }

      // Fallback to edge function if driver data not in booking
      console.log('🔄 [DRIVER_SEARCH] Using edge function to fetch driver details (bypasses RLS)');

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/driver-details/get-driver?driverId=${driverId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        console.error('🚨 [DEBUG] Edge function request failed:', response.status, response.statusText);
        console.error('❌ [DRIVER_SEARCH] Edge function request failed:', response.status);
        return;
      }

      const { data: driverDetails, error: driverError } = await response.json();

      if (driverError || !driverDetails) {
        console.error('🚨 [DEBUG] Error fetching assigned driver details:', driverError);
        console.error('❌ [DRIVER_SEARCH] Edge function returned error:', driverError);
        return;
      }

      console.log('🚨 [DEBUG] Assigned driver details fetched:', {
        id: driverDetails.id,
        name: driverDetails.users?.full_name,
        hasVehicle: !!driverDetails.vehicles
      });

      console.log('📊 [DRIVER_SEARCH] Assigned driver via edge function:', {
        driverId: driverDetails.id,
        user_id: driverDetails.user_id,
        name: driverDetails.users?.full_name,
        vehicle: driverDetails.vehicles ? `${driverDetails.vehicles.make} ${driverDetails.vehicles.model}` : null
      });

      // Process driver details and set state
      setDriverData({
        id: driverDetails.id,
        name: driverDetails.users?.full_name || 'Driver',
        phone: driverDetails.users?.phone_number,
        rating: driverDetails.rating || 5.0,
        totalRides: driverDetails.total_rides || 0,
        vehicle: {
          make: driverDetails.vehicles?.make || '',
          model: driverDetails.vehicles?.model || '',
          registration: driverDetails.vehicles?.registration_number || '',
          color: driverDetails.vehicles?.color || '',
          type: driverDetails.vehicles?.vehicle_type || '',
        },
      });
      setSearchStatus('found');
      setInitialCheckComplete(true);

      console.log('🚨 [DEBUG] Assigned driver data set, status changed to found');

      if (driverDetails.user_id) {
        startDriverLocationPolling(driverDetails.user_id);
      }

    } catch (error) {
      console.error('🚨 [DEBUG] Exception in fetchAssignedDriverDetails:', error);
      console.error('❌ [DRIVER_SEARCH] Error fetching assigned driver details:', error);
    }
  };

  // Add debug logging for render
  console.log('🚨 [DEBUG] DriverSearchScreen about to render with state:', {
    searchStatus,
    hasDriverData: !!driverData,
    initialCheckComplete,
    loading: false, // Add if you have loading state
    rideDetailsValid: !!(rideDetails.rideId || rideDetails.bookingId)
  });

  // Add early return for debugging
  if (!rideDetails.rideId && !rideDetails.bookingId) {
    console.error('🚨 [DEBUG] RENDERING ERROR COMPONENT - No valid ride or booking ID');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: No ride or booking ID found</Text>
          <Text style={styles.errorSubtext}>Params: {JSON.stringify(params)}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              console.log('🚨 [DEBUG] Back button pressed from error state');
              router.replace('/(tabs)');
            }}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  console.log('🚨 [DEBUG] About to render main component UI');

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#E2E8F0']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              console.log('🚨 [DEBUG] Back button pressed');
              router.replace('/(tabs)');
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Finding Driver</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Debug Info */}
          {/* Map Container */}
          <View style={styles.mapContainer}>
            <EnhancedGoogleMapView
              initialRegion={{
                latitude: rideDetails.pickupLatitude || 12.7402,
                longitude: rideDetails.pickupLongitude || 77.8240,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              pickupCoords={rideDetails.pickupLatitude && rideDetails.pickupLongitude ? {
                latitude: rideDetails.pickupLatitude,
                longitude: rideDetails.pickupLongitude,
              } : undefined}
              destinationCoords={rideDetails.destinationLatitude && rideDetails.destinationLongitude ? {
                latitude: rideDetails.destinationLatitude,
                longitude: rideDetails.destinationLongitude,
              } : undefined}
              driverLocation={driverLocation}
              showRoute={true}
              style={styles.map}
              showUserLocation={true}
              followUserLocation={false}
            />
          </View>

          {/* Search Status */}
          <View style={styles.statusContainer}>
            {searchStatus === 'searching' && (
              <View style={styles.searchingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.searchingTitle}>Finding Your Driver</Text>
                <Text style={styles.searchingSubtitle}>
                  We're looking for the best driver for your {rideDetails.bookingType} trip
                </Text>
                <Text style={styles.estimatedTime}>Estimated wait: {estimatedTime}</Text>
              </View>
            )}

            {searchStatus === 'found' && driverData && (
              <View style={styles.foundContainer}>
                <View style={styles.foundHeader}>
                  <CheckCircle size={32} color="#059669" />
                  <Text style={styles.foundTitle}>Driver Found!</Text>
                </View>
                
                <View style={styles.driverCard}>
                  <View style={styles.driverHeader}>
                    <View style={styles.driverAvatar}>
                      <User size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>{driverData.name}</Text>
                      <View style={styles.ratingContainer}>
                        <Star size={14} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>
                          {driverData.rating} ({driverData.totalRides} trips)
                        </Text>
                      </View>
                    </View>
                    {driverData.phone && (
                      <TouchableOpacity style={styles.callButton}>
                        <Phone size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {driverData.vehicle && (
                    <View style={styles.vehicleInfo}>
                      <Car size={16} color="#6B7280" />
                      <Text style={styles.vehicleText}>
                        {`${driverData.vehicle.make} ${driverData.vehicle.model}`} • {driverData.vehicle.color}
                      </Text>
                      <View style={styles.plateContainer}>
                        <Text style={styles.plateText}>
                          {driverData.vehicle.registration}
                        </Text>
                      </View>
                    </View>
                  )}

                  {eta && (
                    <View style={styles.etaContainer}>
                      <Clock size={16} color="#059669" />
                      <Text style={styles.etaText}>
                        Driver arriving in {eta} minutes
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Trip Details */}
          <View style={styles.tripDetailsContainer}>
            <Text style={styles.tripDetailsTitle}>Trip Details</Text>
            
            <View style={styles.locationContainer}>
              <View style={styles.locationItem}>
                <Navigation size={18} color="#059669" />
                <View style={styles.locationDetails}>
                  <Text style={styles.locationLabel}>Pickup</Text>
                  <Text style={styles.locationText}>{rideDetails.pickupLocation}</Text>
                </View>
              </View>
              
              <View style={styles.locationItem}>
                <MapPin size={18} color="#DC2626" />
                <View style={styles.locationDetails}>
                  <Text style={styles.locationLabel}>Destination</Text>
                  <Text style={styles.locationText}>{rideDetails.destinationLocation}</Text>
                </View>
              </View>
            </View>

            <View style={styles.fareContainer}>
              <Text style={styles.fareLabel}>Estimated Fare</Text>
              <Text style={styles.fareAmount}>₹{rideDetails.fareAmount}</Text>
            </View>
          </View>

          {/* Cancel Button */}
          {searchStatus === 'searching' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                console.log('🚨 [DEBUG] Cancel button pressed');
                setShowCancelModal(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel Search</Text>
            </TouchableOpacity>
          )}

          {/* Track Your Ride Button */}
          <TouchableOpacity
            style={styles.trackRideButton}
            onPress={() => {
              console.log('🚨 [DEBUG] Track Your Ride button pressed');
              // Pass driver data to My Rides tab via navigation state
              router.push({
                pathname: '/(tabs)/rides',
                params: {
                  driverData: driverData ? JSON.stringify(driverData) : undefined,
                  rideId: rideDetails.rideId || rideDetails.bookingId,
                }
              });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.trackRideButtonText}>Track Your Ride</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Cancel Confirmation Modal */}
        {showCancelModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Cancel Search?</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to cancel the driver search?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    console.log('🚨 [DEBUG] Cancel modal - Keep searching');
                    setShowCancelModal(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelButtonText}>Keep Searching</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={() => {
                    console.log('🚨 [DEBUG] Cancel modal - Confirm cancel');
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  mapContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  map: {
    flex: 1,
  },
  statusContainer: {
    marginBottom: 20,
  },
  searchingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  searchingSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  estimatedTime: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  foundContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  foundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  foundTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginLeft: 12,
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
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
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 12,
  },
  etaText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginLeft: 8,
  },
  tripDetailsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tripDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
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
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
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
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  trackRideButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  trackRideButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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