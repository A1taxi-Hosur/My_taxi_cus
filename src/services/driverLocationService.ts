import { supabaseAdmin } from '../utils/supabase';

export interface AvailableDriver {
  driver_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  vehicle_type: string;
  rating: number;
  updated_at: string;
  distance?: number;
}

class DriverLocationService {
  private driversCache: AvailableDriver[] = [];
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 10 * 1000; // 10 seconds for live data
  private pollingInterval: NodeJS.Timeout | null = null;

  // Fetch available drivers using edge function (now that env vars are correct)
  async getAvailableDrivers(
    customerLat: number,
    customerLng: number,
    radius: number = 100, // Increased radius to 100km to find drivers
    vehicleType?: string
  ): Promise<AvailableDriver[]> {
    try {
      console.log('🗺️ [DRIVER-SERVICE] Fetching available drivers via edge function:', {
        location: { lat: customerLat, lng: customerLng },
        radius: radius + 'km',
        vehicleType: vehicleType || 'all',
        timestamp: new Date().toISOString()
      });

      // Try edge function first, fallback to direct database access
      try {
        return await this.getAvailableDriversViaEdgeFunction(customerLat, customerLng, radius, vehicleType);
      } catch (edgeError) {
        console.warn('⚠️ [DRIVER-SERVICE] Edge function failed, using direct database access:', edgeError.message);
        return await this.getAvailableDriversDirectly(customerLat, customerLng, radius, vehicleType);
      }
    } catch (error) {
      console.error('❌ [DRIVER-SERVICE] Error fetching available drivers:', error);
      return [];
    }
  }

  // Use edge function to get drivers (bypasses RLS with service role)
  private async getAvailableDriversViaEdgeFunction(
    customerLat: number,
    customerLng: number,
    radius: number = 10,
    vehicleType?: string
  ): Promise<AvailableDriver[]> {
    try {
      // Get Supabase URL and key from environment variables
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      // Validate environment variables
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables not configured');
      }
      
      // Check for placeholder values
      if (supabaseUrl.includes('placeholder') || 
          supabaseAnonKey.includes('placeholder') ||
          supabaseAnonKey.includes('YourActualAnonKeyHere')) {
        throw new Error('Supabase environment variables contain placeholder values');
      }
      
      // Validate URL format
      if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
        throw new Error('Invalid Supabase URL format');
      }
      
      const params = new URLSearchParams({
        lat: customerLat.toString(),
        lng: customerLng.toString(),
        radius: radius.toString(),
      });
      
      // Don't filter by vehicle type - show all available drivers
      
      const url = `${supabaseUrl}/functions/v1/get-drivers-with-locations?${params.toString()}`;
      
      console.log('🌐 [DRIVER-SERVICE] Constructed Edge Function URL:', url);
      
      // Add timeout and better error handling for fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          signal: controller.signal,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout - edge function took too long to respond');
        }
        if (fetchError.message && fetchError.message.includes('Failed to fetch')) {
          throw new Error('Network connectivity issue - edge function unreachable');
        }
        throw new Error(`Network error: ${fetchError.message || 'Unknown network error'}`);
      }
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          errorText = await response.text();
          if (!errorText || errorText.trim() === '') {
            errorText = `HTTP ${response.status} ${response.statusText}`;
          }
        } catch (textError) {
          errorText = `HTTP ${response.status} ${response.statusText}`;
        }
        throw new Error(`Edge function failed: ${response.status} - ${errorText}`);
      }

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        throw new Error('Edge function returned invalid JSON response');
      }

      if (!result.success) {
        throw new Error(`Edge function error: ${result.error || 'Unknown edge function error'}`);
      }

      const drivers = result.drivers || [];

      // Convert response format to match AvailableDriver interface
      const convertedDrivers: AvailableDriver[] = drivers.map((driver: any) => {
        return {
          driver_id: driver.driver_id || driver.id,
          user_id: driver.user_id,
          latitude: driver.latitude,
          longitude: driver.longitude,
          heading: driver.heading,
          vehicle_type: driver.vehicle_type || 'sedan',
          rating: driver.rating,
          updated_at: driver.location_updated_at,
          distance: typeof driver.distance === 'number' ? driver.distance : undefined,
        };
      });

      // Update cache
      this.driversCache = convertedDrivers;
      this.cacheTimestamp = Date.now();

      return convertedDrivers;
    } catch (error) {
      throw error;
    }
  }

  // Direct database access as fallback (bypasses edge function issues)
  private async getAvailableDriversDirectly(
    customerLat: number,
    customerLng: number,
    radius: number = 10, // Keep 10km as requested
    vehicleType?: string
  ): Promise<AvailableDriver[]> {
    try {
      console.log('🔍 [DRIVER-SERVICE] ===== USING DIRECT DATABASE ACCESS =====');
      console.log('🔍 [DRIVER-SERVICE] Parameters:', {
        customerLocation: { lat: customerLat, lng: customerLng },
        radius: radius + 'km',
        vehicleType: vehicleType || 'all'
      });
      
      // Import supabaseAdmin for direct access
      const { supabaseAdmin } = await import('../utils/supabase');
      
      // Step 1: Get all online and verified drivers
      console.log('📊 [DRIVER-SERVICE] Step 1: Fetching online verified drivers...');
      const { data: drivers, error: driversError } = await supabaseAdmin
        .from('drivers')
        .select(`
          id,
          user_id,
          rating,
          status,
          is_verified,
          users!drivers_user_id_fkey (
            full_name,
            phone_number
          ),
          vehicles!fk_drivers_vehicle (
            id,
            vehicle_type,
            make,
            model,
            color,
            registration_number
          )
        `)
        .eq('status', 'online')
        .eq('is_verified', true)
        .not('vehicles', 'is', null);

      if (driversError) {
        console.error('❌ [DRIVER-SERVICE] Error fetching drivers:', driversError);
        return [];
      }

      console.log('📊 [DRIVER-SERVICE] Found drivers:', {
        total: drivers?.length || 0,
        details: drivers?.map(d => ({
          id: d.id,
          user_id: d.user_id,
          name: d.users?.full_name,
          vehicle_type: d.vehicles?.vehicle_type,
          status: d.status,
          verified: d.is_verified
        }))
      });

      if (!drivers || drivers.length === 0) {
        console.log('⚠️ [DRIVER-SERVICE] No online verified drivers found');
        return [];
      }

      // Step 2: Get live locations for these drivers
      const driverUserIds = drivers.map(d => d.user_id);
      console.log('📍 [DRIVER-SERVICE] Step 2: Getting locations for user IDs:', driverUserIds);

      const { data: locations, error: locationsError } = await supabaseAdmin
        .from('live_locations')
        .select('user_id, latitude, longitude, heading, updated_at')
        .in('user_id', driverUserIds)
        .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

      if (locationsError) {
        console.error('❌ [DRIVER-SERVICE] Error fetching locations:', locationsError);
        return [];
      }

      console.log('📍 [DRIVER-SERVICE] Found locations:', {
        total: locations?.length || 0,
        details: locations?.map(loc => ({
          user_id: loc.user_id,
          coordinates: { lat: loc.latitude, lng: loc.longitude },
          updated_at: loc.updated_at,
          age_minutes: Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000 / 60)
        }))
      });

      // Step 3: Combine and filter drivers
      console.log('🔍 [DRIVER-SERVICE] Step 3: Processing drivers with distance calculation...');
      console.log('🔍 [DRIVER-SERVICE] Customer coordinates for distance calc:', {
        lat: customerLat,
        lng: customerLng,
        type: typeof customerLat,
        isValid: !isNaN(customerLat) && !isNaN(customerLng)
      });
      
      const availableDrivers: AvailableDriver[] = [];
        for (const driver of drivers) {
          const location = locations.find(loc => loc.user_id === driver.user_id);
          
          if (!location) {
            console.log(`❌ [DRIVER-SERVICE] Driver ${driver.id} (${driver.users?.full_name}) skipped: no recent location`);
            continue;
          }

          // Show all vehicle types - no filtering
          console.log(`🚗 [DRIVER-SERVICE] Driver ${driver.id} (${driver.users?.full_name}) vehicle type: ${driver.vehicles?.vehicle_type}`);

          // Parse coordinates carefully
          const distance = this.calculateDistance(
            customerLat,
            customerLng,
            parseFloat(location.latitude.toString()),
            parseFloat(location.longitude.toString())
          );

          console.log(`📏 [DRIVER-SERVICE] Distance for driver ${driver.id} (${driver.users?.full_name}):`, {
            distance_km: distance.toFixed(4),
            within_radius: distance <= radius,
            radius_limit: radius + 'km',
            driver_coords: { lat: parseFloat(location.latitude.toString()), lng: parseFloat(location.longitude.toString()) },
            customer_coords: { lat: customerLat, lng: customerLng }
          });

          // Filter by radius
          if (distance <= radius) {
            console.log(`✅ [DRIVER-SERVICE] Driver ${driver.id} (${driver.users?.full_name}) INCLUDED: ${distance.toFixed(4)}km`);
            availableDrivers.push({
              driver_id: driver.id,
              user_id: driver.user_id,
              latitude: parseFloat(location.latitude.toString()),
              longitude: parseFloat(location.longitude.toString()),
              heading: location.heading ? parseFloat(location.heading.toString()) : null,
              vehicle_type: driver.vehicles?.vehicle_type || 'sedan',
              rating: driver.rating || 5.0,
              updated_at: location.updated_at,
              distance: distance,
            });
          } else {
            console.log(`❌ [DRIVER-SERVICE] Driver ${driver.id} (${driver.users?.full_name}) EXCLUDED: ${distance.toFixed(4)}km > ${radius}km`);
          }
        }

      console.log('📊 [DRIVER-SERVICE] ===== DIRECT DATABASE ACCESS RESULT =====');
      console.log('📊 [DRIVER-SERVICE] Final summary:', {
        total_drivers_processed: drivers.length,
        available_drivers_found: availableDrivers.length,
        customer_location: { lat: customerLat, lng: customerLng },
        radius_km: radius,
        vehicle_type_filter: 'all (no filter applied)'
      });
      
      // Update cache
      this.driversCache = availableDrivers;
      this.cacheTimestamp = Date.now();

      return availableDrivers;
    } catch (error) {
      console.error('❌ [DRIVER-SERVICE] Direct database access failed:', error);
      console.error('❌ [DRIVER-SERVICE] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return [];
    }
  }

  // Start polling for driver locations
  startPolling(
    customerLat: number,
    customerLng: number,
    onUpdate: (drivers: AvailableDriver[]) => void,
    vehicleType?: string,
    interval: number = 15000 // 15 seconds
  ) {
    console.log('🔄 [DRIVER-SERVICE] Starting driver location polling every', interval / 1000, 'seconds');
    console.log('🔄 [DRIVER-SERVICE] Polling parameters:', {
      customerLocation: { lat: customerLat, lng: customerLng },
      vehicleType: vehicleType || 'all',
      interval: interval + 'ms'
    });
    
    // Clear existing polling
    this.stopPolling();

    // Initial fetch
    this.getAvailableDrivers(customerLat, customerLng, 10, vehicleType)
      .then(drivers => {
        console.log('🔄 [DRIVER-SERVICE] Initial fetch completed:', drivers.length, 'drivers');
        onUpdate(drivers);
      })
      .catch(error => {
        console.error('❌ [DRIVER-SERVICE] Initial fetch failed:', error);
        onUpdate([]);
      });

    // Set up polling
    this.pollingInterval = setInterval(async () => {
      try {
        console.log('🔄 [DRIVER-SERVICE] Polling interval triggered');
        const drivers = await this.getAvailableDrivers(customerLat, customerLng, 10, vehicleType);
        console.log('🔄 [DRIVER-SERVICE] Polling update:', drivers.length, 'drivers');
        onUpdate(drivers);
      } catch (error) {
        console.error('❌ [DRIVER-SERVICE] Error in driver polling:', error);
        onUpdate([]);
      }
    }, interval);
  }

  // Stop polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('🛑 [DRIVER-SERVICE] Stopped driver location polling');
    }
  }

  // Get cached drivers (for immediate display)
  getCachedDrivers(): AvailableDriver[] {
    // Return cached data if it's recent
    if (Date.now() - this.cacheTimestamp < this.CACHE_DURATION) {
      return this.driversCache;
    }
    return [];
  }

  // Calculate distance between two points
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Ensure all inputs are properly converted to numbers
    const latitude1 = Number(lat1);
    const longitude1 = Number(lon1);
    const latitude2 = Number(lat2);
    const longitude2 = Number(lon2);
    
    console.log('📐 [DISTANCE-SERVICE] ===== DISTANCE CALCULATION DEBUG =====');
    console.log('📐 [DISTANCE-SERVICE] Raw inputs:', { lat1, lon1, lat2, lon2 });
    console.log('📐 [DISTANCE-SERVICE] Converted inputs:', { 
      latitude1, longitude1, latitude2, longitude2 
    });
    
    // Validate coordinates
    if (isNaN(latitude1) || isNaN(longitude1) || isNaN(latitude2) || isNaN(longitude2)) {
      console.error('❌ [DISTANCE-SERVICE] Invalid coordinates after conversion:', { 
        latitude1, longitude1, latitude2, longitude2 
      });
      return 999;
    }
    
    // Check if coordinates are very close (same location)
    const latDiff = Math.abs(latitude1 - latitude2);
    const lngDiff = Math.abs(longitude1 - longitude2);
    
    console.log('📐 [DISTANCE-SERVICE] Coordinate differences:', {
      lat_diff: latDiff,
      lng_diff: lngDiff,
      very_close: latDiff < 0.001 && lngDiff < 0.001,
      essentially_same: latDiff < 0.0001 && lngDiff < 0.0001
    });
    
    if (latDiff < 0.0001 && lngDiff < 0.0001) {
      console.log('📐 [DISTANCE-SERVICE] Coordinates are essentially the same, returning 0km');
      return 0;
    }
    
    // Haversine formula with proper coordinate conversion
    const R = 6371; // Earth's radius in km
    const dLat = (latitude2 - latitude1) * Math.PI / 180;
    const dLon = (longitude2 - longitude1) * Math.PI / 180;
    
    console.log('📐 [DISTANCE-SERVICE] Haversine intermediate values:', {
      R,
      dLat_radians: dLat,
      dLon_radians: dLon,
      dLat_degrees: latitude2 - latitude1,
      dLon_degrees: longitude2 - longitude1
    });
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(latitude1 * Math.PI / 180) * Math.cos(latitude2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    console.log('📐 [DISTANCE-SERVICE] Final calculation result:', {
      a_value: a,
      c_value: c,
      distance_km: distance.toFixed(6),
      distance_meters: (distance * 1000).toFixed(2),
      seems_reasonable: distance >= 0 && distance < 20000,
      coordinates_used: {
        customer: { lat: latitude1, lng: longitude1 },
        driver: { lat: latitude2, lng: longitude2 }
      }
    });
    
    // Additional validation - if distance seems wrong, log more details
    if (distance > 50 && latDiff < 1 && lngDiff < 1) {
      console.error('🚨 [DISTANCE-SERVICE] SUSPICIOUS DISTANCE CALCULATION:', {
        calculated_distance: distance + 'km',
        coordinate_differences: { lat_diff: latDiff, lng_diff: lngDiff },
        raw_inputs: { lat1, lon1, lat2, lon2 },
        converted_inputs: { latitude1, longitude1, latitude2, longitude2 },
        possible_issue: 'Coordinates might be in wrong format or calculation error'
      });
    }
    
    return distance;
  }
}

export const driverLocationService = new DriverLocationService();