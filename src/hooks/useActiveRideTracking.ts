import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useDriverLocationTracking, DriverLocation } from './useDriverLocationTracking';

export interface ActiveRide {
  id: string;
  ride_code: string;
  status: string;
  driver_id: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_address: string | null;
  fare_amount: number;
  created_at: string;
  updated_at: string;
}

export interface UseActiveRideTrackingResult {
  activeRide: ActiveRide | null;
  driverLocation: DriverLocation | null;
  isTracking: boolean;
  error: string | null;
  rideStatus: string | null;
  shouldShowMap: boolean;
}

const TRACKABLE_STATUSES = ['accepted', 'driver_arrived', 'in_progress', 'picked_up'];

export function useActiveRideTracking(
  customerId: string | null
): UseActiveRideTrackingResult {
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [rideStatus, setRideStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  const {
    driverLocation,
    isTracking,
    error: trackingError,
  } = useDriverLocationTracking(
    activeRide?.id || null,
    activeRide?.driver_id || null
  );

  const shouldShowMap = Boolean(
    activeRide &&
    activeRide.driver_id &&
    TRACKABLE_STATUSES.includes(activeRide.status) &&
    driverLocation
  );

  useEffect(() => {
    if (!customerId) {
      console.log('🔴 [ACTIVE-RIDE-TRACKING] No customer ID provided');
      return;
    }

    console.log('🟢 [ACTIVE-RIDE-TRACKING] Starting active ride monitoring for customer:', customerId);

    const fetchActiveRide = async () => {
      try {
        console.log('📍 [ACTIVE-RIDE-TRACKING] Fetching active ride...');

        const { data: rides, error: fetchError } = await supabase
          .from('rides')
          .select('*')
          .eq('customer_id', customerId)
          .in('status', ['requested', 'accepted', 'driver_arrived', 'in_progress', 'picked_up'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error('❌ [ACTIVE-RIDE-TRACKING] Error fetching active ride:', fetchError);
          setError(fetchError.message);
          return;
        }

        if (rides) {
          console.log('✅ [ACTIVE-RIDE-TRACKING] Active ride found:', {
            id: rides.id,
            status: rides.status,
            driver_id: rides.driver_id,
            has_driver: Boolean(rides.driver_id),
          });
          setActiveRide(rides);
          setRideStatus(rides.status);
          setError(null);
        } else {
          console.log('⚠️ [ACTIVE-RIDE-TRACKING] No active ride found');
          setActiveRide(null);
          setRideStatus(null);
        }
      } catch (err) {
        console.error('❌ [ACTIVE-RIDE-TRACKING] Exception fetching active ride:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch active ride');
      }
    };

    fetchActiveRide();

    const channel = supabase
      .channel(`active-ride-${customerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          console.log('🚗 [ACTIVE-RIDE-TRACKING] Ride update received:', {
            event: payload.eventType,
            ride_id: payload.new?.id,
            status: payload.new?.status,
            driver_id: payload.new?.driver_id,
          });

          const updatedRide = payload.new as any;

          if (
            updatedRide &&
            ['requested', 'accepted', 'driver_arrived', 'in_progress', 'picked_up'].includes(updatedRide.status)
          ) {
            console.log('✅ [ACTIVE-RIDE-TRACKING] Updating active ride');
            setActiveRide(updatedRide);
            setRideStatus(updatedRide.status);
            setError(null);
          } else if (
            updatedRide &&
            ['completed', 'cancelled'].includes(updatedRide.status)
          ) {
            console.log('🏁 [ACTIVE-RIDE-TRACKING] Ride ended, clearing active ride');
            setActiveRide(null);
            setRideStatus(null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'rides',
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          console.log('🗑️ [ACTIVE-RIDE-TRACKING] Ride deleted, clearing active ride');
          setActiveRide(null);
          setRideStatus(null);
        }
      )
      .subscribe((status) => {
        console.log('📡 [ACTIVE-RIDE-TRACKING] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('✅ [ACTIVE-RIDE-TRACKING] Successfully subscribed to ride updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [ACTIVE-RIDE-TRACKING] Channel error occurred');
          setError('Failed to connect to real-time updates');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [ACTIVE-RIDE-TRACKING] Subscription timed out');
          setError('Connection timed out');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('🔴 [ACTIVE-RIDE-TRACKING] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [customerId]);

  useEffect(() => {
    if (trackingError) {
      setError(trackingError);
    }
  }, [trackingError]);

  return {
    activeRide,
    driverLocation,
    isTracking,
    error,
    rideStatus,
    shouldShowMap,
  };
}
