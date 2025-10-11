/*
  # Add cancellation_reason column to scheduled_bookings

  1. Changes
    - Add `cancellation_reason` column to `scheduled_bookings` table
      - Type: text
      - Nullable: true (only set when cancelled)
      - Purpose: Store reason why booking was cancelled
  
  2. Purpose
    - Track cancellation reasons for analytics and customer service
    - Help understand why bookings are cancelled
    - Provide context for refunds or disputes
*/

-- Add cancellation_reason column to scheduled_bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_bookings' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE scheduled_bookings ADD COLUMN cancellation_reason text;
  END IF;
END $$;
