const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/driver-api', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (path === '/notify-drivers' && req.method === 'POST') {
      return await notifyNearbyDrivers(req, supabase);
    }

    if (path === '/update-location' && req.method === 'POST') {
      return await updateDriverLocation(req, supabase);
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Driver API error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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

async function notifyNearbyDrivers(req: Request, supabase: any) {
  const { ride_id, ride_data } = await req.json();
  
  console.log('📢 [DRIVER-API] ===== STARTING DRIVER NOTIFICATION PROCESS =====');
  console.log('📢 [DRIVER-API] Processing driver notifications for ride:', ride_id);
  console.log('📢 [DRIVER-API] Ride data received:', {
    id: ride_data?.id,
    vehicle_type: ride_data?.vehicle_type,
    booking_type: ride_data?.booking_type,
    pickup_address: ride_data?.pickup_address,
    destination_address: ride_data?.destination_address,
    fare_amount: ride_data?.fare_amount,
    status: ride_data?.status
  });
  
  let ride = ride_data;
  
  if (!ride) {
    console.log('📢 [DRIVER-API] No ride data provided, fetching from database...');
    const { data: fetchedRide, error: rideError } = await supabase
      .from('rides')
      .select(`
        id,
        customer_id,
        pickup_latitude,
        pickup_longitude,
        pickup_address,
        destination_latitude,
        destination_longitude,
        destination_address,
        vehicle_type,
        fare_amount,
        booking_type,
        status,
        created_at,
        users!rides_customer_id_fkey (
          full_name,
          phone_number,
          email
        )
      `)
      .eq('id', ride_id)
      .single();

    if (rideError || !fetchedRide) {
      console.error('❌ Error fetching ride for notifications:', rideError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Ride not found',
          ride_id,
          rideError 
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
    ride = fetchedRide;
  } else {
    console.log('📢 [DRIVER-API] Using ride data from client');
    
    if (['rental', 'outstation', 'airport'].includes(ride.booking_type)) {
      console.log('🚫 [DRIVER-API] Special booking type in client data:', ride.booking_type, '- skipping driver notifications');
      return new Response(
        JSON.stringify({ 
          success: true, 
          drivers_notified: 0,
          message: `${ride.booking_type} bookings require admin allocation - not sent to drivers`,
          booking_type: ride.booking_type
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
    
    if (!ride.users) {
      const { data: customer } = await supabase
        .from('users')
        .select('full_name, phone_number, email')
        .eq('id', ride.customer_id)
        .single();
      
      if (customer) {
        ride.users = customer;
      }
    }
  }

  console.log('✅ [DRIVER-API] Found ride for notifications:', {
    id: ride.id,
    pickup: ride.pickup_address,
    destination: ride.destination_address,
    vehicle_type: ride.vehicle_type,
    status: ride.status,
    booking_type: ride.booking_type
  });

  console.log('🔍 [DRIVER-API] ===== FINDING AVAILABLE DRIVERS =====');
  console.log('🔍 [DRIVER-API] Looking for drivers with vehicle type:', ride.vehicle_type);
  console.log('🔍 [DRIVER-API] Required criteria:', {
    status: 'online',
    is_verified: true,
    vehicle_type_needed: ride.vehicle_type,
    must_have_vehicle: true
  });
  
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
        make,
        model,
        vehicle_type,
        color,
        registration_number
      )
    `)
    .eq('status', 'online')
    .eq('is_verified', true)
    .not('vehicles', 'is', null);

  if (driversError) {
    console.error('❌ [DRIVER-API] Database error finding drivers:', driversError);
    console.error('❌ [DRIVER-API] Error details:', JSON.stringify(driversError, null, 2));
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error finding drivers',
        driversError 
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

  console.log('🔍 [DRIVER-API] ===== RAW DRIVER QUERY RESULTS =====');
  console.log(`🔍 [DRIVER-API] Total drivers found in database: ${drivers?.length || 0}`);
  
  if (drivers && drivers.length > 0) {
    console.log('🔍 [DRIVER-API] All drivers details:');
    drivers.forEach((driver, index) => {
      console.log(`🔍 [DRIVER-API] Driver ${index + 1}:`, {
        id: driver.id,
        user_id: driver.user_id,
        name: driver.users?.full_name,
        phone: driver.users?.phone_number,
        status: driver.status,
        is_verified: driver.is_verified,
        rating: driver.rating,
        vehicle_exists: !!driver.vehicles,
        vehicle_type: driver.vehicles?.vehicle_type,
        vehicle_make: driver.vehicles?.make,
        vehicle_model: driver.vehicles?.model,
        vehicle_registration: driver.vehicles?.registration_number,
        vehicle_color: driver.vehicles?.color
      });
    });
  } else {
    console.log('❌ [DRIVER-API] No drivers found in database with criteria:', {
      status: 'online',
      is_verified: true,
      has_vehicle: 'not null'
    });
  }

  console.log('🔍 [DRIVER-API] ===== FILTERING DRIVERS BY VEHICLE TYPE =====');
  console.log('🔍 [DRIVER-API] Requested vehicle type from ride:', ride.vehicle_type);
  console.log('🔍 [DRIVER-API] Vehicle type data type:', typeof ride.vehicle_type);
  console.log('🔍 [DRIVER-API] Vehicle type length:', ride.vehicle_type?.length);
  console.log('🔍 [DRIVER-API] Vehicle type trimmed:', ride.vehicle_type?.trim());

  const getCompatibleVehicleTypes = (requestedType: string) => {
    const normalizedType = requestedType?.trim().toLowerCase();

    console.log('🎯 [DRIVER-API] Normalizing requested type:', {
      original: requestedType,
      normalized: normalizedType
    });

    const compatibilityMap: { [key: string]: string[] } = {
      'hatchback': ['hatchback', 'hatchback_ac'],
      'hatchback_ac': ['hatchback_ac'],
      'sedan': ['sedan', 'sedan_ac'],
      'sedan_ac': ['sedan_ac'],
      'suv': ['suv', 'suv_ac'],
      'suv_ac': ['suv_ac'],
      'auto': ['auto'],
      'bike': ['bike'],
    };

    const compatible = compatibilityMap[normalizedType] || [normalizedType];

    console.log('🎯 [DRIVER-API] Compatibility lookup result:', {
      requested: normalizedType,
      compatible_types: compatible,
      map_contains_key: normalizedType in compatibilityMap
    });

    return compatible;
  };

  const compatibleTypes = getCompatibleVehicleTypes(ride.vehicle_type);
  console.log('✅ [DRIVER-API] Compatible vehicle types determined:', compatibleTypes);
  console.log('🔍 [DRIVER-API] Will filter', drivers?.length || 0, 'drivers to match these types');
  
  const filteredDrivers = drivers?.filter(driver => {
    const hasVehicle = !!driver.vehicles;
    const driverVehicleType = driver.vehicles?.vehicle_type;
    const normalizedDriverVehicleType = driverVehicleType?.trim().toLowerCase();
    const isCompatibleType = compatibleTypes.includes(normalizedDriverVehicleType);

    console.log(`🔍 [DRIVER-API] Evaluating driver ${driver.users?.full_name || driver.id}:`, {
      driver_id: driver.id,
      driver_name: driver.users?.full_name,
      hasVehicle,
      driver_vehicle_type_raw: driverVehicleType,
      driver_vehicle_type_normalized: normalizedDriverVehicleType,
      requested_vehicle_type: ride.vehicle_type,
      compatible_types_list: compatibleTypes,
      is_in_compatible_list: isCompatibleType,
      will_be_notified: hasVehicle && isCompatibleType
    });

    if (!hasVehicle) {
      console.log(`❌ [DRIVER-API] EXCLUDED - Driver ${driver.users?.full_name || driver.id}: No vehicle data`);
      return false;
    }

    if (!isCompatibleType) {
      console.log(`❌ [DRIVER-API] EXCLUDED - Driver ${driver.users?.full_name || driver.id}: Vehicle type "${normalizedDriverVehicleType}" NOT in compatible list [${compatibleTypes.join(', ')}]`);
      console.log(`❌ [DRIVER-API] REASON: Ride requested "${ride.vehicle_type}", driver has "${normalizedDriverVehicleType}" - NOT COMPATIBLE`);
      return false;
    }

    console.log(`✅ [DRIVER-API] INCLUDED - Driver ${driver.users?.full_name || driver.id}: Vehicle type "${normalizedDriverVehicleType}" IS COMPATIBLE with request "${ride.vehicle_type}"`);
    return true;
  }) || [];

  console.log('🔍 [DRIVER-API] ===== FILTERING RESULTS SUMMARY =====');
  console.log(`📊 [DRIVER-API] Final filtering statistics:`, {
    total_drivers_queried: drivers?.length || 0,
    drivers_that_passed_filter: filteredDrivers.length,
    drivers_excluded: (drivers?.length || 0) - filteredDrivers.length,
    requested_vehicle_type: ride.vehicle_type,
    compatible_types_used: compatibleTypes,
    filter_success_rate: drivers?.length ? `${((filteredDrivers.length / drivers.length) * 100).toFixed(1)}%` : '0%'
  });

  console.log(`📊 [DRIVER-API] All drivers vehicle type breakdown:`);
  const vehicleTypeBreakdown = drivers?.reduce((acc: any, d) => {
    const vType = d.vehicles?.vehicle_type?.trim().toLowerCase() || 'unknown';
    acc[vType] = (acc[vType] || 0) + 1;
    return acc;
  }, {});
  console.log(`📊 [DRIVER-API] Vehicle types in database:`, vehicleTypeBreakdown);

  if (filteredDrivers.length > 0) {
    console.log('✅ [DRIVER-API] ===== DRIVERS THAT WILL RECEIVE NOTIFICATION =====');
    filteredDrivers.forEach((driver, index) => {
      console.log(`✅ [DRIVER-API] #${index + 1} - ${driver.users?.full_name}:`, {
        driver_id: driver.id,
        vehicle: `${driver.vehicles?.make} ${driver.vehicles?.model}`,
        vehicle_type: driver.vehicles?.vehicle_type,
        registration: driver.vehicles?.registration_number,
        rating: driver.rating,
        phone: driver.users?.phone_number,
        match_reason: `Vehicle "${driver.vehicles?.vehicle_type}" matches request "${ride.vehicle_type}"`
      });
    });
  } else {
    console.log('❌ [DRIVER-API] ===== NO COMPATIBLE DRIVERS FOUND =====');
    console.log('❌ [DRIVER-API] Vehicle type mismatch details:');
    console.log(`❌ [DRIVER-API] - Requested: "${ride.vehicle_type}"`);
    console.log(`❌ [DRIVER-API] - Compatible types: [${compatibleTypes.join(', ')}]`);
    const availableTypes = [...new Set(drivers?.map(d => d.vehicles?.vehicle_type?.trim().toLowerCase()).filter(Boolean))];
    console.log(`❌ [DRIVER-API] - Available in DB: [${availableTypes.join(', ')}]`);
    console.log(`❌ [DRIVER-API] - None of the available types match the compatible types list`);
  }
  
  if (filteredDrivers.length === 0) {
    console.log('⚠️ [DRIVER-API] ===== NO MATCHING DRIVERS FOUND =====');
    console.log('⚠️ [DRIVER-API] Updating ride status to no_drivers_available');
    console.log('⚠️ [DRIVER-API] Reason: No drivers found with vehicle type:', ride.vehicle_type);
    
    const { error: updateError } = await supabase
      .from('rides')
      .update({ status: 'no_drivers_available' })
      .eq('id', ride_id);

    if (updateError) {
      console.error('❌ [DRIVER-API] Error updating ride status to no_drivers_available:', updateError);
    } else {
      console.log('✅ [DRIVER-API] Successfully updated ride status to no_drivers_available');
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        drivers_notified: 0,
        nearby_drivers: 0,
        message: 'No drivers available with matching vehicle type'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  console.log('📍 [DRIVER-API] ===== GETTING DRIVER LOCATIONS =====');
  console.log('📍 [DRIVER-API] Getting live locations for', filteredDrivers.length, 'drivers...');
  const driverUserIds = filteredDrivers.map(d => d.user_id);
  console.log('📍 [DRIVER-API] Driver user IDs to check:', driverUserIds);
  
  const { data: locations, error: locationsError } = await supabase
    .from('live_locations')
    .select('user_id, latitude, longitude, updated_at')
    .in('user_id', driverUserIds)
    .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

  if (locationsError) {
    console.error('❌ [DRIVER-API] Error fetching driver locations:', locationsError);
    console.log('⚠️ [DRIVER-API] Continuing without location data - will notify all matching drivers');
  } else {
    console.log('📍 [DRIVER-API] Location query results:', {
      total_locations_found: locations?.length || 0,
      locations_details: locations?.map(loc => ({
        user_id: loc.user_id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        updated_at: loc.updated_at,
        age_minutes: Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000 / 60)
      }))
    });
  }

  console.log(`📍 [DRIVER-API] Found ${locations?.length || 0} recent driver locations (within 5 minutes)`);

  console.log('📢 [DRIVER-API] ===== CREATING DRIVER NOTIFICATIONS =====');
  console.log('📢 [DRIVER-API] Creating notifications for', filteredDrivers.length, 'matching drivers...');
  
  const notifications = filteredDrivers.map(driver => {
    const location = locations?.find(loc => loc.user_id === driver.user_id);
    let distance = 5;
    
    if (location) {
      distance = calculateDistance(
        ride.pickup_latitude,
        ride.pickup_longitude,
        parseFloat(location.latitude.toString()),
        parseFloat(location.longitude.toString())
      );
    }
    
    const eta = Math.max(2, Math.round(distance * 3));
    
    return {
      user_id: driver.user_id,
      type: 'ride_request',
      title: 'New Ride Request',
      message: `Pickup: ${ride.pickup_address}${distance ? ` • ${distance.toFixed(1)}km away` : ''}`,
      data: {
        rideId: ride.id,
        pickupLocation: ride.pickup_address,
        destinationLocation: ride.destination_address,
        fareAmount: ride.fare_amount,
        vehicleType: ride.vehicle_type,
        distance: distance,
        eta: eta,
        pickupCoords: {
          latitude: ride.pickup_latitude,
          longitude: ride.pickup_longitude,
        },
        destinationCoords: ride.destination_latitude ? {
          latitude: ride.destination_latitude,
          longitude: ride.destination_longitude,
        } : null,
      },
      status: 'unread',
    };
  });

  const { data: insertedNotifications, error: notificationsError } = await supabase
    .from('notifications')
    .insert(notifications)
    .select();

  if (notificationsError) {
    console.error('❌ [DRIVER-API] Error creating notifications:', notificationsError);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error creating notifications',
        notificationsError 
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

  console.log(`✅ [DRIVER-API] Successfully created ${insertedNotifications?.length || 0} notifications`);
  console.log('📢 [DRIVER-API] ===== NOTIFICATION PROCESS COMPLETE =====');

  return new Response(
    JSON.stringify({ 
      success: true, 
      drivers_notified: filteredDrivers.length,
      nearby_drivers: filteredDrivers.length,
      notifications_created: insertedNotifications?.length || 0
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function updateDriverLocation(req: Request, supabase: any) {
  const { driverId, latitude, longitude, heading, speed, accuracy } = await req.json();

  console.log('📍 [DRIVER-LOCATION] Updating driver location:', {
    driverId,
    latitude,
    longitude,
    heading,
    speed,
    accuracy,
  });

  if (!driverId || !latitude || !longitude) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Missing required fields: driverId, latitude, longitude',
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

  const { data, error } = await supabase
    .from('driver_locations')
    .upsert({
      driver_id: driverId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      heading: heading ? parseFloat(heading) : 0,
      speed: speed ? parseFloat(speed) : 0,
      accuracy: accuracy ? parseFloat(accuracy) : 0,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'driver_id'
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('❌ [DRIVER-LOCATION] Error updating location:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
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

  console.log('✅ [DRIVER-LOCATION] Location updated successfully');

  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}
