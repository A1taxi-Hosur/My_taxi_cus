/*
  # Add sample location data for existing drivers

  1. Purpose
    - Add recent location data for existing online drivers
    - Enable driver visibility on customer map
    - Provide realistic coordinates around Hosur area

  2. Data Added
    - Live locations for all online verified drivers
    - Coordinates within 10km radius of Hosur
    - Recent timestamps (within last 5 minutes)
    - Realistic heading and speed data
*/

-- First, get the user_ids of existing online drivers and add sample locations
INSERT INTO live_locations (id, user_id, latitude, longitude, heading, speed, accuracy, updated_at)
SELECT 
  gen_random_uuid() as id,
  d.user_id,
  -- Generate coordinates around Hosur (12.7402, 77.8240) within 5km radius
  12.7402 + (RANDOM() - 0.5) * 0.05 as latitude,
  77.8240 + (RANDOM() - 0.5) * 0.05 as longitude,
  RANDOM() * 360 as heading,
  RANDOM() * 30 as speed,
  5.0 as accuracy,
  NOW() - (RANDOM() * INTERVAL '5 minutes') as updated_at
FROM drivers d
WHERE d.status = 'online' 
  AND d.is_verified = true
  AND NOT EXISTS (
    SELECT 1 FROM live_locations ll 
    WHERE ll.user_id = d.user_id 
    AND ll.updated_at > NOW() - INTERVAL '10 minutes'
  );

-- Update existing old locations to be recent
UPDATE live_locations 
SET 
  updated_at = NOW() - (RANDOM() * INTERVAL '5 minutes'),
  latitude = 12.7402 + (RANDOM() - 0.5) * 0.05,
  longitude = 77.8240 + (RANDOM() - 0.5) * 0.05,
  heading = RANDOM() * 360,
  speed = RANDOM() * 30
WHERE updated_at < NOW() - INTERVAL '10 minutes'
  AND user_id IN (
    SELECT user_id FROM drivers 
    WHERE status = 'online' AND is_verified = true
  );