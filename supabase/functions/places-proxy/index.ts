const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Read API key from environment variable
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');

if (!GOOGLE_API_KEY) {
  console.error('❌ GOOGLE_API_KEY environment variable not set');
} else {
  console.log('✅ Google Maps API key loaded for places proxy');
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
    const path = url.pathname;
    
    console.log('📍 Places proxy request:', path);
    
    // Handle different Google Places API endpoints
    if (path.includes('/autocomplete')) {
      return await handleAutocomplete(req);
    } else if (path.includes('/details')) {
      return await handlePlaceDetails(req);
    } else if (path.includes('/directions')) {
      return await handleDirections(req);
    } else if (path.includes('/geocode')) {
      return await handleGeocode(req);
    } else if (path.includes('/distancematrix')) {
      return await handleDistanceMatrix(req);
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
    console.error('Places proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: error.message }),
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

async function handleAutocomplete(req: Request) {
  const url = new URL(req.url);
  const input = url.searchParams.get('input') || '';
  
  if (!input) {
    return new Response(
      JSON.stringify({ error: 'Missing input parameter' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  const sessiontoken = url.searchParams.get('sessiontoken') ? `&sessiontoken=${encodeURIComponent(url.searchParams.get('sessiontoken')!)}` : '';
  const location = url.searchParams.get('location') ? `&location=${encodeURIComponent(url.searchParams.get('location')!)}` : '';
  const radius = url.searchParams.get('radius') ? `&radius=${encodeURIComponent(url.searchParams.get('radius')!)}` : '';
  const components = url.searchParams.get('components') ? `&components=${encodeURIComponent(url.searchParams.get('components')!)}` : '';

  const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}${sessiontoken}${location}${radius}${components}&key=${GOOGLE_API_KEY}`;

  console.log('🔍 Autocomplete request to Google API');
  
  try {
    const response = await fetch(googleUrl);
    console.log('📡 Google response status:', response.status);
    
    const data = await response.json();
    
    if (data.error_message) {
      console.error('❌ Google API error:', data.error_message);
    } else {
      console.log('✅ Autocomplete successful, predictions:', data.predictions?.length || 0);
    }

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ Fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch from Google API', details: error.message }),
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

async function handlePlaceDetails(req: Request) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get('place_id') || '';
  
  if (!placeId) {
    return new Response(
      JSON.stringify({ error: 'Missing place_id parameter' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  const fields = url.searchParams.get('fields') || 'geometry,formatted_address,name';
  const sessiontoken = url.searchParams.get('sessiontoken') ? `&sessiontoken=${encodeURIComponent(url.searchParams.get('sessiontoken')!)}` : '';

  const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}${sessiontoken}&key=${GOOGLE_API_KEY}`;

  console.log('🏢 Place details request to Google API');
  
  try {
    const response = await fetch(googleUrl);
    console.log('📡 Google response status:', response.status);
    
    const data = await response.json();
    
    if (data.error_message) {
      console.error('❌ Google API error:', data.error_message);
    } else {
      console.log('✅ Place details successful');
    }

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ Fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch from Google API', details: error.message }),
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

async function handleDirections(req: Request) {
  const url = new URL(req.url);
  const origin = url.searchParams.get('origin') || '';
  const destination = url.searchParams.get('destination') || '';
  
  if (!origin || !destination) {
    return new Response(
      JSON.stringify({ error: 'Missing origin or destination parameter' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  const mode = url.searchParams.get('mode') || 'driving';
  const alternatives = url.searchParams.get('alternatives') || 'false';

  const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${encodeURIComponent(mode)}&alternatives=${encodeURIComponent(alternatives)}&key=${GOOGLE_API_KEY}`;

  console.log('🗺️ Directions request to Google API');
  
  try {
    const response = await fetch(googleUrl);
    console.log('📡 Google response status:', response.status);
    
    const data = await response.json();
    
    if (data.error_message) {
      console.error('❌ Google API error:', data.error_message);
    } else {
      console.log('✅ Directions successful, routes:', data.routes?.length || 0);
    }

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ Fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch from Google API', details: error.message }),
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

async function handleGeocode(req: Request) {
  const url = new URL(req.url);
  const latlng = url.searchParams.get('latlng') || '';
  const address = url.searchParams.get('address') || '';
  
  if (!latlng && !address) {
    return new Response(
      JSON.stringify({ error: 'Missing latlng or address parameter' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  let googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?`;
  if (latlng) {
    googleUrl += `latlng=${encodeURIComponent(latlng)}`;
  } else {
    googleUrl += `address=${encodeURIComponent(address)}`;
  }
  googleUrl += `&key=${GOOGLE_API_KEY}`;

  console.log('🌍 Geocode request to Google API');
  
  try {
    const response = await fetch(googleUrl);
    console.log('📡 Google response status:', response.status);
    
    const data = await response.json();
    
    if (data.error_message) {
      console.error('❌ Google API error:', data.error_message);
    } else {
      console.log('✅ Geocode successful, results:', data.results?.length || 0);
    }

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ Fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch from Google API', details: error.message }),
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

async function handleDistanceMatrix(req: Request) {
  const url = new URL(req.url);
  const origins = url.searchParams.get('origins') || '';
  const destinations = url.searchParams.get('destinations') || '';
  
  if (!origins || !destinations) {
    return new Response(
      JSON.stringify({ error: 'Missing origins or destinations parameter' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  const mode = url.searchParams.get('mode') || 'driving';
  const units = url.searchParams.get('units') || 'metric';

  const googleUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&mode=${encodeURIComponent(mode)}&units=${encodeURIComponent(units)}&key=${GOOGLE_API_KEY}`;

  console.log('📏 Distance matrix request to Google API');
  
  try {
    const response = await fetch(googleUrl);
    console.log('📡 Google response status:', response.status);
    
    const data = await response.json();
    
    if (data.error_message) {
      console.error('❌ Google API error:', data.error_message);
    } else {
      console.log('✅ Distance matrix successful');
    }

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ Fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch from Google API', details: error.message }),
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