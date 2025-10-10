const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    const path = url.pathname.replace('/driver-details', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (path === '/get-driver' && req.method === 'GET') {
      const driverId = url.searchParams.get('driverId');
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Missing driverId parameter' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
      return await getDriverDetails(driverId, supabase);
    } else if (path === '/get-ride-with-driver' && req.method === 'GET') {
      const rideId = url.searchParams.get('rideId');
      if (!rideId) {
        return new Response(
          JSON.stringify({ error: 'Missing rideId parameter' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
      return await getRideWithDriverDetails(rideId, supabase);
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Driver details API error:', error);
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

async function getDriverDetails(driverId: string, supabase: any) {
  try {
    console.log('🔍 Fetching driver details for ID:', driverId);
    
    const { data: driver, error } = await supabase
      .from('drivers')
      .select(`
        id,
        user_id,
        license_number,
        rating,
        total_rides,
        status,
        is_verified,
        users!drivers_user_id_fkey (
          id,
          full_name,
          phone_number,
          email
        ),
        vehicles!fk_drivers_vehicle (
          id,
          make,
          model,
          year,
          color,
          registration_number,
          vehicle_type
        )
      `)
      .eq('id', driverId)
      .single();

    if (error) {
      console.error('❌ Error fetching driver:', error);
      return new Response(
        JSON.stringify({ data: null, error: error.message }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('✅ Driver details fetched successfully:', driver?.users?.full_name);

    return new Response(
      JSON.stringify({ data: driver, error: null }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ Exception in getDriverDetails:', error);
    return new Response(
      JSON.stringify({ data: null, error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

async function getRideWithDriverDetails(rideId: string, supabase: any) {
  try {
    console.log('🔍 Fetching ride with driver details for ride ID:', rideId);
    
    const { data: ride, error } = await supabase
      .from('rides')
      .select(`
        id,
        ride_code,
        customer_id,
        driver_id,
        pickup_address,
        pickup_latitude,
        pickup_longitude,
        destination_address,
        destination_latitude,
        destination_longitude,
        status,
        fare_amount,
        vehicle_type,
        booking_type,
        payment_status,
        payment_method,
        pickup_otp,
        drop_otp,
        created_at,
        updated_at,
        drivers!rides_driver_id_fkey (
          id,
          user_id,
          license_number,
          rating,
          total_rides,
          status,
          users!drivers_user_id_fkey (
            id,
            full_name,
            phone_number,
            email
          ),
          vehicles!fk_drivers_vehicle (
            id,
            make,
            model,
            year,
            color,
            registration_number,
            vehicle_type
          )
        )
      `)
      .eq('id', rideId)
      .single();

    if (error) {
      console.error('❌ Error fetching ride with driver:', error);
      return new Response(
        JSON.stringify({ data: null, error: error.message }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('✅ Ride with driver details fetched successfully');

    return new Response(
      JSON.stringify({ data: ride, error: null }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ Exception in getRideWithDriverDetails:', error);
    return new Response(
      JSON.stringify({ data: null, error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}