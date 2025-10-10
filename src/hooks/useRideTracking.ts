import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realtimeService } from '../services/realtimeService';
import { customerLocationService } from '../services/customerLocationService';
import { etaService } from '../services/etaService';
import { notificationService } from '../services/notificationService';

export function useRideTracking(rideId: string | null) {
  const { user } = useAuth();
  const [ride, setRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [customerLocation, setCustomerLocation] = useState<any>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [isLocationSharing, setIsLocationSharing] = useState(false);

  useEffect(() => {
    if (rideId && user) {
      // Subscribe to ride updates
      const rideSubscription = realtimeService.subscribeToRide(rideId, (updatedRide) => {
        setRide(updatedRide);
        
        // Handle ride status changes
        handleRideStatusChange(updatedRide);
      });

      return () => {
        rideSubscription.unsubscribe();
        stopLocationSharing();
      };
    }
  }, [rideId, user]);

  useEffect(() => {
    if (ride && ride.driver_id && ride.drivers?.user_id) {
      // Subscribe to driver location updates
      const driverLocationSubscription = realtimeService.subscribeToDriverLocation(
        ride.drivers.user_id,
        (location) => {
          setDriverLocation(location);
          calculateETA(location);
        }
      );

      return () => {
        driverLocationSubscription.unsubscribe();
      };
    }
  }, [ride]);

  const handleRideStatusChange = (updatedRide: any) => {
    const shouldShareLocation = ['accepted', 'driver_arrived', 'in_progress'].includes(updatedRide.status);
    
    if (shouldShareLocation && !isLocationSharing) {
      startLocationSharing();
    } else if (!shouldShareLocation && isLocationSharing) {
      stopLocationSharing();
    }

    // Send notifications based on status
    switch (updatedRide.status) {
      case 'accepted':
        notificationService.sendRideAccepted(user!.id, updatedRide);
        break;
      case 'driver_arrived':
        notificationService.sendDriverArrived(user!.id, updatedRide);
        break;
      case 'in_progress':
        notificationService.sendTripStarted(user!.id, updatedRide);
        break;
      case 'completed':
        notificationService.sendTripCompleted(user!.id, updatedRide);
        stopLocationSharing();
        break;
      case 'cancelled':
        notificationService.sendRideCancelled(user!.id, updatedRide);
        stopLocationSharing();
        break;
    }
  };

  const startLocationSharing = async () => {
    if (!user || !rideId) return;

    const success = await customerLocationService.startSharingLocation(user.id, rideId);
    setIsLocationSharing(success);
  };

  const stopLocationSharing = () => {
    customerLocationService.stopSharingLocation();
    setIsLocationSharing(false);
  };

  const calculateETA = (driverLoc: any) => {
    if (!ride || !driverLoc) return;

    let etaMinutes: number;

    if (ride.status === 'accepted' || ride.status === 'driver_arrived') {
      // ETA to pickup location
      etaMinutes = etaService.calculateDriverToPickupETA(
        { latitude: driverLoc.latitude, longitude: driverLoc.longitude },
        { latitude: ride.pickup_latitude, longitude: ride.pickup_longitude }
      );
    } else if (ride.status === 'in_progress' && ride.destination_latitude) {
      // ETA to destination
      etaMinutes = etaService.calculateTripETA(
        { latitude: driverLoc.latitude, longitude: driverLoc.longitude },
        { latitude: ride.destination_latitude, longitude: ride.destination_longitude }
      );
    } else {
      return;
    }

    // Apply traffic adjustments
    const adjustedETA = etaService.getTrafficAdjustedETA(etaMinutes);
    setEta(adjustedETA);
  };

  return {
    ride,
    driverLocation,
    customerLocation,
    eta: eta ? etaService.formatETA(eta) : null,
    etaMinutes: eta,
    isLocationSharing,
    startLocationSharing,
    stopLocationSharing,
  };
}