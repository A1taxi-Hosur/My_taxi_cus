import { supabase } from '../utils/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../utils/supabase';
import { notificationService } from './notificationService';

export interface CreateRideParams {
  customerId: string;
  pickupLocation: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLocation: string;
  destinationLatitude: number;
  destinationLongitude: number;
  vehicleType: string;
  fareAmount: number;
  pickupLandmark?: string;
  destinationLandmark?: string;
}

export interface RideDetails {
  id: string;
  ride_code: string;
  customer_id: string;
  driver_id?: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  status: string;
  fare_amount: number;
  vehicle_type: string;
  created_at: string;
  updated_at: string;
}

class RideService {
  async createRide(params: CreateRideParams): Promise<{ data: RideDetails | null; error: any }> {
    try {
      console.log('🚗 Creating ride with params:', params);
      
      // Check if Supabase is properly configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey || 
          supabaseKey.includes('placeholder') || 
          supabaseUrl.includes('placeholder')) {
        console.warn('⚠️ Supabase not configured - returning demo ride data');
        
        // Return demo ride data for testing
        const demoRide: RideDetails = {
          id: `demo-${Date.now()}`,
          ride_code: `DEMO${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          customer_id: params.customerId,
          pickup_address: params.pickupLocation,
          pickup_latitude: params.pickupLatitude,
          pickup_longitude: params.pickupLongitude,
          destination_address: params.destinationLocation,
          destination_latitude: params.destinationLatitude,
          destination_longitude: params.destinationLongitude,
          status: 'requested',
          fare_amount: params.fareAmount,
          vehicle_type: params.vehicleType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        console.log('✅ Demo ride created:', demoRide.ride_code);
        return { data: demoRide, error: null };
      }
      
      // Use edge function to create ride (bypasses RLS authentication issues)
      console.log('📡 Creating ride via edge function to bypass RLS...');
      const response = await fetch(`${supabaseUrl}/functions/v1/ride-api/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          customerId: params.customerId,
          pickupLocation: params.pickupLocation,
          pickupLatitude: params.pickupLatitude,
          pickupLongitude: params.pickupLongitude,
          destinationLocation: params.destinationLocation,
          destinationLatitude: params.destinationLatitude,
          destinationLongitude: params.destinationLongitude,
          vehicleType: params.vehicleType,
          fareAmount: params.fareAmount,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error creating ride via edge function:', errorText);
        return { data: null, error: new Error(errorText) };
      }

      const result = await response.json();

      if (result.error) {
        console.error('❌ Edge function returned error:', result.error);
        return { data: null, error: result.error };
      }

      const ride = result.data;
      console.log('✅ Ride created via edge function:', ride.id);

      // Only notify drivers for regular rides, admin for special bookings
      if (ride.booking_type === 'regular') {
        try {
          console.log('📢 Starting driver notification process for regular ride...');
          
          // Check if Supabase is properly configured before attempting notifications
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          
          if (!supabaseUrl || !supabaseKey || 
              supabaseKey.includes('YourActualAnonKeyHere') || 
              supabaseKey.includes('placeholder') ||
              supabaseUrl.includes('placeholder')) {
            console.warn('⚠️ Supabase not properly configured, skipping driver notifications');
            console.log('✅ Ride created successfully without driver notifications');
            return { data: ride, error: null };
          }
          
          const notificationResult = await this.notifyDriversViaAPI(ride);
          console.log('✅ Driver notifications sent successfully');
        } catch (notifyError) {
          console.warn('⚠️ Driver notification failed (non-blocking):', notifyError instanceof Error ? notifyError.message : 'Unknown error');
          // Don't fail the ride creation if notifications fail
        }
      } else {
        console.log('📋 Special booking type detected, admin notification will be handled by booking screen');
      }

      return { data: ride, error: null };
    } catch (error) {
      console.error('❌ Ride creation failed:', error);
      return { data: null, error };
    }
  }

  private async notifyDriversViaAPI(ride: any) {
    try {
      console.log('📢 Notifying drivers via edge function for ride:', ride.id);
      
      const apiUrl = `${SUPABASE_URL}/functions/v1/driver-api/notify-drivers`;
      console.log('📡 Making request to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ 
          ride_id: ride.id,
          ride_data: {
            id: ride.id,
            ride_id: ride.id,                    // Legacy format
            rideId: ride.id,                     // Customer app format
            customer_id: ride.customer_id,
            customerId: ride.customer_id,        // Customer app format
            pickup_address: ride.pickup_address,
            pickupLocation: ride.pickup_address, // Customer app format
            pickup_latitude: ride.pickup_latitude,
            pickup_longitude: ride.pickup_longitude,
            pickupCoords: {                      // Customer app format
              latitude: ride.pickup_latitude,
              longitude: ride.pickup_longitude,
            },
            pickup_latitude: ride.pickup_latitude,
            pickup_longitude: ride.pickup_longitude,
            destination_address: ride.destination_address,
            destinationLocation: ride.destination_address, // Customer app format
            destination_latitude: ride.destination_latitude,
            destination_longitude: ride.destination_longitude,
            destinationCoords: ride.destination_latitude ? { // Customer app format
              latitude: ride.destination_latitude,
              longitude: ride.destination_longitude,
            } : null,
            vehicle_type: ride.vehicle_type,
            vehicleType: ride.vehicle_type,      // Customer app format
            fare_amount: ride.fare_amount,
            fareAmount: ride.fare_amount,        // Customer app format
            booking_type: ride.booking_type,
            bookingType: ride.booking_type,      // Customer app format
            status: ride.status,
            created_at: ride.created_at
          }
        }),
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Driver notification API failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Notified ${result.drivers_notified || 0} drivers successfully:`, result);
      return result;
    } catch (error) {
      console.error('❌ Error notifying drivers via API:', error);
      throw error;
    }
  }

  async acceptRide(rideId: string, driverId: string): Promise<{ data: RideDetails | null; error: any }> {
    try {
      const { data: ride, error } = await supabase
        .from('rides')
        .update({
          driver_id: driverId,
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', rideId)
        .eq('status', 'requested')
        .select()
        .single();

      if (error) {
        console.error('Error accepting ride:', error);
        return { data: null, error };
      }

      if (ride) {
        // Update driver status to busy
        await supabase
          .from('drivers')
          .update({ status: 'busy' })
          .eq('id', driverId);

        // Get customer info and send notification
        const { data: customer } = await supabase
          .from('users')
          .select('id')
          .eq('id', ride.customer_id)
          .single();

        if (customer) {
          await notificationService.sendRideAccepted(customer.id, ride);
        }

        // Cancel notifications for other drivers
        await notificationService.cancelRideRequestNotifications(rideId, driverId);
      }

      return { data: ride, error: null };
    } catch (error) {
      console.error('Ride acceptance failed:', error);
      return { data: null, error };
    }
  }

  async updateRideStatus(rideId: string, status: string, driverId: string, extraData?: any): Promise<{ data: RideDetails | null; error: any }> {
    try {
      const { data: ride, error } = await supabase
        .from('rides')
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...(extraData || {})
        })
        .eq('id', rideId)
        .eq('driver_id', driverId)
        .select(`
          *,
          drivers!rides_driver_id_fkey (
            id,
            user_id,
            license_number,
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
        .single();

      if (error) {
        console.error('Error updating ride status:', error);
        return { data: null, error };
      }

      // Send status update notifications to customer
      if (ride) {
        const { data: customer } = await supabase
          .from('users')
          .select('id')
          .eq('id', ride.customer_id)
          .single();

        if (customer) {
          switch (status) {
            case 'driver_arrived':
              await notificationService.sendDriverArrived(customer.id, ride);
              break;
            case 'in_progress':
              await notificationService.sendTripStarted(customer.id, ride);
              break;
            case 'completed':
              await notificationService.sendTripCompletedWithFare(customer.id, ride);
              break;
          }
        }
      }

      // Update driver status when trip completes
      if (status === 'completed') {
        await supabase
          .from('drivers')
          .update({ status: 'online' })
          .eq('id', driverId);
      }

      return { data: ride, error: null };
    } catch (error) {
      console.error('Ride status update failed:', error);
      return { data: null, error };
    }
  }

  async findNearbyDrivers(latitude: number, longitude: number, vehicleType: string, radius: number = 10) {
    try {
      console.log('RideService: Finding nearby drivers', {
        location: { latitude, longitude },
        vehicleType,
        radius
      });
      
      // Use the new find-nearby-drivers edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/find-nearby-drivers/find-drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          pickup_latitude: latitude,
          pickup_longitude: longitude,
          vehicle_type: vehicleType,
          radius_km: radius,
        }),
      });

      if (!response.ok) {
        throw new Error(`Driver search API failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('Driver search API response:', responseData);

      if (!responseData.success) {
        console.error('Driver search failed:', responseData.error);
        return { data: [], error: responseData.error };
      }

      // Transform API response to match expected format
      const transformedDrivers = responseData.drivers?.map((driver: any) => ({
        id: driver.driver_id,
        user_id: driver.user_id,
        rating: driver.rating,
        distance: driver.distance_km,
        eta: driver.eta_minutes,
        users: {
          full_name: driver.name,
          phone_number: driver.phone,
        },
        vehicles: {
          make: driver.vehicle.make,
          model: driver.vehicle.model,
          registration_number: driver.vehicle.registration_number,
          color: driver.vehicle.color,
        },
        live_locations: [{
          latitude: driver.location.latitude,
          longitude: driver.location.longitude,
          updated_at: driver.location.updated_at,
        }],
      })) || [];

      console.log('Transformed drivers:', transformedDrivers.length);
      return { data: transformedDrivers, error: null };
    } catch (error) {
      console.error('Find nearby drivers failed:', error);
      return { data: [], error };
    }
  }

  async getRideDetails(rideId: string): Promise<{ data: any; error: any }> {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/ride-api/details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ rideId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { data: null, error: new Error(errorText) };
      }

      const result = await response.json();
      return { data: result.data, error: result.error };
    } catch (error) {
      console.error('Get ride details failed:', error);
      return { data: null, error };
    }
  }

  async getCurrentRide(userId: string): Promise<{ data: RideDetails | null; error: any }> {
    try {
      console.log('🔍 [RIDE_SERVICE] getCurrentRide called for userId:', userId);

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/ride-api/current`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 [RIDE_SERVICE] Error from edge function:', errorText);
        return { data: null, error: new Error(errorText) };
      }

      const result = await response.json();

      if (result.data) {
        console.log('🔍 [RIDE_SERVICE] Found current ride:', {
          id: result.data.id,
          status: result.data.status,
        });
      }

      return { data: result.data, error: result.error };
    } catch (error) {
      console.error('Get current ride failed:', error);
      return { data: null, error };
    }
  }

  async cancelRide(rideId: string, userId: string, reason?: string): Promise<{ data: RideDetails | null; error: any }> {
    try {
      console.log('🚫 RideService.cancelRide called with:', { rideId, userId, reason });

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      // Use edge function to cancel ride (bypasses RLS authentication issues)
      console.log('📡 Cancelling ride via edge function...');
      const response = await fetch(`${supabaseUrl}/functions/v1/ride-api/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          rideId,
          userId,
          reason: reason || 'Cancelled by customer',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error cancelling ride via edge function:', errorText);
        return { data: null, error: new Error(errorText) };
      }

      const result = await response.json();

      if (result.error) {
        console.error('❌ Edge function returned error:', result.error);
        return { data: null, error: result.error };
      }

      const ride = result.data;
      console.log('✅ Ride cancelled via edge function:', ride.id);

      // Send cancellation notifications (non-blocking)
      try {
        await notificationService.sendRideCancelled(userId, ride);
        console.log('✅ Cancellation notification sent to customer');
      } catch (notificationError) {
        console.warn('⚠️ Cancellation notification failed (non-blocking):', notificationError);
      }

      return { data: ride, error: null };
    } catch (error) {
      console.error('Ride cancellation failed:', error);
      return { data: null, error };
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private generateRideCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const rideService = new RideService();