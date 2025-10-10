/*
  # Add real-time triggers and functions

  1. Functions
    - `notify_ride_changes()` - Triggers notifications on ride status changes
    - `notify_location_updates()` - Triggers notifications on location updates
    - `cleanup_old_locations()` - Cleans up old location data

  2. Triggers
    - Ride status change notifications
    - Location update notifications
    - Automatic cleanup triggers

  3. Indexes
    - Performance indexes for real-time queries
*/

-- Function to notify ride changes
CREATE OR REPLACE FUNCTION notify_ride_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM pg_notify(
      'ride_status_change',
      json_build_object(
        'ride_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'customer_id', NEW.customer_id,
        'driver_id', NEW.driver_id
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to notify location updates
CREATE OR REPLACE FUNCTION notify_location_updates()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'location_update',
    json_build_object(
      'user_id', NEW.user_id,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude,
      'heading', NEW.heading,
      'speed', NEW.speed,
      'updated_at', NEW.updated_at
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old location data
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS TRIGGER AS $$
BEGIN
  -- Keep only the last 10 location records per user
  DELETE FROM live_locations 
  WHERE user_id = NEW.user_id 
  AND id NOT IN (
    SELECT id FROM live_locations 
    WHERE user_id = NEW.user_id 
    ORDER BY updated_at DESC 
    LIMIT 10
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS ride_status_change_trigger ON rides;
CREATE TRIGGER ride_status_change_trigger
  AFTER UPDATE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION notify_ride_changes();

DROP TRIGGER IF EXISTS location_update_trigger ON live_locations;
CREATE TRIGGER location_update_trigger
  AFTER INSERT OR UPDATE ON live_locations
  FOR EACH ROW
  EXECUTE FUNCTION notify_location_updates();

DROP TRIGGER IF EXISTS cleanup_locations_trigger ON live_locations;
CREATE TRIGGER cleanup_locations_trigger
  AFTER INSERT ON live_locations
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_locations();

-- Add performance indexes for real-time queries
CREATE INDEX IF NOT EXISTS idx_rides_realtime_status 
ON rides (status, customer_id, driver_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_live_locations_realtime 
ON live_locations (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_realtime 
ON notifications (user_id, status, created_at DESC);

-- Add index for driver availability queries
CREATE INDEX IF NOT EXISTS idx_drivers_availability 
ON drivers (status, is_verified, user_id) 
WHERE status = 'online' AND is_verified = true;