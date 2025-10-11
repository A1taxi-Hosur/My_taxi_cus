import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  accuracy: number;
  timestamp: string;
}

export interface UseDriverLocationTrackingResult {
  driverLocation: DriverLocation | null;
  isTracking: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

export function useDriverLocationTracking(
  rideId: string | null,
  driverId: string | null
): UseDriverLocationTrackingResult {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const previousLocationRef = useRef<DriverLocation | null>(null);

  useEffect(() => {
    if (!rideId || !driverId) {
      console.log('🔴 [GPS-TRACKING] Not tracking: missing rideId or driverId');
      setIsTracking(false);
      return;
    }

    console.log('🟢 [GPS-TRACKING] Starting real-time GPS tracking:', {
      rideId,
      driverId,
      timestamp: new Date().toISOString()
    });

    setIsTracking(true);
    setError(null);

    const fetchInitialLocation = async () => {
      try {
        console.log('📍 [GPS-TRACKING] Fetching initial driver location...');

        const { data, error: fetchError } = await supabase
          .from('driver_locations')
          .select('*')
          .eq('driver_id', driverId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error('❌ [GPS-TRACKING] Error fetching initial location:', fetchError);
          setError(fetchError.message);
          return;
        }

        if (data) {
          const location: DriverLocation = {
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
            heading: parseFloat(data.heading) || 0,
            speed: parseFloat(data.speed) || 0,
            accuracy: parseFloat(data.accuracy) || 0,
            timestamp: data.updated_at,
          };

          console.log('✅ [GPS-TRACKING] Initial location fetched:', location);
          setDriverLocation(location);
          previousLocationRef.current = location;
          setLastUpdate(new Date());
        } else {
          console.warn('⚠️ [GPS-TRACKING] No initial location found for driver');
        }
      } catch (err) {
        console.error('❌ [GPS-TRACKING] Exception fetching initial location:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch location');
      }
    };

    fetchInitialLocation();

    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          console.log('🚗 [GPS-TRACKING] Real-time location update received:', {
            driver: driverId,
            event: payload.eventType,
            latitude: payload.new?.latitude,
            longitude: payload.new?.longitude,
            heading: payload.new?.heading,
            speed: payload.new?.speed,
            timestamp: new Date().toISOString()
          });

          const newData = payload.new as any;
          const newLocation: DriverLocation = {
            latitude: parseFloat(newData.latitude),
            longitude: parseFloat(newData.longitude),
            heading: parseFloat(newData.heading) || 0,
            speed: parseFloat(newData.speed) || 0,
            accuracy: parseFloat(newData.accuracy) || 0,
            timestamp: newData.updated_at,
          };

          if (previousLocationRef.current && !newData.heading) {
            const calculatedHeading = calculateHeading(
              previousLocationRef.current.latitude,
              previousLocationRef.current.longitude,
              newLocation.latitude,
              newLocation.longitude
            );
            newLocation.heading = calculatedHeading;
            console.log('🧭 [GPS-TRACKING] Calculated heading:', calculatedHeading);
          }

          setDriverLocation(newLocation);
          previousLocationRef.current = newLocation;
          setLastUpdate(new Date());
          setError(null);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          console.log('🆕 [GPS-TRACKING] New location record inserted:', payload.new);

          const newData = payload.new as any;
          const newLocation: DriverLocation = {
            latitude: parseFloat(newData.latitude),
            longitude: parseFloat(newData.longitude),
            heading: parseFloat(newData.heading) || 0,
            speed: parseFloat(newData.speed) || 0,
            accuracy: parseFloat(newData.accuracy) || 0,
            timestamp: newData.updated_at,
          };

          setDriverLocation(newLocation);
          previousLocationRef.current = newLocation;
          setLastUpdate(new Date());
        }
      )
      .subscribe((status) => {
        console.log('📡 [GPS-TRACKING] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('✅ [GPS-TRACKING] Successfully subscribed to driver location updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [GPS-TRACKING] Channel error occurred');
          setError('Failed to connect to real-time updates');
          setIsTracking(false);
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [GPS-TRACKING] Subscription timed out');
          setError('Connection timed out');
          setIsTracking(false);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('🔴 [GPS-TRACKING] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsTracking(false);
    };
  }, [rideId, driverId]);

  return {
    driverLocation,
    isTracking,
    error,
    lastUpdate,
  };
}

function calculateHeading(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLon);
  const heading = Math.atan2(y, x);
  return ((heading * 180) / Math.PI + 360) % 360;
}
