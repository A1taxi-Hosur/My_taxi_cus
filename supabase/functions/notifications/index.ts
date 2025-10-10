const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RideRequestPayload {
  rideId: string;
  driverUserIds: string[];
  rideData: any;
}

interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  data: any;
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
    const path = url.pathname.replace('/notifications', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (path === '/send-ride-request' && req.method === 'POST') {
      return await sendRideRequestNotifications(req, supabase);
    } else if (path === '/send-status-update' && req.method === 'POST') {
      return await sendStatusUpdateNotification(req, supabase);
    } else if (path === '/cancel-ride-requests' && req.method === 'POST') {
      return await cancelRideRequestNotifications(req, supabase);
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
    console.error('Notifications API error:', error);
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

async function sendRideRequestNotifications(req: Request, supabase: any) {
  const { rideId, driverUserIds, rideData }: RideRequestPayload = await req.json();
  
  console.log(`Sending ride request notifications for ride ${rideId} to ${driverUserIds.length} drivers`);
  
  const notifications = driverUserIds.map(driverUserId => ({
    user_id: driverUserId,
    type: 'ride_request',
    title: 'New Ride Request',
    message: `Pickup: ${rideData.pickup_address}${rideData.distance ? ` • ${rideData.distance.toFixed(1)}km away` : ''}`,
    data: {
      rideId,
      pickupLocation: rideData.pickup_address,
      destinationLocation: rideData.destination_address,
      fareAmount: rideData.fare_amount,
      vehicleType: rideData.vehicle_type,
      distance: rideData.distance,
      eta: rideData.eta,
      pickupCoords: {
        latitude: rideData.pickup_latitude,
        longitude: rideData.pickup_longitude,
      },
      destinationCoords: rideData.destination_latitude ? {
        latitude: rideData.destination_latitude,
        longitude: rideData.destination_longitude,
      } : null,
    },
    status: 'unread',
  }));

  const { data, error } = await supabase
    .from('notifications')
    .insert(notifications);

  if (error) throw error;

  console.log(`✅ Successfully sent ${notifications.length} ride request notifications`);

  return new Response(
    JSON.stringify({ success: true, notificationsSent: notifications.length }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

async function sendStatusUpdateNotification(req: Request, supabase: any) {
  const { userId, type, title, message, data }: NotificationPayload = await req.json();
  
  console.log(`Sending ${type} notification to user: ${userId}`);
  
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      data,
      status: 'unread',
    });

  if (error) throw error;

  console.log(`✅ Successfully sent ${type} notification to user: ${userId}`);

  return new Response(
    JSON.stringify({ success: true }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

async function cancelRideRequestNotifications(req: Request, supabase: any) {
  const { rideId, acceptedDriverUserId } = await req.json();
  
  console.log(`Cancelling ride request notifications for ride: ${rideId}, except driver: ${acceptedDriverUserId}`);
  
  const { error } = await supabase
    .from('notifications')
    .update({ 
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('type', 'ride_request')
    .contains('data', { rideId })
    .neq('user_id', acceptedDriverUserId);

  if (error) throw error;

  console.log(`✅ Cancelled ride request notifications for other drivers`);

  return new Response(
    JSON.stringify({ success: true }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}