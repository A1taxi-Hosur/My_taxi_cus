const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface BookingData {
  id: string;
  booking_type: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_address: string;
  destination_address: string | null;
  vehicle_type: string;
  fare_amount: number | null;
  special_instructions?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { booking_data }: { booking_data: BookingData } = await req.json();
    
    console.log('📋 Processing admin notification for booking:', booking_data.id);
    console.log('📋 Booking details:', {
      type: booking_data.booking_type,
      customer: booking_data.customer_name,
      vehicle: booking_data.vehicle_type,
      fare: booking_data.fare_amount
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all admin users
    console.log('🔍 Fetching admin users...');
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'admin');

    if (adminError) {
      console.error('❌ Error fetching admin users:', adminError);
      throw adminError;
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.warn('⚠️ No admin users found to send notifications to');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No admin users found',
          admins_notified: 0
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

    console.log(`✅ Found ${adminUsers.length} admin users`);

    // Create notifications for each admin user
    const notifications = adminUsers.map(admin => ({
      user_id: admin.id,
      type: 'admin_booking',
      title: `New ${booking_data.booking_type.charAt(0).toUpperCase() + booking_data.booking_type.slice(1)} Booking`,
      message: `Customer: ${booking_data.customer_name} • Pickup: ${booking_data.pickup_address}${booking_data.fare_amount ? ` • ₹${booking_data.fare_amount}` : ''}`,
      data: {
        bookingId: booking_data.id,
        bookingType: booking_data.booking_type,
        customerId: booking_data.customer_id,
        customerName: booking_data.customer_name,
        customerPhone: booking_data.customer_phone,
        pickupAddress: booking_data.pickup_address,
        destinationAddress: booking_data.destination_address,
        vehicleType: booking_data.vehicle_type,
        fareAmount: booking_data.fare_amount,
        specialInstructions: booking_data.special_instructions,
        requiresAllocation: true,
        createdAt: new Date().toISOString(),
      },
      status: 'unread',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    console.log(`📢 Creating ${notifications.length} admin notifications...`);

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.error('❌ Error creating admin notifications:', notificationError);
      throw notificationError;
    }

    console.log(`✅ Successfully created ${notifications.length} admin notifications`);

    return new Response(
      JSON.stringify({ 
        success: true,
        admins_notified: notifications.length,
        booking_id: booking_data.id,
        booking_type: booking_data.booking_type
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ Admin notifications error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        admins_notified: 0
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
});