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
    const { bookingId, userId, cancellationReason } = await req.json();

    if (!bookingId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Booking ID and User ID are required', success: false }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('🚫 Cancelling booking:', bookingId, 'for user:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First verify the booking belongs to the user
    const { data: booking, error: fetchError } = await supabase
      .from('scheduled_bookings')
      .select('id, customer_id, assigned_driver_id, status')
      .eq('id', bookingId)
      .eq('customer_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching booking:', fetchError);
      throw new Error('Failed to verify booking');
    }

    if (!booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found or unauthorized', success: false }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      console.log('⚠️ Booking already cancelled');
      return new Response(
        JSON.stringify({ success: true, message: 'Booking already cancelled' }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Cancel the booking
    const { error: updateError } = await supabase
      .from('scheduled_bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: cancellationReason || 'Cancelled by customer',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error cancelling booking:', updateError);
      throw updateError;
    }

    console.log('✅ Booking cancelled successfully');

    // Free up the driver if assigned
    if (booking.assigned_driver_id) {
      console.log('🚗 Freeing up driver:', booking.assigned_driver_id);
      const { error: driverError } = await supabase
        .from('drivers')
        .update({ status: 'online' })
        .eq('id', booking.assigned_driver_id);

      if (driverError) {
        console.warn('⚠️ Warning: Could not update driver status:', driverError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Booking cancelled successfully' }),
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
      JSON.stringify({ error: error.message || 'An error occurred', success: false }),
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