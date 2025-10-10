import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://whubaypabojomdyfqxcf.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodWJheXBhYm9qb21keWZxeGNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzE2NzQsImV4cCI6MjA1MTMwNzY3NH0.placeholder-anon-key';
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodWJheXBhYm9qb21keWZxeGNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTczMTY3NCwiZXhwIjoyMDUxMzA3Njc0fQ.placeholder-service-key';

// Export fallback URLs for use in other services
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseKey;

// Validate that we have proper keys (not placeholders)
const isValidKey = (key: string) => {
  return key && 
         !key.includes('placeholder') && 
         !key.includes('placeholder-anon-key') &&
         !key.includes('placeholder-service-key') &&
         key.length > 50;
};

if (!supabaseUrl || !isValidKey(supabaseKey)) {
  console.error('❌ Supabase connection error detected. This is expected in the demo environment.');
  console.warn('ℹ️ To enable full functionality, configure your Supabase project:');
  console.warn('1. Click the Supabase button in the settings');
  console.warn('2. Follow the setup instructions');
  console.warn('3. Your environment variables will be automatically configured');
}

// Create dummy client for error cases
const createDummyClient = () => ({
  from: () => ({
    select: () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') }),
    insert: () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') }),
    update: () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') }),
    delete: () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') }),
  }),
  auth: {
    signUp: () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') }),
    signIn: () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') }),
    signOut: () => Promise.resolve({ error: new Error('Supabase client not initialized') }),
    getUser: () => Promise.resolve({ data: { user: null }, error: new Error('Supabase client not initialized') }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
});

// Initialize clients with error handling
let supabase: any;
let supabaseAdmin: any;

try {
  supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'taxibook-customer@1.0.0',
      },
    }
  });
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error);
  supabase = createDummyClient();
}

try {
  supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'a1-taxi-customer-admin@1.0.0',
      },
    }
  });
} catch (error) {
  console.error('❌ Failed to initialize Supabase admin client:', error);
  supabaseAdmin = createDummyClient();
}

// Export the clients
export { supabase, supabaseAdmin };

// Add connection test function
export const testSupabaseConnection = async () => {
  try {
    console.log('🧪 Testing Supabase connection...');
    
    // Check if we're using placeholder keys
    if (!isValidKey(supabaseKey)) {
      console.warn('⚠️ Using placeholder Supabase key - connection will fail');
      return false;
    }
    
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      console.error('❌ Supabase connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection test exception:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};