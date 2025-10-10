/*
  # Add Edge Function Access for Driver Locations

  1. New Policies
    - Allow edge functions to read driver data
    - Allow edge functions to read live locations
    - Allow edge functions to read vehicle data
  
  2. Security
    - Policies specifically for service role access
    - Maintains existing customer/driver policies
    - Secure access for driver location display
*/

-- Allow service role (edge functions) to read all drivers data
CREATE POLICY "Service role can read all drivers"
  ON drivers
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service role (edge functions) to read all live locations
CREATE POLICY "Service role can read all live locations"
  ON live_locations
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service role (edge functions) to read all vehicles
CREATE POLICY "Service role can read all vehicles"
  ON vehicles
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service role (edge functions) to read all users (for driver names)
CREATE POLICY "Service role can read all users"
  ON users
  FOR SELECT
  TO service_role
  USING (true);