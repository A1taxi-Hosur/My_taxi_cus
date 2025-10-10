/*
  # Update rides table schema for workflow

  1. Schema Updates
    - Add missing columns for proper ride workflow
    - Update status enum to include driver_arrived
    - Add ride_code column for unique identification
    - Fix column names to match database schema

  2. Indexes
    - Add indexes for efficient querying

  3. Security
    - Update RLS policies for new workflow
*/

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add ride_code column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'ride_code'
  ) THEN
    ALTER TABLE rides ADD COLUMN ride_code text UNIQUE;
  END IF;

  -- Update status constraint to include driver_arrived
  ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
  ALTER TABLE rides ADD CONSTRAINT rides_status_check 
    CHECK (status = ANY (ARRAY['requested'::text, 'accepted'::text, 'driver_arrived'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'no_drivers_available'::text]));

END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rides_ride_code ON rides(ride_code);
CREATE INDEX IF NOT EXISTS idx_rides_status_customer ON rides(status, customer_id);
CREATE INDEX IF NOT EXISTS idx_rides_status_driver ON rides(status, driver_id);

-- Update RLS policies for better workflow support
DROP POLICY IF EXISTS "Customers can create rides" ON rides;
CREATE POLICY "Customers can create rides"
  ON rides
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own rides" ON rides;
CREATE POLICY "Users can read own rides"
  ON rides
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid() OR 
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can update assigned rides" ON rides;
CREATE POLICY "Drivers can update assigned rides"
  ON rides
  FOR UPDATE
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

-- Allow customers to update their own rides (for cancellation)
CREATE POLICY "Customers can update own rides"
  ON rides
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());