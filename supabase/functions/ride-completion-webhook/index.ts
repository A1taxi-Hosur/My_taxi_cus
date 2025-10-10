const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RideCompletionData {
  rideId: string;
  bookingId?: string;
  status: string;
  fare_amount: number;
  distance_km: number;
  duration_minutes: number;
  driver_id: string;
  booking_type?: string;
  fareBreakdown?: any; // Driver app fare breakdown
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
    const path = url.pathname.replace('/ride-completion-webhook', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (path === '/notify-completion' && req.method === 'POST') {
      return await handleRideCompletion(req, supabase);
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
    console.error('Ride completion webhook error:', error);
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

async function handleRideCompletion(req: Request, supabase: any) {
  try {
    const { rideId, bookingId, status, fare_amount, distance_km, duration_minutes, driver_id, booking_type, fareBreakdown }: RideCompletionData = await req.json();
    
    console.log('🏁 Processing ride completion notification:', { rideId, bookingId, booking_type, status });
    console.log('📊 Completion data:', {
      status,
      fare_amount,
      distance_km,
      duration_minutes,
      driver_id,
      fareBreakdown
    });

    let ride = null;
    let customer = null;
    let driver = null;
    
    // Handle both regular rides and scheduled bookings
    if (rideId) {
      // Regular ride completion
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select(`
          *,
          drivers!rides_driver_id_fkey (
            id,
            user_id,
            license_number,
            rating,
            total_rides,
            users!drivers_user_id_fkey (
              full_name,
              phone_number
            ),
            vehicles!fk_drivers_vehicle (
              make,
              model,
              registration_number,
              color,
              vehicle_type
            )
          ),
          users!rides_customer_id_fkey (
            id,
            full_name,
            phone_number,
            email
          )
        `)
        .eq('id', rideId)
        .single();

      if (rideError || !rideData) {
        console.error('❌ Error fetching ride details:', rideError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Ride not found',
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
      
      ride = rideData;
      customer = rideData.users;
      driver = rideData.drivers;
    } else if (bookingId) {
      // Scheduled booking completion (outstation, rental, airport)
      const { data: bookingData, error: bookingError } = await supabase
        .from('scheduled_bookings')
        .select(`
          *,
          customer:users!scheduled_bookings_customer_id_fkey (
            id,
            full_name,
            phone_number,
            email
          ),
          assigned_driver:drivers!scheduled_bookings_assigned_driver_id_fkey (
            id,
            user_id,
            license_number,
            rating,
            total_rides,
            users!drivers_user_id_fkey (
              full_name,
              phone_number
            ),
            vehicles!fk_drivers_vehicle (
              make,
              model,
              registration_number,
              color,
              vehicle_type
            )
          )
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !bookingData) {
        console.error('❌ Error fetching booking details:', bookingError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Booking not found',
            bookingError 
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
      
      // Convert booking to ride format for notification
      ride = {
        id: bookingData.id,
        ride_code: `${bookingData.booking_type.toUpperCase().substring(0, 3)}-${bookingData.id.substring(0, 6).toUpperCase()}`,
        customer_id: bookingData.customer_id,
        driver_id: bookingData.assigned_driver_id,
        pickup_address: bookingData.pickup_address,
        pickup_latitude: bookingData.pickup_latitude,
        pickup_longitude: bookingData.pickup_longitude,
        destination_address: bookingData.destination_address,
        destination_latitude: bookingData.destination_latitude,
        destination_longitude: bookingData.destination_longitude,
        status: 'completed',
        fare_amount: fare_amount,
        distance_km: distance_km,
        duration_minutes: duration_minutes,
        vehicle_type: bookingData.vehicle_type,
        booking_type: bookingData.booking_type,
        payment_method: 'cash',
        payment_status: 'completed',
        created_at: bookingData.created_at,
        updated_at: new Date().toISOString(),
        rental_hours: bookingData.rental_hours,
        special_instructions: bookingData.special_instructions,
      };
      
      customer = bookingData.customer;
      driver = bookingData.assigned_driver;
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing rideId or bookingId' 
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

    console.log('✅ Found ride/booking for completion notification:', {
      id: ride.id,
      customer_id: ride.customer_id,
      booking_type: ride.booking_type,
      driver_name: driver?.users?.full_name,
      vehicle: driver?.vehicles ? `${driver.vehicles.make} ${driver.vehicles.model}` : null
    });

    // Create detailed completion notification for customer with driver app fare breakdown
    const completionNotification = {
      user_id: ride.customer_id,
      type: 'trip_completed',
      title: 'Trip Completed Successfully!',
      message: `Total: ₹${fare_amount} • ${distance_km.toFixed(1)}km • ${Math.round(duration_minutes)}min • Driver: ${driver?.users?.full_name || 'N/A'}`,
      data: {
        rideId: ride.id,
        bookingId: bookingId || null,
        rideCode: ride.ride_code,
        fareAmount: fare_amount,
        distance: distance_km,
        duration: duration_minutes,
        
        // Driver app fare breakdown (exact calculation from driver app)
        driverAppFareBreakdown: fareBreakdown || null,
        
        // Trip details
        pickupAddress: ride.pickup_address,
        destinationAddress: ride.destination_address,
        bookingType: ride.booking_type,
        vehicleType: ride.vehicle_type,
        rentalHours: ride.rental_hours || null,
        
        // Driver details
        driverName: driver?.users?.full_name,
        driverPhone: driver?.users?.phone_number,
        driverRating: driver?.rating,
        vehicleInfo: driver?.vehicles ? `${driver.vehicles.make} ${driver.vehicles.model}` : null,
        registrationNumber: driver?.vehicles?.registration_number,
        vehicleColor: driver?.vehicles?.color,
        
        // Payment details
        paymentMethod: ride.payment_method || 'cash',
        paymentStatus: ride.payment_status || 'completed',
        
        // Completion details
        completedAt: new Date().toISOString(),
        canRate: !ride.rating,
        canDownloadBill: true,
        hasDriverAppData: !!fareBreakdown,
        
        // Special booking details
        specialInstructions: ride.special_instructions || null,
        isScheduledBooking: !!bookingId,
      },
      status: 'unread',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert the notification
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(completionNotification);

    if (notificationError) {
      console.error('❌ Error creating completion notification:', notificationError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create notification',
          notificationError 
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

    console.log('✅ Ride completion notification created successfully for customer:', ride.customer_id);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Ride completion notification sent successfully',
        notification_data: {
          customer_id: ride.customer_id,
          booking_type: ride.booking_type,
          fare_amount,
          distance_km,
          duration_minutes,
          driver_name: driver?.users?.full_name,
          has_driver_app_breakdown: !!fareBreakdown
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ Error in handleRideCompletion:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
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
}