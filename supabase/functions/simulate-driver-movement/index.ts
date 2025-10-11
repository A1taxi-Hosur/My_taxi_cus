import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SimulationRequest {
  driverId: string;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  durationSeconds?: number;
  updateIntervalSeconds?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SimulationRequest = await req.json();
    const {
      driverId,
      startLat,
      startLon,
      endLat,
      endLon,
      durationSeconds = 60,
      updateIntervalSeconds = 3,
    } = body;

    if (!driverId || !startLat || !startLon || !endLat || !endLon) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🚗 Starting driver movement simulation:', {
      driverId,
      from: { lat: startLat, lon: startLon },
      to: { lat: endLat, lon: endLon },
      duration: durationSeconds,
      interval: updateIntervalSeconds,
    });

    const totalSteps = Math.floor(durationSeconds / updateIntervalSeconds);
    const latStep = (endLat - startLat) / totalSteps;
    const lonStep = (endLon - startLon) / totalSteps;

    let currentLat = startLat;
    let currentLon = startLon;
    let previousLat = startLat;
    let previousLon = startLon;

    const calculateHeading = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
      const x =
        Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
        Math.sin((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.cos(dLon);
      const heading = Math.atan2(y, x);
      return ((heading * 180) / Math.PI + 360) % 360;
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    for (let step = 0; step <= totalSteps; step++) {
      currentLat = startLat + latStep * step;
      currentLon = startLon + lonStep * step;

      const heading = calculateHeading(previousLat, previousLon, currentLat, currentLon);

      const distanceThisStep = calculateDistance(previousLat, previousLon, currentLat, currentLon);
      const speed = (distanceThisStep / updateIntervalSeconds) * 3600;

      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: driverId,
          latitude: currentLat,
          longitude: currentLon,
          heading: Math.round(heading),
          speed: Math.round(speed * 10) / 10,
          accuracy: 10,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'driver_id',
        });

      if (error) {
        console.error('❌ Error updating driver location:', error);
      } else {
        console.log(`✅ Step ${step + 1}/${totalSteps}: Updated location (${currentLat.toFixed(5)}, ${currentLon.toFixed(5)}) heading: ${Math.round(heading)}°`);
      }

      previousLat = currentLat;
      previousLon = currentLon;

      if (step < totalSteps) {
        await new Promise((resolve) => setTimeout(resolve, updateIntervalSeconds * 1000));
      }
    }

    console.log('🎉 Simulation completed!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Driver movement simulation completed',
        totalSteps,
        finalPosition: { latitude: currentLat, longitude: currentLon },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Simulation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});