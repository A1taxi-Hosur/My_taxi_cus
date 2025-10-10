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
    const path = url.pathname.replace('/ride-api', '');
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Route handling
    if (path === '/create' && req.method === 'POST') {
      return await createRide(req, supabase);
    } else if (path === '/accept' && req.method === 'POST') {
      return await acceptRide(req, supabase);
    } else if (path === '/update-status' && req.method === 'POST') {
      return await updateRideStatus(req, supabase);
    } else if (path === '/find-drivers' && req.method === 'POST') {
      return await findNearbyDrivers(req, supabase);
    } else if (path.startsWith('/ride/') && req.method === 'GET') {
      const rideId = path.split('/')[2];
      return await getRideDetails(rideId, supabase);
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
    console.error('API error:', error);
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

async function createRide(req: Request, supabase: any) {
  const body = await req.json();
  
  // Generate unique ride code
  const rideCode = generateRideCode();
  
  const { data: ride, error } = await supabase
    .from('rides')
    .insert({
      ride_code: rideCode,
      customer_id: body.customerId,
      pickup_address: body.pickupLocation,
      pickup_latitude: body.pickupLatitude,
      pickup_longitude: body.pickupLongitude,
      destination_address: body.destinationLocation,
      destination_latitude: body.destinationLatitude,
      destination_longitude: body.destinationLongitude,
      vehicle_type: body.vehicleType,
      fare_amount: body.fareAmount,
      booking_type: 'regular',
      status: 'requested',
    })
    .select()
    .single();

  if (error) throw error;

  // Trigger webhook for driver notifications
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ride-webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'ride_created',
      ride_id: ride.id,
      customer_id: body.customerId
    })
  });

  return new Response(
    JSON.stringify({ data: ride, error: null }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

async function acceptRide(req: Request, supabase: any) {
  const { rideId, driverId } = await req.json();
  
  const { data: ride, error } = await supabase
    .from('rides')
    .update({
      driver_id: driverId,
      status: 'accepted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', rideId)
    .eq('status', 'requested')
    .select()
    .single();

  if (error) throw error;

  if (ride) {
    // Update driver status to busy
    await supabase
      .from('drivers')
      .update({ status: 'busy' })
      .eq('id', driverId);

    // Note: Ride accepted notifications are now handled directly in the client app
  }

  return new Response(
    JSON.stringify({ data: ride, error: null }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

async function updateRideStatus(req: Request, supabase: any) {
  const { rideId, status, driverId, data: extraData } = await req.json();
  
  const { data: ride, error } = await supabase
    .from('rides')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(extraData || {})
    })
    .eq('id', rideId)
    .eq('driver_id', driverId)
    .select()
    .single();

  if (error) throw error;

  // Note: Status update notifications are now handled directly in the client app

  // Update driver status when trip completes
  if (status === 'completed') {
    await supabase
      .from('drivers')
      .update({ status: 'online' })
      .eq('id', driverId);
  }

  return new Response(
    JSON.stringify({ data: ride, error: null }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

async function findNearbyDrivers(req: Request, supabase: any) {
  const { latitude, longitude, vehicleType, radius = 10 } = await req.json();
  
  console.log('Finding drivers near:', { latitude, longitude, vehicleType, radius });
  
  // Get available drivers with location data
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select(`
      id,
      user_id,
      rating,
      status,
      is_verified,
      users!drivers_user_id_fkey (
        full_name, 
        phone_number,
        live_locations!live_locations_user_id_fkey (latitude, longitude, heading, speed, updated_at)
      ),
      vehicles!fk_drivers_vehicle (
        make, 
        model, 
        vehicle_type, 
        color
      )
    `)
    .eq('status', 'online')
    .eq('is_verified', true)
    .not('vehicles', 'is', null);

  if (error) throw error;

  console.log('Found drivers:', drivers?.length || 0);
  console.log('Driver details:', drivers?.map(d => ({
    id: d.id,
    status: d.status,
    verified: d.is_verified,
    vehicleType: d.vehicles?.vehicle_type,
    hasLocation: d.users?.live_locations?.length > 0,
    location: d.users?.live_locations?.[0]
  })));

  // Calculate distances and filter by radius
  const nearbyDrivers = drivers
    ?.filter(driver => {
      // Check if driver has the right vehicle type
      const hasCorrectVehicle = driver.vehicles?.vehicle_type === vehicleType;
      // Check if driver has recent location data
      const hasLocation = driver.users?.live_locations?.length > 0;
      // Check if location is recent (within last 5 minutes)
      const hasRecentLocation = hasLocation && driver.users.live_locations[0] && 
        (new Date().getTime() - new Date(driver.users.live_locations[0].updated_at).getTime()) < 5 * 60 * 1000;
      
      if (!hasCorrectVehicle) {
        console.log(`Driver ${driver.id} filtered out: wrong vehicle type (${driver.vehicles?.vehicle_type} vs ${vehicleType})`);
      }
      if (!hasLocation) {
        console.log(`Driver ${driver.id} filtered out: no location data`);
      }
      if (hasLocation && !hasRecentLocation) {
        console.log(`Driver ${driver.id} filtered out: location too old (${driver.users.live_locations[0].updated_at})`);
      }
      
      return hasCorrectVehicle && hasRecentLocation;
    })
    .map(driver => {
      const location = driver.users?.live_locations?.[0];
      if (!location) return null;
      
      // Ensure coordinates are properly parsed as numbers
      const driverLat = parseFloat(location.latitude.toString());
      const driverLon = parseFloat(location.longitude.toString());
      const pickupLat = parseFloat(latitude.toString());
      const pickupLon = parseFloat(longitude.toString());
      
      // Validate coordinates
      if (isNaN(driverLat) || isNaN(driverLon) || isNaN(pickupLat) || isNaN(pickupLon)) {
        console.error(`Invalid coordinates for driver ${driver.id}:`, {
          driver: { lat: driverLat, lon: driverLon },
          pickup: { lat: pickupLat, lon: pickupLon }
        });
        return null;
      }
      
      const distance = calculateDistance(
        pickupLat,
        pickupLon,
        driverLat,
        driverLon
      );
      // Note: Driver notifications are now handled directly in the client app
      // via the rideService.createRide method, not through webhooks
      
      return {
        ...driver,
        distance,
        lastLocationUpdate: location.updated_at,
        driverLocation: { latitude: driverLat, longitude: driverLon }
      };
    })
    .filter(driver => driver !== null)
    .filter(driver => driver.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  console.log('Nearby drivers after filtering:', nearbyDrivers?.length || 0);
  console.log('Final nearby drivers:', nearbyDrivers?.map(d => ({
    id: d.id,
    name: d.users?.full_name,
    distance: d.distance.toFixed(2) + ' km',
    location: d.driverLocation
  })));

  return new Response(
    JSON.stringify({ data: nearbyDrivers || [], error: null }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

async function getRideDetails(rideId: string, supabase: any) {
  const { data: ride, error } = await supabase
    .from('rides')
    .select(`
      *,
      drivers (
        id,
        license_number,
        rating,
        users (full_name, phone_number),
        vehicles!fk_drivers_vehicle (make, model, registration_number, color)
      ),
      users!rides_customer_id_fkey (full_name, phone_number)
    `)
    .eq('id', rideId)
    .limit(1);

  // Extract the first ride if found, otherwise return null
  const rideData = ride && ride.length > 0 ? ride[0] : null;

  return new Response(
    JSON.stringify({ data: rideData, error }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Validate input coordinates
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    console.error('Invalid coordinates for distance calculation:', { lat1, lon1, lat2, lon2 });
    return 999; // Return large distance for invalid coordinates
  }

  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // Log distance calculation for debugging
  console.log('Distance calculation:', {
    from: { lat: lat1, lon: lon1 },
    to: { lat: lat2, lon: lon2 },
    distance: distance.toFixed(2) + ' km'
  });
  
  return distance;
}

function generateRideCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}