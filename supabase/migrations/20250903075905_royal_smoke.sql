/*
  # Add vehicle_type column to rides table

  1. Schema Changes
    - Add `vehicle_type` column to `rides` table
    - Set default value and add check constraint for valid vehicle types
    - Update existing records with default value

  2. Security
    - No RLS changes needed as table already has RLS enabled
*/

-- Add vehicle_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'vehicle_type'
  ) THEN
    ALTER TABLE rides ADD COLUMN vehicle_type text DEFAULT 'sedan';
  END IF;
END $$;

-- Add check constraint for valid vehicle types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'rides_vehicle_type_check'
  ) THEN
    ALTER TABLE rides ADD CONSTRAINT rides_vehicle_type_check 
    CHECK (vehicle_type = ANY (ARRAY['sedan'::text, 'suv'::text, 'hatchback'::text, 'auto'::text, 'bike'::text]));
  END IF;
END $$;

-- Update any existing records that might have null vehicle_type
UPDATE rides SET vehicle_type = 'sedan' WHERE vehicle_type IS NULL;