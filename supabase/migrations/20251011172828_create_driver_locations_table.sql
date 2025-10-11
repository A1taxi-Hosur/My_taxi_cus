/*
  # Create driver_locations table for real-time GPS tracking

  1. New Tables
    - `driver_locations`
      - `driver_id` (uuid, primary key) - References drivers table
      - `latitude` (decimal) - Current latitude coordinate
      - `longitude` (decimal) - Current longitude coordinate
      - `heading` (decimal) - Direction in degrees (0-360)
      - `speed` (decimal) - Current speed in km/h
      - `accuracy` (decimal) - GPS accuracy in meters
      - `updated_at` (timestamptz) - Last update timestamp
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `driver_locations` table
    - Allow drivers to update their own location
    - Allow authenticated users to read driver locations
    - Allow service role to manage all locations (for simulations)

  3. Indexes
    - Index on `driver_id` for fast lookups
    - Index on `updated_at` for sorting by recency

  4. Notes
    - Uses UPSERT pattern for efficient updates
    - Real-time updates enabled for live tracking
    - Stores only current location (not history)
*/

-- Create driver_locations table
CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id uuid PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  heading decimal(5, 2) DEFAULT 0,
  speed decimal(5, 2) DEFAULT 0,
  accuracy decimal(5, 2) DEFAULT 0,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Create policies for driver_locations
CREATE POLICY "Drivers can update own location"
  ON driver_locations
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

CREATE POLICY "Drivers can insert own location"
  ON driver_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view driver locations"
  ON driver_locations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage all locations"
  ON driver_locations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id 
  ON driver_locations(driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_locations_updated_at 
  ON driver_locations(updated_at DESC);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
DROP TRIGGER IF EXISTS update_driver_locations_timestamp ON driver_locations;
CREATE TRIGGER update_driver_locations_timestamp
  BEFORE UPDATE ON driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_location_timestamp();

-- Add comment to table
COMMENT ON TABLE driver_locations IS 'Stores real-time GPS location data for drivers. Used for live tracking by customers.';
