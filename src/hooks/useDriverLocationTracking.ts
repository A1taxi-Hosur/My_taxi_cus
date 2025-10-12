import { useState, useEffect } from 'react';

export function useDriverLocationTracking(rideId: string | null, driverId: string | null) {
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return { driverLocation, isTracking, error };
}
