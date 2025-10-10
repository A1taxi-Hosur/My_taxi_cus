import { supabase } from '../utils/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../utils/supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  private pushTokens: Map<string, string> = new Map();

  // Initialize notifications for the current user
  async initialize(userId: string) {
    // Skip push notification setup on web platform
    if (Platform.OS === 'web') {
      console.log('Push notifications not supported on web platform');
      return;
    }

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions not granted');
        return;
      }

      // Get push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id', // Replace with your actual project ID
      });

      // Store token for this user
      this.pushTokens.set(userId, token.data);

      // Save token to database for server-side notifications
      await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token.data,
          updated_at: new Date().toISOString(),
        });

    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  }

  // Send ride request notification to driver
  async sendRideRequest(driverUserId: string, ride: any) {
    try {
      console.log(`Sending ride request notification to driver user: ${driverUserId}`);
      
      await this.createInAppNotification(
        driverUserId,
        'ride_request',
        'New Ride Request',
        `Pickup: ${ride.pickup_address || ride.pickup_location}${ride.distance ? ` • ${ride.distance.toFixed(1)}km away` : ''}`,
        { 
          rideId: ride.id,
          pickupLocation: ride.pickup_address || ride.pickup_location,
          destinationLocation: ride.destination_address || ride.destination_location,
          fareAmount: ride.fare_amount,
          vehicleType: ride.vehicle_type,
          distance: ride.distance,
          eta: ride.eta
        }
      );

      console.log(`✅ Ride request notification sent to driver: ${driverUserId}`);
    } catch (error) {
      console.error('Error sending ride request notification:', error);
    }
  }

  // Send ride accepted notification to customer
  async sendRideAccepted(customerId: string, ride: any) {
    try {
      console.log(`Sending ride accepted notification to customer: ${customerId}`);
      
      await this.createInAppNotification(
        customerId,
        'ride_accepted',
        'Ride Accepted!',
        'Your driver is on the way to pick you up.',
        { rideId: ride.id }
      );

      console.log(`✅ Ride accepted notification sent to customer: ${customerId}`);
    } catch (error) {
      console.error('Error sending ride accepted notification:', error);
    }
  }

  // Send driver arrived notification to customer
  async sendDriverArrived(customerId: string, ride: any) {
    try {
      console.log(`Sending driver arrived notification to customer: ${customerId}`);
      
      await this.createInAppNotification(
        customerId,
        'driver_arrived',
        'Driver Arrived',
        'Your driver has arrived at the pickup location.',
        { rideId: ride.id }
      );

      console.log(`✅ Driver arrived notification sent to customer: ${customerId}`);
    } catch (error) {
      console.error('Error sending driver arrived notification:', error);
    }
  }

  // Send trip started notification to customer
  async sendTripStarted(customerId: string, ride: any) {
    try {
      console.log(`Sending trip started notification to customer: ${customerId}`);
      
      await this.createInAppNotification(
        customerId,
        'trip_started',
        'Trip Started',
        'Your trip is now in progress.',
        { rideId: ride.id }
      );

      console.log(`✅ Trip started notification sent to customer: ${customerId}`);
    } catch (error) {
      console.error('Error sending trip started notification:', error);
    }
  }

  // Send trip completed notification to customer
  async sendTripCompletedWithFare(customerId: string, ride: any) {
    try {
      console.log(`🏁 Sending trip completed notification with fare details to customer: ${customerId}`);
      console.log(`🏁 Trip details:`, {
        rideId: ride.id,
        bookingType: ride.booking_type,
        fareAmount: ride.fare_amount,
        distance: ride.distance_km,
        duration: ride.duration_minutes,
        isScheduledBooking: ride.isScheduledBooking
      });
      
      // Calculate accurate fare breakdown using fare matrix
      const fareDetails = await this.calculateAccurateFareDetails(ride);
      
      await this.createInAppNotification(
        customerId,
        'trip_completed',
        `${ride.booking_type === 'rental' ? 'Rental' : ride.booking_type === 'outstation' ? 'Outstation Trip' : ride.booking_type === 'airport' ? 'Airport Transfer' : 'Trip'} Completed Successfully!`,
        `${fareDetails.summary} • Driver: ${ride.drivers?.users?.full_name || ride.assigned_driver?.users?.full_name || 'N/A'}`,
        { 
          rideId: ride.id,
          bookingId: ride.isScheduledBooking ? ride.id : null,
          rideCode: ride.ride_code,
          fareAmount: ride.fare_amount,
          fareBreakdown: fareDetails.breakdown,
          driverName: ride.drivers?.users?.full_name || ride.assigned_driver?.users?.full_name,
          driverPhone: ride.drivers?.users?.phone_number || ride.assigned_driver?.users?.phone_number,
          vehicleInfo: (ride.drivers?.vehicles || ride.assigned_driver?.vehicles) ? 
            `${(ride.drivers?.vehicles || ride.assigned_driver?.vehicles).make} ${(ride.drivers?.vehicles || ride.assigned_driver?.vehicles).model}` : null,
          registrationNumber: ride.drivers?.vehicles?.registration_number || ride.assigned_driver?.vehicles?.registration_number,
          vehicleColor: ride.drivers?.vehicles?.color || ride.assigned_driver?.vehicles?.color,
          pickupAddress: ride.pickup_address,
          destinationAddress: ride.destination_address,
          bookingType: ride.booking_type,
          vehicleType: ride.vehicle_type,
          paymentMethod: ride.payment_method || 'cash',
          paymentStatus: ride.payment_status || 'completed',
          distance: ride.distance_km,
          duration: ride.duration_minutes,
          completedAt: new Date().toISOString(),
          canRate: !ride.rating, // Can rate if not already rated
          canDownloadBill: true,
          hasActualData: true, // Flag to indicate this has real fare breakdown
          rentalHours: ride.rental_hours || null,
          specialInstructions: ride.special_instructions || null,
          isScheduledBooking: ride.isScheduledBooking || false,
          // Add driver app fare breakdown if available
          driverAppFareBreakdown: ride.driverAppFareBreakdown || null,
        }
      );

      console.log(`✅ ${ride.booking_type} trip completed notification sent to customer: ${customerId}`);
    } catch (error) {
      console.error('Error sending trip completed notification with fare:', error);
    }
  }

  // Calculate accurate fare details using fare matrix table
  private async calculateAccurateFareDetails(ride: any): Promise<{ summary: string; breakdown: any }> {
    const totalFare = ride.fare_amount || 0;
    const distance = ride.distance_km || 0;
    const duration = ride.duration_minutes || 0;
    
    console.log('💰 [NOTIFICATION] Calculating accurate fare breakdown for notification:', {
      rideId: ride.id,
      totalFare,
      distance,
      duration,
      vehicleType: ride.vehicle_type,
      bookingType: ride.booking_type
    });

    // Get fare configuration from fare_matrix table - MUST use actual database values
    let fareConfig = null;
    try {
      console.log('🔍 [NOTIFICATION] Fetching fare config from fare_matrix table:', {
        vehicle_type: ride.vehicle_type,
        booking_type: ride.booking_type || 'regular'
      });
      
      const { data: fareMatrixConfig, error: fareConfigError } = await supabase
        .from('fare_matrix')
        .select('*')
        .eq('vehicle_type', ride.vehicle_type)
        .eq('booking_type', ride.booking_type || 'regular')
        .eq('is_active', true)
        .single();

      if (!fareConfigError && fareMatrixConfig) {
        fareConfig = fareMatrixConfig;
        console.log('✅ [NOTIFICATION] Loaded ACTUAL fare config from fare_matrix table:', {
          vehicle_type: fareMatrixConfig.vehicle_type,
          booking_type: fareMatrixConfig.booking_type,
          base_fare: fareMatrixConfig.base_fare,
          per_km_rate: fareMatrixConfig.per_km_rate,
          per_minute_rate: fareMatrixConfig.per_minute_rate,
          minimum_fare: fareMatrixConfig.minimum_fare,
          surge_multiplier: fareMatrixConfig.surge_multiplier,
          platform_fee_percent: fareMatrixConfig.platform_fee_percent
        });
      } else {
        console.error('❌ [NOTIFICATION] No fare config found in fare_matrix table:', {
          error: fareConfigError?.message,
          vehicle_type: ride.vehicle_type,
          booking_type: ride.booking_type || 'regular'
        });
        throw new Error(`No fare configuration found for ${ride.vehicle_type} with booking type ${ride.booking_type || 'regular'}`);
      }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Error fetching fare config from database:', error);
      throw error;
    }

    // Calculate fare components using exact driver app logic
    const breakdown = this.calculateExactFareBreakdown(ride, fareConfig, totalFare, distance, duration);
    
    // Create summary text
    let summary = `Total: ₹${totalFare}`;
    if (distance > 0) {
      summary += ` • ${distance.toFixed(1)}km`;
    }
    if (duration > 0) {
      summary += ` • ${Math.round(duration)}min`;
    }
    
    return { summary, breakdown };
  }
  
  // Calculate exact fare breakdown matching driver app logic
  private calculateExactFareBreakdown(ride: any, fareConfig: any, totalFare: number, distance: number, duration: number) {
    console.log('💰 [NOTIFICATION] Calculating exact fare breakdown matching driver app:', {
      rideId: ride.id,
      totalFare,
      distance,
      duration,
      hasFareConfig: !!fareConfig,
      fareConfigDetails: fareConfig ? {
        base_fare: fareConfig.base_fare,
        per_km_rate: fareConfig.per_km_rate,
        per_minute_rate: fareConfig.per_minute_rate,
        minimum_fare: fareConfig.minimum_fare,
        surge_multiplier: fareConfig.surge_multiplier,
        platform_fee_percent: fareConfig.platform_fee_percent
      } : null
    });

    if (!fareConfig) {
      console.error('❌ [NOTIFICATION] CRITICAL: No fare config available - cannot calculate accurate breakdown');
      throw new Error('Fare configuration required for accurate breakdown calculation');
    }

    // CRITICAL: Use EXACT driver app calculation logic with 4km base fare coverage
    // New logic: Base fare covers first 4km, additional distance charged separately
    
    console.log('💰 [NOTIFICATION] Using EXACT driver app calculation with database values:', {
      base_fare: fareConfig.base_fare,
      per_km_rate: fareConfig.per_km_rate,
      per_minute_rate: fareConfig.per_minute_rate,
      distance,
      duration,
      totalFare,
      platform_fee_percent: fareConfig.platform_fee_percent
    });

    // Step 1: Calculate components using EXACT database values with 4km base logic
    const baseFare = Number(fareConfig.base_fare) || 0;
    
    // New 4km base fare logic
    let distanceFare = 0;
    const baseKmCovered = 4; // Base fare covers first 4km
    
    if (distance > baseKmCovered) {
      // Only charge for distance beyond 4km
      const additionalDistance = distance - baseKmCovered;
      distanceFare = additionalDistance * (Number(fareConfig.per_km_rate) || 0);
      console.log('💰 [NOTIFICATION] Distance calculation with 4km base:', {
        totalDistance: distance + 'km',
        baseKmCovered: baseKmCovered + 'km',
        additionalDistance: additionalDistance + 'km',
        perKmRate: fareConfig.per_km_rate,
        distanceFare: distanceFare
      });
    } else {
      // Distance is 4km or less, no additional distance fare
      distanceFare = 0;
      console.log('💰 [NOTIFICATION] Distance ≤ 4km, only base fare applies:', {
        totalDistance: distance + 'km',
        baseKmCovered: baseKmCovered + 'km',
        distanceFare: 0
      });
    }
    
    const timeFare = duration * (Number(fareConfig.per_minute_rate) || 0);
    
    console.log('💰 [NOTIFICATION] Components calculated with 4km base logic:', {
      baseFare,
      distanceFare: distance > baseKmCovered ? 
        `(${distance}km - ${baseKmCovered}km) × ₹${fareConfig.per_km_rate}/km = ₹${distanceFare}` :
        `${distance}km ≤ ${baseKmCovered}km (covered by base fare) = ₹0`,
      timeFare: `${duration}min × ₹${fareConfig.per_minute_rate}/min = ₹${timeFare}`,
      platformFeePercent: fareConfig.platform_fee_percent
    });
    
    // Step 2: Apply minimum fare check (as driver app does)
    let subtotal = baseFare + distanceFare + timeFare;
    const minimumFare = Number(fareConfig.minimum_fare) || 0;
    subtotal = Math.max(subtotal, minimumFare);
    
    // Step 3: Calculate platform fee (as shown in driver app)
    const platformFeePercent = Number(fareConfig.platform_fee_percent) || 0;
    const platformFee = (subtotal * platformFeePercent) / 100;
    
    // Step 4: Calculate surge charges (remaining amount after platform fee)
    const expectedTotal = subtotal + platformFee;
    const surgeFare = Math.max(0, totalFare - expectedTotal);
    
    console.log('💰 [NOTIFICATION] EXACT driver app calculation result with 4km base logic:', {
      baseFare: `₹${baseFare} (from database)`,
      distanceFare: distance > baseKmCovered ? 
        `₹${distanceFare} ((${distance}km - ${baseKmCovered}km) × ₹${fareConfig.per_km_rate})` :
        `₹${distanceFare} (${distance}km ≤ ${baseKmCovered}km, covered by base fare)`,
      timeFare: `₹${timeFare} (${duration}min × ₹${fareConfig.per_minute_rate})`,
      subtotal: `₹${subtotal}`,
      platformFee: `₹${platformFee} (${platformFeePercent}% of subtotal)`,
      surgeFare: `₹${surgeFare} (remaining amount)`,
      totalFare,
      expectedTotal,
      note: 'This should match driver app exactly with 4km base fare logic'
    });
    
    return {
      baseFare: Math.round(baseFare),
      distanceFare: Math.round(distanceFare),
      timeFare: Math.round(timeFare),
      surgeFare: Math.round(surgeFare),
      platformFee: Math.round(platformFee),
      totalFare: totalFare,
      distance: distance,
      duration: duration,
      perKmRate: Number(fareConfig.per_km_rate) || 0,
      perMinRate: Number(fareConfig.per_minute_rate) || 0,
      minimumFare: Number(fareConfig.minimum_fare) || 0,
      platformFeePercent: platformFeePercent,
      configUsed: 'database_exact_match',
      note: 'Calculated using actual fare_matrix database values with 4km base fare coverage'
    };
  }

  // Legacy method for backward compatibility  
  private calculateFareBreakdownFromMatrix(ride: any, fareConfig: any) {
    const totalFare = ride.fare_amount || 0;
    const distance = ride.distance_km || 0;
    const duration = ride.duration_minutes || 0;
    
    console.log('💰 [NOTIFICATION] Legacy calculateFareBreakdownFromMatrix called - redirecting to exact calculation');
    return this.calculateExactFareBreakdown(ride, fareConfig, totalFare, distance, duration);
  }

  // Calculate fare breakdown using fare matrix logic (same as driver app) - DEPRECATED
  private calculateFareBreakdownFromMatrixOld(ride: any, fareConfig: any) {
    const totalFare = ride.fare_amount || 0;
    const distance = ride.distance_km || 0;
    const duration = ride.duration_minutes || 0;
    
    console.log('💰 [NOTIFICATION] Calculating fare breakdown with matrix logic:', {
      totalFare,
      distance,
      duration,
      hasFareConfig: !!fareConfig
    });

    if (!fareConfig) {
      console.error('❌ [NOTIFICATION] No fare config available - cannot calculate accurate breakdown');
      // Return proportional breakdown as fallback
      return {
        baseFare: Math.round(totalFare * 0.3),
        distanceFare: Math.round(totalFare * 0.5),
        timeFare: Math.round(totalFare * 0.15),
        surgeFare: Math.round(totalFare * 0.05),
        platformFee: 0,
        totalFare: totalFare,
        distance: distance,
        duration: duration,
        surgeMultiplier: 1.0,
        platformFeePercent: 0,
        minimumFare: totalFare,
        perKmRate: distance > 0 ? Math.round((totalFare * 0.5) / distance) : 0,
        perMinRate: duration > 0 ? Math.round((totalFare * 0.15) / duration) : 0,
      };
    }

    // Use actual fare matrix config
    const baseFare = fareConfig.base_fare;
    const perKmRate = fareConfig.per_km_rate;
    const perMinRate = fareConfig.per_minute_rate;
    const surgeMultiplier = fareConfig.surge_multiplier;
    const platformFeePercent = fareConfig.platform_fee_percent;
    const minimumFare = fareConfig.minimum_fare;

    console.log('💰 [NOTIFICATION] Using actual fare matrix values:', {
      baseFare,
      perKmRate,
      perMinRate,
      surgeMultiplier,
      platformFeePercent,
      minimumFare
    });

    // Calculate fare components using driver app logic
    const calculatedBaseFare = baseFare;
    const calculatedDistanceFare = distance * perKmRate;
    const calculatedTimeFare = duration * perMinRate;
    
    // Calculate subtotal before surge and platform fee
    let subtotal = calculatedBaseFare + calculatedDistanceFare + calculatedTimeFare;
    
    // Apply minimum fare
    subtotal = Math.max(subtotal, minimumFare);
    
    // Calculate surge charges
    const surgeFare = subtotal * (surgeMultiplier - 1);
    
    // Calculate platform fee
    const platformFee = (subtotal + surgeFare) * (platformFeePercent / 100);
    
    // Final total should match the stored fare_amount
    const calculatedTotal = subtotal + surgeFare + platformFee;
    
    console.log('💰 [NOTIFICATION] Fare breakdown calculation:', {
      baseFare: calculatedBaseFare,
      distanceFare: calculatedDistanceFare,
      timeFare: calculatedTimeFare,
      subtotal,
      surgeFare,
      platformFee,
      calculatedTotal,
      actualTotal: totalFare,
      minimumFare,
      surgeMultiplier,
      platformFeePercent
    });
    
    // If calculated total doesn't match actual, adjust proportionally
    let finalBaseFare = calculatedBaseFare;
    let finalDistanceFare = calculatedDistanceFare;
    let finalTimeFare = calculatedTimeFare;
    let finalSurgeFare = surgeFare;
    let finalPlatformFee = platformFee;
    
    if (Math.abs(calculatedTotal - totalFare) > 1) {
      // Proportionally adjust to match actual total
      const adjustmentFactor = totalFare / calculatedTotal;
      finalBaseFare = calculatedBaseFare * adjustmentFactor;
      finalDistanceFare = calculatedDistanceFare * adjustmentFactor;
      finalTimeFare = calculatedTimeFare * adjustmentFactor;
      finalSurgeFare = surgeFare * adjustmentFactor;
      finalPlatformFee = platformFee * adjustmentFactor;
      
      console.log('🔧 [NOTIFICATION] Applied adjustment factor:', adjustmentFactor);
    }
    
    return {
      baseFare: Math.round(finalBaseFare),
      distanceFare: Math.round(finalDistanceFare),
      timeFare: Math.round(finalTimeFare),
      surgeFare: Math.round(finalSurgeFare),
      platformFee: Math.round(finalPlatformFee),
      totalFare: totalFare,
      distance: distance,
      duration: duration,
      surgeMultiplier: surgeMultiplier,
      platformFeePercent: platformFeePercent,
      minimumFare: minimumFare,
      perKmRate: perKmRate,
      perMinRate: perMinRate,
    };
  }

  // Legacy method - keeping for backward compatibility
  async sendTripCompleted(customerId: string, ride: any) {
    return this.sendTripCompletedWithFare(customerId, ride);
  }
  // Send ride cancelled notification
  async sendRideCancelled(userId: string, ride: any) {
    try {
      console.log(`Sending ride cancelled notification to user: ${userId}`);
      
      await this.createInAppNotification(
        userId,
        'ride_cancelled',
        'Ride Cancelled',
        `Your ride has been cancelled. Reason: ${ride.cancellation_reason || 'No reason provided'}`,
        { rideId: ride.id }
      );

      console.log(`✅ Ride cancelled notification sent to user: ${userId}`);
    } catch (error) {
      console.error('Error sending ride cancelled notification:', error);
    }
  }

  // Send pickup OTP notification to customer
  async sendPickupOTP(customerId: string, ride: any, pickupOtp: string) {
    try {
      console.log(`Sending pickup OTP notification to customer: ${customerId}`);
      
      await this.createInAppNotification(
        customerId,
        'pickup_otp',
        'Pickup OTP Generated',
        `Your pickup OTP is: ${pickupOtp}. Share this with your driver.`,
        { 
          rideId: ride.id,
          pickup_otp: pickupOtp,
          driverName: ride.drivers?.users?.full_name,
          status: ride.status
        }
      );

      console.log(`✅ Pickup OTP notification sent to customer: ${customerId}`);
    } catch (error) {
      console.error('Error sending pickup OTP notification:', error);
    }
  }


  // Cancel ride request notifications to other drivers
  async cancelRideRequestNotifications(rideId: string, acceptedDriverUserId: string) {
    try {
      console.log(`Cancelling ride request notifications for ride: ${rideId}, except driver: ${acceptedDriverUserId}`);
      
      // Mark notifications as cancelled for other drivers
      const { error } = await supabase
        .from('notifications')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('type', 'ride_request')
        .contains('data', { rideId })
        .neq('user_id', acceptedDriverUserId);

      if (error) {
        console.error('Error cancelling notifications:', error);
      } else {
        console.log(`✅ Cancelled ride request notifications for other drivers`);
      }
    } catch (error) {
      console.error('Error cancelling ride request notifications:', error);
    }
  }

  // Send admin booking notification for special ride types
  async sendAdminBookingNotification(bookingData: {
    id: string;
    booking_type: string;
    customer_id: string;
    customer_name: string;
    customer_phone: string | null;
    pickup_address: string;
    destination_address: string | null;
    vehicle_type: string;
    fare_amount: number | null;
    special_instructions?: string;
  }) {
    try {
      console.log('Sending admin booking notification for ride:', bookingData.id);
      
      try {
        // Use edge function to send admin notifications
        const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            booking_data: bookingData,
          }),
        });

        if (!response.ok) {
          throw new Error(`Admin notification failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log(`✅ Admin booking notification sent successfully:`, result);
      } catch (edgeFunctionError) {
        console.warn('Edge function failed, using direct database fallback:', edgeFunctionError);
        
        // Fallback to direct database insertion
        await this.sendAdminBookingNotificationDirect(bookingData);
      }
    } catch (error) {
      console.error('Error sending admin booking notification:', error);
      
      // Final fallback - try direct database insertion
      try {
        console.log('Attempting final fallback to direct database insertion');
        await this.sendAdminBookingNotificationDirect(bookingData);
      } catch (fallbackError) {
        console.error('All admin notification methods failed:', fallbackError);
        // Don't throw error to prevent booking process from failing
      }
    }
  }

  // Fallback method for direct database notification (if edge function fails)
  async sendAdminBookingNotificationDirect(bookingData: {
    id: string;
    booking_type: string;
    customer_id: string;
    customer_name: string;
    customer_phone: string | null;
    pickup_address: string;
    destination_address: string | null;
    vehicle_type: string;
    fare_amount: number | null;
    special_instructions?: string;
  }) {
    try {
      // First, get all admin users
      const { data: adminUsers, error: adminError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (adminError) {
        console.error('Error fetching admin users:', adminError);
        throw adminError;
      }

      if (!adminUsers || adminUsers.length === 0) {
        console.warn('No admin users found to send notifications to');
        return;
      }

      // Create notifications for each admin user
      const notifications = adminUsers.map(admin => ({
        user_id: admin.id,
        type: 'admin_booking',
        title: `New ${bookingData.booking_type.charAt(0).toUpperCase() + bookingData.booking_type.slice(1)} Booking`,
        message: `Customer: ${bookingData.customer_name} • Pickup: ${bookingData.pickup_address}`,
        data: {
          rideId: bookingData.id,
          bookingType: bookingData.booking_type,
          customerId: bookingData.customer_id,
          customerName: bookingData.customer_name,
          customerPhone: bookingData.customer_phone,
          pickupAddress: bookingData.pickup_address,
          destinationAddress: bookingData.destination_address,
          vehicleType: bookingData.vehicle_type,
          fareAmount: bookingData.fare_amount,
          specialInstructions: bookingData.special_instructions,
          requiresAllocation: true,
        },
        status: 'unread',
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('Error creating admin notification:', error);
        throw error;
      }

      console.log(`✅ Admin booking notifications created successfully for ${adminUsers.length} admin(s)`);
    } catch (error) {
      console.error('Error sending admin booking notification:', error);
      throw error;
    }
  }

  // Legacy method - keeping for backward compatibility
  async sendAdminBookingNotificationLegacy(bookingData: {
    id: string;
    booking_type: string;
    customer_id: string;
    customer_name: string;
    customer_phone: string | null;
    pickup_address: string;
    destination_address: string | null;
    vehicle_type: string;
    fare_amount: number | null;
    special_instructions?: string;
  }) {
    try {
      console.log('Sending admin booking notification for ride:', bookingData.id);
      
      // Create a notification with a special admin user ID that all admins can see
      const adminNotification = {
        user_id: 'admin-notifications', // Special identifier for admin notifications
        type: 'admin_booking',
        title: `New ${bookingData.booking_type.charAt(0).toUpperCase() + bookingData.booking_type.slice(1)} Booking`,
        message: `Customer: ${bookingData.customer_name} • Pickup: ${bookingData.pickup_address}`,
        data: {
          rideId: bookingData.id,
          bookingType: bookingData.booking_type,
          customerId: bookingData.customer_id,
          customerName: bookingData.customer_name,
          customerPhone: bookingData.customer_phone,
          pickupAddress: bookingData.pickup_address,
          destinationAddress: bookingData.destination_address,
          vehicleType: bookingData.vehicle_type,
          fareAmount: bookingData.fare_amount,
          specialInstructions: bookingData.special_instructions,
          requiresAllocation: true,
        },
        status: 'unread',
      };

      const { error } = await supabase
        .from('notifications')
        .insert(adminNotification);

      if (error) {
        console.error('Error creating admin notification:', error);
        throw error;
      }

      console.log(`✅ Admin booking notification created successfully`);
    } catch (error) {
      console.error('Error sending admin booking notification:', error);
      throw error;
    }
  }

  // Send push notification
  private async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: any
  ) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: pushToken,
          title,
          body,
          data,
          sound: 'default',
          priority: 'high',
        }),
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Create in-app notification
  private async createInAppNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: any
  ) {
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title,
          message,
          data,
          status: 'unread',
        });
    } catch (error) {
      console.error('Error creating in-app notification:', error);
    }
  }

  // Get notifications for user
  async getNotifications(userId: string) {
    try {
      // Check if Supabase is properly configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, skipping notifications fetch');
        return { data: [], error: null };
      }

      // Check if Supabase is properly configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, skipping notifications fetch');
        return { data: [], error: null };
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { data: null, error };
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string) {
    try {
      await supabase
        .from('notifications')
        .update({ 
          status: 'read',
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
}

export const notificationService = new NotificationService();