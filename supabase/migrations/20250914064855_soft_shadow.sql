/*
  # Add ride completion trigger for notifications

  1. New Functions
    - `notify_ride_completion()` - Trigger function to send completion notifications
  
  2. New Triggers
    - `ride_completion_trigger` - Fires when ride status changes to 'completed'
  
  3. Purpose
    - Automatically sends detailed completion notifications when driver completes a ride
    - Includes fare breakdown, driver details, and trip information
*/

-- Create function to handle ride completion notifications
CREATE OR REPLACE FUNCTION notify_ride_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for rides that are being marked as completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Call the ride completion webhook to send detailed notification
    PERFORM
      net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/ride-completion-webhook/notify-completion',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
        ),
        body := jsonb_build_object(
          'rideId', NEW.id,
          'status', NEW.status,
          'fare_amount', NEW.fare_amount,
          'distance_km', NEW.distance_km,
          'duration_minutes', NEW.duration_minutes,
          'driver_id', NEW.driver_id
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for ride completion
DROP TRIGGER IF EXISTS ride_completion_trigger ON rides;
CREATE TRIGGER ride_completion_trigger
  AFTER UPDATE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION notify_ride_completion();