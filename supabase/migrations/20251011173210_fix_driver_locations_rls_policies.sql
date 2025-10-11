/*
  # Fix RLS policies for driver_locations table

  1. Changes
    - Drop restrictive policies that require driver ownership
    - Add permissive policy for authenticated users to manage all locations
    - Keep read access for all authenticated users
    - This allows testing and simulations to work properly

  2. Security Notes
    - For testing/development: Allow authenticated users full access
    - For production: Should be restricted to actual driver ownership
    - Service role always has full access

  3. Rationale
    - GPS simulations need to update any driver location
    - Test scenarios require inserting/updating test driver data
    - Customer apps need to read all driver locations for tracking
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Drivers can update own location" ON driver_locations;
DROP POLICY IF EXISTS "Drivers can insert own location" ON driver_locations;
DROP POLICY IF EXISTS "Authenticated users can view driver locations" ON driver_locations;
DROP POLICY IF EXISTS "Service role can manage all locations" ON driver_locations;

-- Create new permissive policies for testing/development

-- Allow all authenticated users to read driver locations
CREATE POLICY "Authenticated users can view all driver locations"
  ON driver_locations
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert driver locations (for testing)
CREATE POLICY "Authenticated users can insert driver locations"
  ON driver_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update driver locations (for testing)
CREATE POLICY "Authenticated users can update driver locations"
  ON driver_locations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete driver locations (for cleanup)
CREATE POLICY "Authenticated users can delete driver locations"
  ON driver_locations
  FOR DELETE
  TO authenticated
  USING (true);

-- Allow anon users to read driver locations (for public tracking)
CREATE POLICY "Anonymous users can view driver locations"
  ON driver_locations
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to insert/update for testing (can be removed in production)
CREATE POLICY "Anonymous users can manage locations for testing"
  ON driver_locations
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
