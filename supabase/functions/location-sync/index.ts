const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface LocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
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
    const path = url.pathname.replace('/location-sync', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (path === '/update' && req.method === 'POST') {
      return await updateLocation(req, supabase);
    } else if (path === '/track' && req.method === 'GET') {
      const userId = url.searchParams.get('userId');
      return await getLocationUpdates(userId!, supabase);
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
    console.error('Location sync error:', error);
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

async function updateLocation(req: Request, supabase: any) {
  const { userId, latitude, longitude, heading, speed, accuracy }: LocationUpdate = await req.json();
  
  const { data, error } = await supabase
    .from('live_locations')
    .upsert({
      user_id: userId,
      latitude,
      longitude,
      heading: heading || null,
      speed: speed || null,
      accuracy: accuracy || null,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true, data }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

async function getLocationUpdates(userId: string, supabase: any) {
  const { data, error } = await supabase
    .from('live_locations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  return new Response(
    JSON.stringify({ data, error }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}