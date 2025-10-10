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
  
  // Use ride data passed from client or fetch from database
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
    
    // Double-check booking type even with client data
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
    
    // Get customer info if not provided
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

  // Find online drivers with matching vehicle type
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

  // Filter drivers by vehicle type
  console.log('🔍 [DRIVER-API] ===== FILTERING DRIVERS BY VEHICLE TYPE =====');
  console.log('🔍 [DRIVER-API] Required vehicle type:', ride.vehicle_type);
  
  // Define compatible vehicle types
  const getCompatibleVehicleTypes = (requestedType) => {
    const compatibilityMap = {
      'hatchback': ['hatchback', 'hatchback_ac'], // Hatchback requests go to both hatchback and hatchback_ac
      'hatchback_ac': ['hatchback_ac'], // Hatchback AC requests only go to hatchback_ac
      'sedan': ['sedan', 'sedan_ac'], // Sedan requests go to both sedan and sedan_ac  
      'sedan_ac': ['sedan_ac'], // Sedan AC requests only go to sedan_ac
      'suv': ['suv', 'suv_ac'], // SUV requests go to both suv and suv_ac
      'suv_ac': ['suv_ac'], // SUV AC requests only go to suv_ac
    };
    
    return compatibilityMap[requestedType] || [requestedType];
  };
  
  const compatibleTypes = getCompatibleVehicleTypes(ride.vehicle_type);
  console.log('🔍 [DRIVER-API] Compatible vehicle types for', ride.vehicle_type, ':', compatibleTypes);
  
  const filteredDrivers = drivers?.filter(driver => {
    const hasVehicle = !!driver.vehicles;
    const vehicleType = driver.vehicles?.vehicle_type;
    const isCompatibleType = compatibleTypes.includes(vehicleType);
    
    console.log(`🔍 [DRIVER-API] Checking driver ${driver.users?.full_name || driver.id}:`, {
      hasVehicle,
      vehicleType,
      requiredType: ride.vehicle_type,
      compatibleTypes,
      isCompatibleType,
      willInclude: hasVehicle && isCompatibleType
    });
    
    if (!hasVehicle) {
      console.log(`❌ [DRIVER-API] Driver ${driver.users?.full_name || driver.id} excluded: No vehicle data`);
      return false;
    }
    
    if (!isCompatibleType) {
      console.log(`❌ [DRIVER-API] Driver ${driver.users?.full_name || driver.id} excluded: Vehicle type not compatible (${vehicleType} not in [${compatibleTypes.join(', ')}])`);
      return false;
    }
    
    console.log(`✅ [DRIVER-API] Driver ${driver.users?.full_name || driver.id} included: Compatible vehicle type (${vehicleType})`);
    return true;
  }) || [];

  console.log('🔍 [DRIVER-API] ===== FILTERING RESULTS =====');
  console.log(`📊 [DRIVER-API] Filtering summary:`, {
    total_drivers_found: drivers?.length || 0,
    drivers_with_compatible_vehicle: filteredDrivers.length,
    required_vehicle_type: ride.vehicle_type,
    compatible_vehicle_types: compatibleTypes,
    filter_success_rate: drivers?.length ? `${((filteredDrivers.length / drivers.length) * 100).toFixed(1)}%` : '0%'
  });
  
  if (filteredDrivers.length > 0) {
    console.log('✅ [DRIVER-API] Drivers with compatible vehicles:');
    filteredDrivers.forEach((driver, index) => {
      console.log(`✅ [DRIVER-API] Compatible Driver ${index + 1}:`, {
        name: driver.users?.full_name,
        vehicle: `${driver.vehicles?.make} ${driver.vehicles?.model}`,
        vehicle_type: driver.vehicles?.vehicle_type,
        requested_type: ride.vehicle_type,
        compatibility: `${driver.vehicles?.vehicle_type} is compatible with ${ride.vehicle_type}`,
        registration: driver.vehicles?.registration_number,
        rating: driver.rating,
      });
    });
  } else {
    console.log('❌ [DRIVER-API] No drivers passed the vehicle type filter');
    console.log('❌ [DRIVER-API] Available vehicle types in database:');
    const availableTypes = [...new Set(drivers?.map(d => d.vehicles?.vehicle_type).filter(Boolean))];
    console.log('❌ [DRIVER-API] Available types:', availableTypes);
    console.log('❌ [DRIVER-API] Requested type:', ride.vehicle_type, 'Compatible types:', compatibleTypes);
  }
  
  if (filteredDrivers.length === 0) {
    console.log('⚠️ [DRIVER-API] ===== NO MATCHING DRIVERS FOUND =====');
    console.log('⚠️ [DRIVER-API] Updating ride status to no_drivers_available');
    console.log('⚠️ [DRIVER-API] Reason: No drivers found with vehicle type:', ride.vehicle_type);
    
    // Update ride status to no_drivers_available
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

  // Get live locations for these drivers
  console.log('📍 [DRIVER-API] ===== GETTING DRIVER LOCATIONS =====');
  console.log('📍 [DRIVER-API] Getting live locations for', filteredDrivers.length, 'drivers...');
  const driverUserIds = filteredDrivers.map(d => d.user_id);
  console.log('📍 [DRIVER-API] Driver user IDs to check:', driverUserIds);
  
  const { data: locations, error: locationsError } = await supabase
    .from('live_locations')
    .select('user_id, latitude, longitude, updated_at')
    .in('user_id', driverUserIds)
    .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

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

  // Create notifications for all matching drivers (don't filter by distance for now)
  console.log('📢 [DRIVER-API] ===== CREATING DRIVER NOTIFICATIONS =====');
  console.log('📢 [DRIVER-API] Creating notifications for', filteredDrivers.length, 'matching drivers...');
  
  const notifications = filteredDrivers.map(driver => {
    const location = locations?.find(loc => loc.user_id === driver.user_id);
    let distance = 5; // Default distance
    
    if (location) {
      distance = calculateDistance(
        ride.pickup_latitude,
        ride.pickup_longitude,
        parseFloat(location.latitude.toString()),
        parseFloat(location.longitude.toString())
      );
    }
    
    console.log(`📢 [DRIVER-API] Creating notification for driver ${driver.users?.full_name}:`, {
      user_id: driver.user_id,
      has_location: !!location,
      distance_km: distance.toFixed(2),
      pickup_address: ride.pickup_address,
      fare_amount: ride.fare_amount,
      vehicle_match: `${driver.vehicles?.vehicle_type} matches ${ride.vehicle_type}`
    });
    
    return {
    user_id: driver.user_id,
    type: 'ride_request',
    title: 'New Ride Request',
      message: `Pickup: ${ride.pickup_address} • ${distance.toFixed(1)}km away`,
    data: {
      // Primary ride ID fields (driver app expects these exact field names)
      ride_id: ride.id ? String(ride.id) : '',
      rideId: ride.id ? String(ride.id) : '',
      id: ride.id ? String(ride.id) : '',
      
      // Customer information
      customer_id: ride.customer_id,
      customerId: ride.customer_id,
      customer_name: ride.users?.full_name || 'Customer',
      customerName: ride.users?.full_name || 'Customer',
      customer_phone: ride.users?.phone_number,
      customerPhone: ride.users?.phone_number,
      
      // Location information
      pickup_address: ride.pickup_address,
      pickupLocation: ride.pickup_address,
      pickup_latitude: ride.pickup_latitude,
      pickup_longitude: ride.pickup_longitude,
      pickupCoords: {
        latitude: ride.pickup_latitude,
        longitude: ride.pickup_longitude,
      },
      
      destination_address: ride.destination_address,
      destinationLocation: ride.destination_address,
      destination_latitude: ride.destination_latitude,
      destination_longitude: ride.destination_longitude,
      destinationCoords: ride.destination_latitude ? {
        latitude: ride.destination_latitude,
        longitude: ride.destination_longitude,
      } : null,
      
      // Vehicle and fare information
      vehicle_type: ride.vehicle_type,
      vehicleType: ride.vehicle_type,
      fare_amount: ride.fare_amount,
      fareAmount: ride.fare_amount,
      
      // Booking information
      booking_type: ride.booking_type,
      bookingType: ride.booking_type,
      status: ride.status,
      
      // Distance and ETA
        distance: distance,
        eta: Math.round(distance * 2),
      
      // Timestamps
      created_at: ride.created_at,
      createdAt: ride.created_at,
    },
    status: 'unread',
    };
  });

  console.log('📢 [DRIVER-API] ===== NOTIFICATION CREATION SUMMARY =====');
  console.log(`📢 [DRIVER-API] Total notifications to create: ${notifications.length}`);
  console.log('📢 [DRIVER-API] Notification summary:', notifications.map((n, index) => ({
    notification_number: index + 1,
    driver_user_id: n.user_id,
    notification_type: n.type,
    title: n.title,
    message: n.message,
    ride_id: n.data.rideId,
    distance: n.data.distance?.toFixed(2) + 'km',
    eta: n.data.eta + 'min'
  })));

  if (notifications.length > 0) {
    console.log('📢 [DRIVER-API] ===== INSERTING NOTIFICATIONS INTO DATABASE =====');
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.error('❌ [DRIVER-API] Error creating notifications:', notificationError);
      console.error('❌ [DRIVER-API] Notification error details:', JSON.stringify(notificationError, null, 2));
      console.error('❌ [DRIVER-API] Failed notifications data:', JSON.stringify(notifications, null, 2));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create notifications',
          notificationError,
          notifications_attempted: notifications.length
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

    console.log(`✅ [DRIVER-API] Successfully created ${notifications.length} driver notifications in database`);
    
    // Verify notifications were created
    console.log('🔍 [DRIVER-API] ===== VERIFYING NOTIFICATIONS IN DATABASE =====');
    const { data: createdNotifications, error: verifyError } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, created_at')
      .eq('type', 'ride_request')
      .contains('data', { rideId: ride.id })
      .order('created_at', { ascending: false });
    
    if (verifyError) {
      console.error('❌ [DRIVER-API] Error verifying notifications:', verifyError);
    } else {
      console.log(`✅ [DRIVER-API] Verified ${createdNotifications?.length || 0} notifications exist in database`);
      console.log('📋 [DRIVER-API] Database verification - created notifications:', createdNotifications?.map((n, index) => ({
        verification_number: index + 1,
        id: n.id,
        user_id: n.user_id,
        type: n.type,
        title: n.title,
        created_at: n.created_at,
        age_seconds: Math.round((Date.now() - new Date(n.created_at).getTime()) / 1000)
      })));
    }
  } else {
    console.log('⚠️ [DRIVER-API] ===== NO DRIVERS TO NOTIFY =====');
    console.log('⚠️ [DRIVER-API] No matching drivers found - updating ride status to no_drivers_available');
    // No drivers available - update ride status
    const { error: updateError } = await supabase
      .from('rides')
      .update({ status: 'no_drivers_available' })
      .eq('id', ride_id);

    if (updateError) {
      console.error('❌ [DRIVER-API] Error updating ride status to no_drivers_available:', updateError);
    } else {
      console.log('✅ [DRIVER-API] Successfully updated ride status to no_drivers_available');
    }
  }

  console.log('📢 [DRIVER-API] ===== FINAL SUMMARY =====');
  const finalSummary = {
    ride_id: ride_id,
    requested_vehicle_type: ride.vehicle_type,
    total_drivers_in_db: drivers?.length || 0,
    matching_drivers_found: filteredDrivers.length,
    notifications_created: notifications.length,
    success: notifications.length > 0,
    timestamp: new Date().toISOString()
  };
  console.log('📊 [DRIVER-API] Process summary:', finalSummary);

  return new Response(
    JSON.stringify({ 
      success: true, 
      drivers_notified: notifications.length,
      total_drivers_found: filteredDrivers.length,
      notifications_created: notifications.length,
      debug_summary: finalSummary
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
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}