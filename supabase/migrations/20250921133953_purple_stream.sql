/*
  # Fix Service Role Access for Driver Data

  1. Security Changes
    - Add service role policies for drivers table
    - Add service role policies for live_locations table  
    - Add service role policies for vehicles table
    - Add service role policies for users table
    - Ensure edge functions can access all driver-related data

  2. Purpose
    - Allow get-available-drivers edge function to fetch driver data
    - Bypass RLS restrictions for service role operations
    - Enable real-time driver location display on customer app
*/

-- Add service role policies for drivers table
CREATE POLICY "Service role can read all drivers for edge functions"
  ON drivers
  FOR SELECT
  TO service_role
  USING (true);

-- Add service role policies for live_locations table  
CREATE POLICY "Service role can read all live locations for edge functions"
  ON live_locations
  FOR SELECT
  TO service_role
  USING (true);

-- Add service role policies for vehicles table
CREATE POLICY "Service role can read all vehicles for edge functions"
  ON vehicles
  FOR SELECT
  TO service_role
  USING (true);

-- Add service role policies for users table (for driver names)
CREATE POLICY "Service role can read all users for edge functions"
  ON users
  FOR SELECT
  TO service_role
  USING (true);

-- Verify the policies were created
DO $$
BEGIN
  -- Check if policies exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' 
    AND policyname = 'Service role can read all drivers for edge functions'
  ) THEN
    RAISE NOTICE 'Service role driver policy created successfully';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'live_locations' 
    AND policyname = 'Service role can read all live locations for edge functions'
  ) THEN
    RAISE NOTICE 'Service role live_locations policy created successfully';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'vehicles' 
    AND policyname = 'Service role can read all vehicles for edge functions'
  ) THEN
    RAISE NOTICE 'Service role vehicles policy created successfully';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Service role can read all users for edge functions'
  ) THEN
    RAISE NOTICE 'Service role users policy created successfully';
  END IF;
END $$;