const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const customerLat = parseFloat(url.searchParams.get('lat') || '0');
    const customerLng = parseFloat(url.searchParams.get('lng') || '0');
    const radius = parseFloat(url.searchParams.get('radius') || '10');
    const vehicleType = url.searchParams.get('vehicle_type');

    console.log('🗺️ [GET-DRIVERS-LOCATIONS] ===== STARTING DRIVER FETCH =====');
    console.log('🗺️ [GET-DRIVERS-LOCATIONS] Request parameters:', {
      customerLocation: { lat: customerLat, lng: customerLng },
      radius: radius + 'km',
      vehicleType: vehicleType || 'all',
      timestamp: new Date().toISOString()
    });

    if (!customerLat || !customerLng) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Customer latitude and longitude are required',
          drivers: []
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Get all online verified drivers with their vehicles
    console.log('📊 [GET-DRIVERS-LOCATIONS] Step 1: Fetching online verified drivers...');
    const { data: drivers, error: driversError } = await supabase
      .from('drivers')
      .select(`
        id,
        user_id,
        rating,
        total_rides,
        status,
        is_verified,
        users!drivers_user_id_fkey (
          full_name,
          phone_number
        ),
        vehicles!fk_drivers_vehicle (
          vehicle_type,
          make,
          model,
          color,
          registration_number
        )
      `)
      .eq('status', 'online')
      .eq('is_verified', true)
      .not('vehicle_id', 'is', null)
      .limit(50); // Limit to 50 drivers to improve performance

    if (driversError) {
      console.error('❌ [GET-DRIVERS-LOCATIONS] Database error fetching drivers:', driversError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database error: ' + driversError.message,
          drivers: []
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('📊 [GET-DRIVERS-LOCATIONS] Found drivers:', {
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
      console.log('⚠️ [GET-DRIVERS-LOCATIONS] No online verified drivers found');
      return new Response(
        JSON.stringify({
          success: true,
          drivers: [],
          total_found: 0,
          message: 'No online verified drivers found'
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Step 2: Get live locations for these drivers
    const driverUserIds = drivers.map(d => d.user_id);
    console.log('📍 [GET-DRIVERS-LOCATIONS] Step 2: Getting locations for user IDs:', driverUserIds);

    const { data: locations, error: locationsError } = await supabase
      .from('live_locations')
      .select('user_id, latitude, longitude, heading, speed, accuracy, updated_at')
      .in('user_id', driverUserIds)
      .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('updated_at', { ascending: false })
      .limit(50); // Limit results to prevent excessive data processing

    if (locationsError) {
      console.error('❌ [GET-DRIVERS-LOCATIONS] Error fetching locations:', locationsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Location fetch error: ' + locationsError.message,
          drivers: []
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('📍 [GET-DRIVERS-LOCATIONS] Found locations:', {
      total: locations?.length || 0,
      details: locations?.map(loc => ({
        user_id: loc.user_id,
        coordinates: { lat: loc.latitude, lng: loc.longitude },
        raw_coordinates: { lat: loc.latitude, lng: loc.longitude },
        updated_at: loc.updated_at,
        age_minutes: Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000 / 60)
      }))
    });

    // Debug: Check if we have the specific user_id from the screenshot
    const targetUserId = 'cb735787-e96d-4d1d-9975-c112e756fabd';
    const targetLocation = locations?.find(loc => loc.user_id === targetUserId);
    console.log('🔍 [GET-DRIVERS-LOCATIONS] ===== DEBUGGING SPECIFIC USER =====');
    console.log('🔍 [GET-DRIVERS-LOCATIONS] Looking for user_id from screenshot:', targetUserId);
    console.log('🔍 [GET-DRIVERS-LOCATIONS] Found in locations?', !!targetLocation);
    if (targetLocation) {
      console.log('🔍 [GET-DRIVERS-LOCATIONS] Target location details:', {
        user_id: targetLocation.user_id,
        coordinates: { lat: targetLocation.latitude, lng: targetLocation.longitude },
        updated_at: targetLocation.updated_at,
        age_minutes: Math.round((Date.now() - new Date(targetLocation.updated_at).getTime()) / 1000 / 60)
      });
    }
    
    // Debug: Check if this user_id exists in drivers table
    const targetDriver = drivers?.find(d => d.user_id === targetUserId);
    console.log('🔍 [GET-DRIVERS-LOCATIONS] Found in drivers table?', !!targetDriver);
    if (targetDriver) {
      console.log('🔍 [GET-DRIVERS-LOCATIONS] Target driver details:', {
        id: targetDriver.id,
        user_id: targetDriver.user_id,
        name: targetDriver.users?.full_name,
        status: targetDriver.status,
        is_verified: targetDriver.is_verified,
        has_vehicle: !!targetDriver.vehicles,
        vehicle_type: targetDriver.vehicles?.vehicle_type
      });
    }

    // Step 3: Process and filter drivers
    const processedDrivers = [];
    
    console.log('🔍 [GET-DRIVERS-LOCATIONS] Step 3: Processing drivers with distance calculation...');

    for (const driver of drivers) {
      const location = locations?.find(loc => loc.user_id === driver.user_id);
      
      if (!location) {
        continue;
      }

      // Parse coordinates carefully
      const driverLat = parseFloat(location.latitude.toString());
      const driverLng = parseFloat(location.longitude.toString());
      
      // Validate coordinates before calculation
      if (isNaN(driverLat) || isNaN(driverLng) || isNaN(customerLat) || isNaN(customerLng)) {
        continue;
      }

      const distance = calculateDistance(customerLat, customerLng, driverLat, driverLng);
      
      // Filter by radius
      if (distance <= radius) {
        processedDrivers.push({
          driver_id: driver.id,
          user_id: driver.user_id,
          name: driver.users?.full_name || 'Driver',
          phone: driver.users?.phone_number || '',
          rating: driver.rating || 5.0,
          total_rides: driver.total_rides || 0,
          status: driver.status,
          is_verified: driver.is_verified,
          vehicle_type: driver.vehicles?.vehicle_type || 'sedan',
          vehicle_make: driver.vehicles?.make || '',
          vehicle_model: driver.vehicles?.model || '',
          vehicle_color: driver.vehicles?.color || '',
          registration_number: driver.vehicles?.registration_number || '',
          latitude: driverLat,
          longitude: driverLng,
          heading: location.heading ? parseFloat(location.heading.toString()) : null,
          speed: location.speed ? parseFloat(location.speed.toString()) : null,
          accuracy: location.accuracy ? parseFloat(location.accuracy.toString()) : null,
          location_updated_at: location.updated_at,
          distance: distance,
        });
      }
    }

    // Sort by distance
    processedDrivers.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    console.log('📊 [GET-DRIVERS-LOCATIONS] ===== FINAL RESULT =====');
    console.log('📊 [GET-DRIVERS-LOCATIONS] Processing summary:', {
      total_drivers_found: drivers.length,
      drivers_with_locations: locations?.length || 0,
      drivers_within_radius: processedDrivers.length,
      customer_location: { lat: customerLat, lng: customerLng },
      radius_km: radius,
      vehicle_type_filter: vehicleType || 'all',
      final_drivers: processedDrivers.map(d => ({
        id: d.driver_id,
        name: d.name,
        vehicle_type: d.vehicle_type,
        distance: d.distance?.toFixed(4) + 'km',
        coordinates: { lat: d.latitude, lng: d.longitude }
      }))
    });

    return new Response(
      JSON.stringify({
        success: true,
        drivers: processedDrivers,
        total_found: processedDrivers.length,
        customer_location: { lat: customerLat, lng: customerLng },
        radius_km: radius,
        vehicle_type_filter: vehicleType || 'all',
        debug_info: {
          total_drivers_in_db: drivers.length,
          drivers_with_recent_locations: locations?.length || 0,
          drivers_within_radius: processedDrivers.length,
          distance_calculation_samples: processedDrivers.slice(0, 3).map(d => ({
            driver_id: d.driver_id,
            distance: d.distance?.toFixed(4) + 'km',
            coordinates: { lat: d.latitude, lng: d.longitude }
          }))
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ [GET-DRIVERS-LOCATIONS] Exception:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error: ' + error.message,
        drivers: []
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Validate input coordinates
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return 999;
  }
  
  // Check if coordinates are essentially the same (distance should be very small)
  const latDiff = Math.abs(lat1 - lat2);
  const lngDiff = Math.abs(lon1 - lon2);
  
  if (latDiff < 0.0001 && lngDiff < 0.0001) {
    return 0;
  }
  
  // Haversine formula
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // Sanity check - if distance is impossibly large, there might be a coordinate issue
  if (distance > 20000) {
    return 999;
  }
  
  return distance;
}