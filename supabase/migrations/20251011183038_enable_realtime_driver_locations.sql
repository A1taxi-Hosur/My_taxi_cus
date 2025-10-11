/*
  # Enable Realtime for driver_locations table

  This migration enables Supabase Realtime functionality for the driver_locations table
  so that clients can subscribe to real-time updates when driver positions change.

  ## Changes:
  - Enable realtime replication for driver_locations table via supabase_realtime publication

  ## Why:
  - Required for live GPS tracking in the customer app
  - Allows real-time marker updates on the map as drivers move
  - Essential for the simulation testing to work properly
*/

-- Enable realtime for driver_locations table
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
