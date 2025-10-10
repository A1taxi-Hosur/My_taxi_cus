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
    const { phoneNumber, name } = await req.json();

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error: insertError } = await supabase
      .from('otp_verifications')
      .insert({
        phone_number: phoneNumber,
        otp_code: otpCode,
        name: name,
        verified: false,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error inserting OTP:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to send OTP' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log(`OTP generated for ${phoneNumber}: ${otpCode}`);
    console.log(`Name: ${name}`);
    console.log(`Expires at: ${expiresAt.toISOString()}`);

    let smsSent = false;
    let smsError = null;

    try {
      console.log('📲 ===== TWILIO SMS SENDING STARTING =====');
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

      console.log('📲 Twilio Account SID exists:', !!twilioAccountSid);
      console.log('📲 Twilio Auth Token exists:', !!twilioAuthToken);
      console.log('📲 Twilio Phone Number exists:', !!twilioPhoneNumber);
      console.log('📲 Twilio Phone Number:', twilioPhoneNumber);

      if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
        console.log('📲 All Twilio credentials found, sending SMS...');
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

        console.log('📲 Twilio URL:', twilioUrl);
        console.log('📲 Sending to:', phoneNumber);
        console.log('📲 From:', twilioPhoneNumber);

        const smsBody = `Your A1 Taxi verification code is: ${otpCode}. Valid for 10 minutes.`;
        console.log('📲 Message body:', smsBody);

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phoneNumber,
            From: twilioPhoneNumber,
            Body: smsBody,
          }),
        });

        console.log('📲 Twilio response status:', twilioResponse.status);
        console.log('📲 Twilio response ok:', twilioResponse.ok);

        if (twilioResponse.ok) {
          const twilioData = await twilioResponse.json();
          smsSent = true;
          console.log('✅ SMS sent via Twilio successfully!');
          console.log('📲 Twilio message SID:', twilioData.sid);
        } else {
          const errorData = await twilioResponse.json();
          console.error('❌ Twilio API error response:', JSON.stringify(errorData, null, 2));
          smsError = errorData.message || 'Twilio API error';
        }
      } else {
        const missing = [];
        if (!twilioAccountSid) missing.push('TWILIO_ACCOUNT_SID');
        if (!twilioAuthToken) missing.push('TWILIO_AUTH_TOKEN');
        if (!twilioPhoneNumber) missing.push('TWILIO_PHONE_NUMBER');
        console.log('⚠️ Twilio credentials not configured. Missing:', missing.join(', '));
        smsError = `Missing Twilio env vars: ${missing.join(', ')}`;
      }
      console.log('📲 ===== TWILIO SMS SENDING COMPLETE =====');
    } catch (err) {
      console.error('❌ SMS sending failed with exception:', err);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      smsError = err.message;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: smsSent ? 'OTP sent successfully via SMS' : 'OTP generated successfully',
        devOtp: otpCode,
        smsSent,
        smsError: !smsSent ? smsError : undefined,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Send OTP error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred while sending OTP' }),
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