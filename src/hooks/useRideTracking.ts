import { useState, useEffect } from 'react';

export function useRideTracking(rideId: string | null) {
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return { ride, loading, error };
}
