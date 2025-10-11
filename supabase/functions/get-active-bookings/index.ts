const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required', data: null }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('🔍 Fetching active bookings for user:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active scheduled bookings with driver details
    const { data, error } = await supabase
      .from('scheduled_bookings')
      .select(`
        *,
        assigned_driver:drivers!scheduled_bookings_assigned_driver_id_fkey (
          id,
          user_id,
          rating,
          total_rides,
          vehicle_id,
          users:user_id (
            full_name,
            phone_number
          ),
          vehicles:vehicle_id (
            make,
            model,
            registration_number,
            color,
            vehicle_type
          )
        )
      `)
      .eq('customer_id', userId)
      .in('status', ['pending', 'confirmed', 'assigned', 'accepted', 'driver_arrived', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      throw error;
    }

    console.log('✅ Found', data?.length || 0, 'active bookings');

    return new Response(
      JSON.stringify({ data, error: null }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred', data: null }),
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