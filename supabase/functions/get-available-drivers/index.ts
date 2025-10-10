const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface DriverLocation {
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const customerLat = parseFloat(url.searchParams.get('lat') || '12.7402');
    const customerLng = parseFloat(url.searchParams.get('lng') || '77.8240');
    const radius = parseFloat(url.searchParams.get('radius') || '10'); // km
    const vehicleType = url.searchParams.get('vehicle_type') || '';

    console.log('🗺️ [GET-DRIVERS] ===== FETCHING AVAILABLE DRIVERS =====');
    console.log('🗺️ [GET-DRIVERS] Request parameters:', {
      customerLocation: { lat: customerLat, lng: customerLng },
      radius: radius + 'km',
      vehicleType: vehicleType || 'all',
      timestamp: new Date().toISOString()
    });

    // Get environment variables - try multiple sources for local development
    let supabaseUrl = Deno.env.get('SUPABASE_URL');
    let supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔑 [GET-DRIVERS] Environment check:', {
      supabaseUrl: !!supabaseUrl,
      serviceKeyExists: !!supabaseServiceKey,
      keyFormat: supabaseServiceKey?.startsWith('eyJ') ? 'JWT_TOKEN' : 'INVALID_KEY',
      keyPrefix: supabaseServiceKey?.substring(0, 10) + '...'
    });
    
    // Validate environment variables
    if (!supabaseUrl) {
      console.error('❌ [GET-DRIVERS] SUPABASE_URL not found in environment');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SUPABASE_URL environment variable not found',
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

    if (!supabaseServiceKey || !supabaseServiceKey.startsWith('eyJ')) {
      console.error('❌ [GET-DRIVERS] Valid service role key not found in environment');
      console.error('❌ [GET-DRIVERS] Current key format:', supabaseServiceKey?.startsWith('eyJ') ? 'JWT_TOKEN' : 'INVALID');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Service role key not properly configured',
          instructions: 'The edge function needs the service role key in its environment variables',
          expected_format: 'eyJ...',
          current_key_prefix: supabaseServiceKey ? supabaseServiceKey.substring(0, 10) + '...' : 'MISSING',
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

    console.log('✅ [GET-DRIVERS] Environment variables validated successfully');
    console.log('✅ [GET-DRIVERS] Using service key starting with:', supabaseServiceKey?.substring(0, 10) + '...');
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'get-available-drivers-edge-function@1.0.0',
        },
      }
    });

    console.log('✅ [GET-DRIVERS] Supabase client created with service role');

    // Test database connection with service role
    console.log('🧪 [GET-DRIVERS] ===== TESTING DATABASE CONNECTION =====');
    try {
      const { data: testQuery, error: testError } = await supabase
        .from('drivers')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('❌ [GET-DRIVERS] Database connection test failed:', {
          code: testError.code,
          message: testError.message,
          details: testError.details,
          hint: testError.hint
        });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Database connection failed: ' + testError.message,
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
      console.log('✅ [GET-DRIVERS] Database connection test successful');
    } catch (connectionError) {
      console.error('❌ [GET-DRIVERS] Database connection exception:', connectionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database connection exception: ' + connectionError.message,
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

    // Step 1: Get all online and verified drivers
    console.log('🔍 [GET-DRIVERS] ===== STEP 1: FETCHING ALL DRIVERS =====');
    
    const { data: drivers, error: driversError } = await supabase
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
      console.error('❌ [GET-DRIVERS] Error fetching drivers:', {
        code: driversError.code,
        message: driversError.message,
        details: driversError.details,
        hint: driversError.hint
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch drivers: ' + driversError.message,
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

    console.log('📊 [GET-DRIVERS] Drivers query result:', {
      total_drivers: drivers?.length || 0,
      drivers_details: drivers?.map(d => ({
        id: d.id,
        user_id: d.user_id,
        name: d.users?.full_name,
        status: d.status,
        verified: d.is_verified,
        rating: d.rating,
        has_vehicle: !!d.vehicles,
        vehicle_type: d.vehicles?.vehicle_type
      }))
    });

    if (!drivers || drivers.length === 0) {
      console.log('⚠️ [GET-DRIVERS] No online verified drivers with vehicles found');
      
      return new Response(
        JSON.stringify({
          success: true,
          drivers: [],
          total_found: 0,
          message: 'No real drivers online and verified with vehicles',
          customer_location: { lat: customerLat, lng: customerLng },
          radius_km: radius,
          debug_info: {
            total_drivers_in_db: 0,
            verified_drivers: 0,
            drivers_with_vehicles: 0,
            drivers_with_recent_locations: 0
          }
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
    console.log('📍 [GET-DRIVERS] ===== STEP 2: FETCHING LIVE LOCATIONS =====');
    const driverUserIds = drivers.map(d => d.user_id);
    console.log('📍 [GET-DRIVERS] Looking for locations for user IDs:', driverUserIds);

    const { data: locations, error: locationsError } = await supabase
      .from('live_locations')
      .select('user_id, latitude, longitude, heading, updated_at')
      .in('user_id', driverUserIds)
      .gte('updated_at', new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()); // Last 7 hours

    if (locationsError) {
      console.error('❌ [GET-DRIVERS] Error fetching locations:', {
        code: locationsError.code,
        message: locationsError.message,
        details: locationsError.details,
        hint: locationsError.hint
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch driver locations: ' + locationsError.message,
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

    console.log('📍 [GET-DRIVERS] Locations query result:', {
      total_locations: locations?.length || 0,
      locations_details: locations?.map(loc => ({
        user_id: loc.user_id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        age_minutes: Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000 / 60)
      }))
    });

    // Step 3: Combine driver data with locations and filter
    console.log('🔄 [GET-DRIVERS] ===== STEP 3: PROCESSING AND FILTERING DRIVERS =====');
    
    const availableDrivers: DriverLocation[] = [];

    if (drivers && locations) {
      for (const driver of drivers) {
        console.log(`🔍 [GET-DRIVERS] Processing driver ${driver.id}`);
        
        // Find location for this driver
        const location = locations.find(loc => loc.user_id === driver.user_id);
        
        if (!location) {
          console.log(`❌ [GET-DRIVERS] Driver ${driver.id} skipped: no recent location`);
          continue;
        }

        // Filter by vehicle type if specified
        if (vehicleType && driver.vehicles?.vehicle_type !== vehicleType) {
          console.log(`❌ [GET-DRIVERS] Driver ${driver.id} skipped: vehicle type mismatch`);
          continue;
        }

        // Calculate distance from customer
        const distance = calculateDistance(
          customerLat,
          customerLng,
          parseFloat(location.latitude.toString()),
          parseFloat(location.longitude.toString())
        );

        // Filter by radius
        if (distance <= radius) {
          console.log(`✅ [GET-DRIVERS] Driver ${driver.id} included: ${distance.toFixed(2)}km`);
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
          console.log(`❌ [GET-DRIVERS] Driver ${driver.id} skipped: too far (${distance.toFixed(2)}km)`);
        }
      }
    }

    console.log('📊 [GET-DRIVERS] Final result:', {
      total_drivers_processed: drivers?.length || 0,
      available_drivers: availableDrivers.length,
      customer_location: { lat: customerLat, lng: customerLng },
      radius_km: radius
    });

    return new Response(
      JSON.stringify({
        success: true,
        drivers: availableDrivers,
        total_found: availableDrivers.length,
        customer_location: { lat: customerLat, lng: customerLng },
        radius_km: radius,
        vehicle_type_filter: vehicleType || 'all'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ [GET-DRIVERS] Exception:', error);
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
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}