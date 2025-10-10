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
    console.log('🔐 ===== VERIFY OTP STARTING =====');
    const { phoneNumber, otp } = await req.json();
    console.log('🔐 Phone Number:', phoneNumber);
    console.log('🔐 OTP:', otp);

    if (!phoneNumber || !otp) {
      console.log('❌ Missing phone number or OTP');
      return new Response(
        JSON.stringify({ error: 'Phone number and OTP are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('🔐 Supabase client created');

    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('otp_code', otp)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      console.error('OTP verification failed:', otpError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    await supabase
      .from('otp_verifications')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    console.log('🔐 Checking for existing customer...');
    const { data: existingCustomer } = await supabase
      .from('Customers')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    let customerId: string;
    let userId: string | null = null;

    if (existingCustomer) {
      console.log('✅ Found existing customer:', existingCustomer.id);
      customerId = existingCustomer.id.toString();
      userId = existingCustomer.user_id;

      console.log('🔐 Updating existing customer name...');
      await supabase
        .from('Customers')
        .update({
          name: otpRecord.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id);
    } else {
      console.log('🔐 Creating new customer...');
      const { data: newCustomer, error: customerError } = await supabase
        .from('Customers')
        .insert({
          name: otpRecord.name,
          phone_number: phoneNumber,
        })
        .select()
        .single();

      if (customerError || !newCustomer) {
        console.error('❌ Error creating customer:', customerError);
        console.error('❌ Customer error details:', JSON.stringify(customerError, null, 2));
        return new Response(
          JSON.stringify({ error: 'Failed to create customer account', details: customerError?.message }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      console.log('✅ Customer created:', newCustomer.id);
      customerId = newCustomer.id.toString();
      userId = newCustomer.user_id;
    }

    console.log('🔐 Customer ID:', customerId);
    console.log('🔐 Existing user_id:', userId);

    let authUser;

    if (userId) {
      const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(userId);
      if (!getUserError && user) {
        authUser = user;
      }
    }

    if (!authUser) {
      console.log('🔐 Creating new auth user...');
      console.log('🔐 Phone:', phoneNumber);
      console.log('🔐 Name:', otpRecord.name);
      console.log('🔐 Customer ID:', customerId);

      const dummyEmail = `${phoneNumber.replace(/\+/g, '').replace(/\s/g, '')}@phone.a1taxi.local`;
      console.log('🔐 Using dummy email:', dummyEmail);

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        phone: phoneNumber,
        email: dummyEmail,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          full_name: otpRecord.name,
          phone_number: phoneNumber,
          customer_id: customerId,
          role: 'customer',
        },
      });

      if (authError) {
        console.error('❌ Auth error:', authError);
        console.error('❌ Auth error code:', authError.code);
        console.error('❌ Auth error message:', authError.message);
        console.error('❌ Auth error details:', JSON.stringify(authError, null, 2));
        return new Response(
          JSON.stringify({ error: 'Authentication failed: ' + authError.message }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      if (!authData || !authData.user) {
        console.error('❌ No auth data or user returned');
        return new Response(
          JSON.stringify({ error: 'Failed to create user session' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      authUser = authData.user;
      console.log('✅ Auth user created:', authUser.id);

      console.log('🔐 Updating customer with user_id...');
      const { error: updateError } = await supabase
        .from('Customers')
        .update({ user_id: authUser.id })
        .eq('id', customerId);

      if (updateError) {
        console.error('❌ Error updating customer with user_id:', updateError);
      } else {
        console.log('✅ Customer updated with user_id');
      }
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.email || `${phoneNumber.replace(/\+/g, '')}@phone.local`,
    });

    if (sessionError || !sessionData) {
      console.error('Session error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        customerId,
        sessionUrl: sessionData.properties.action_link
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Verify OTP error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred during verification' }),
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