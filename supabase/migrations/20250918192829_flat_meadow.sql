/*
  # Add trigger for scheduled booking completion notifications

  1. New Functions
    - `notify_scheduled_booking_completion()` - Trigger function to send completion notifications for scheduled bookings
  
  2. New Triggers
    - Trigger on scheduled_bookings table when status changes to 'completed'
    - Calls webhook to notify customer of trip completion
  
  3. Purpose
    - Ensures customers get in-app notifications when outstation, rental, and airport trips are completed
    - Provides fare details and trip summary in the notification
*/

-- Function to notify scheduled booking completion
CREATE OR REPLACE FUNCTION notify_scheduled_booking_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for completed bookings
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Call the ride completion webhook for scheduled bookings
    PERFORM
      net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/ride-completion-webhook/notify-completion',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
        ),
        body := jsonb_build_object(
          'bookingId', NEW.id,
          'status', NEW.status,
          'fare_amount', COALESCE(NEW.estimated_fare, 0),
          'distance_km', COALESCE(
            -- Calculate distance from coordinates if available
            CASE 
              WHEN NEW.pickup_latitude IS NOT NULL AND NEW.pickup_longitude IS NOT NULL 
                   AND NEW.destination_latitude IS NOT NULL AND NEW.destination_longitude IS NOT NULL
              THEN ST_Distance(
                ST_Point(NEW.pickup_longitude, NEW.pickup_latitude)::geography,
                ST_Point(NEW.destination_longitude, NEW.destination_latitude)::geography
              ) / 1000.0
              ELSE 0
            END, 0
          ),
          'duration_minutes', COALESCE(
            -- Estimate duration based on booking type
            CASE 
              WHEN NEW.booking_type = 'rental' THEN NEW.rental_hours * 60
              WHEN NEW.booking_type = 'outstation' THEN 180 -- 3 hours average
              WHEN NEW.booking_type = 'airport' THEN 90 -- 1.5 hours average
              ELSE 60
            END, 60
          ),
          'driver_id', NEW.assigned_driver_id,
          'booking_type', NEW.booking_type
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for scheduled booking completion
DROP TRIGGER IF EXISTS scheduled_booking_completion_trigger ON scheduled_bookings;
CREATE TRIGGER scheduled_booking_completion_trigger
  AFTER UPDATE ON scheduled_bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_scheduled_booking_completion();

-- Also ensure the ride completion trigger exists for regular rides
CREATE OR REPLACE FUNCTION notify_ride_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for completed rides
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Call the ride completion webhook
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
          'fare_amount', COALESCE(NEW.fare_amount, 0),
          'distance_km', COALESCE(NEW.distance_km, 0),
          'duration_minutes', COALESCE(NEW.duration_minutes, 0),
          'driver_id', NEW.driver_id,
          'booking_type', NEW.booking_type
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure ride completion trigger exists
DROP TRIGGER IF EXISTS ride_completion_trigger ON rides;
CREATE TRIGGER ride_completion_trigger
  AFTER UPDATE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION notify_ride_completion();