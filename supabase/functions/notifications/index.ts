const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

    if (req.method === 'POST') {
      const body = await req.json();

      if (body.action === 'send-otp') {
        return await sendOTP(body, supabase);
      } else if (path === '/send-ride-request') {
        return await sendRideRequestNotifications(body, supabase);
      } else if (path === '/send-status-update') {
        return await sendStatusUpdateNotification(body, supabase);
      } else if (path === '/cancel-ride-requests') {
        return await cancelRideRequestNotifications(body, supabase);
      }
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

async function sendOTP(body: any, supabase: any) {
  const { phoneNumber, name } = body;

  if (!phoneNumber || !name) {
    return new Response(
      JSON.stringify({ error: 'Phone number and name are required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const { error: insertError } = await supabase
    .from('otp_verifications')
    .insert({
      phone_number: phoneNumber,
      otp_code: otp,
      name: name,
      expires_at: expiresAt.toISOString(),
      verified: false,
    });

  if (insertError) {
    console.error('Error storing OTP:', insertError);
    return new Response(
      JSON.stringify({ error: 'Failed to generate OTP' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: twilioPhoneNumber,
          Body: `Your A1 Taxi verification code is: ${otp}. Valid for 10 minutes.`,
        }),
      });

      if (!twilioResponse.ok) {
        const twilioError = await twilioResponse.json();
        console.error('Twilio error:', twilioError);
        return new Response(
          JSON.stringify({ error: 'Failed to send SMS' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      console.log(`OTP sent successfully to ${phoneNumber}`);
    } catch (twilioError) {
      console.error('Error sending SMS via Twilio:', twilioError);
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  } else {
    console.log(`[DEV MODE] OTP for ${phoneNumber}: ${otp}`);
  }

  return new Response(
    JSON.stringify({ success: true, message: 'OTP sent successfully' }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

async function sendRideRequestNotifications(body: any, supabase: any) {
  const { rideId, driverUserIds, rideData }: RideRequestPayload = body;
  
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

async function sendStatusUpdateNotification(body: any, supabase: any) {
  const { userId, type, title, message, data }: NotificationPayload = body;
  
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

async function cancelRideRequestNotifications(body: any, supabase: any) {
  const { rideId, acceptedDriverUserId } = body;
  
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