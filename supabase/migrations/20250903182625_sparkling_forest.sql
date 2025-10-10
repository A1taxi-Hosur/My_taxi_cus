/*
  # Add Sample Drivers and Live Locations for Testing

  1. New Data
    - Sample drivers with different vehicle types
    - Sample live locations near Hosur for testing
    - Sample vehicles for each driver
  
  2. Purpose
    - Enable testing of driver finding functionality
    - Provide realistic location data for development
    - Test distance calculations and filtering
*/

-- Insert sample users for drivers
INSERT INTO users (id, email, full_name, phone_number, role, is_active) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'driver1@test.com', 'Rajesh Kumar', '+91 9876543210', 'driver', true),
  ('550e8400-e29b-41d4-a716-446655440002', 'driver2@test.com', 'Suresh Babu', '+91 9876543211', 'driver', true),
  ('550e8400-e29b-41d4-a716-446655440003', 'driver3@test.com', 'Ramesh Singh', '+91 9876543212', 'driver', true),
  ('550e8400-e29b-41d4-a716-446655440004', 'driver4@test.com', 'Mahesh Reddy', '+91 9876543213', 'driver', true),
  ('550e8400-e29b-41d4-a716-446655440005', 'driver5@test.com', 'Ganesh Patel', '+91 9876543214', 'driver', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample vehicles
INSERT INTO vehicles (id, registration_number, make, model, year, color, vehicle_type, capacity, is_verified) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', 'TN20AB1234', 'Maruti', 'Swift', 2020, 'White', 'hatchback', 4, true),
  ('660e8400-e29b-41d4-a716-446655440002', 'TN20CD5678', 'Honda', 'City', 2021, 'Silver', 'sedan', 4, true),
  ('660e8400-e29b-41d4-a716-446655440003', 'TN20EF9012', 'Mahindra', 'XUV500', 2019, 'Black', 'suv', 7, true),
  ('660e8400-e29b-41d4-a716-446655440004', 'TN20GH3456', 'Hyundai', 'Verna', 2022, 'Blue', 'sedan', 4, true),
  ('660e8400-e29b-41d4-a716-446655440005', 'TN20IJ7890', 'Tata', 'Nexon', 2021, 'Red', 'hatchback', 4, true)
ON CONFLICT (registration_number) DO NOTHING;

-- Insert sample drivers
INSERT INTO drivers (id, user_id, vehicle_id, license_number, license_expiry, status, rating, total_rides, is_verified) VALUES
  ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'TN2020123456', '2025-12-31', 'online', 4.8, 150, true),
  ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 'TN2020123457', '2025-12-31', 'online', 4.6, 200, true),
  ('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', 'TN2020123458', '2025-12-31', 'online', 4.9, 180, true),
  ('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440004', 'TN2020123459', '2025-12-31', 'online', 4.7, 120, true),
  ('770e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440005', 'TN2020123460', '2025-12-31', 'online', 4.5, 90, true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample live locations near Hosur (within 5km radius)
INSERT INTO live_locations (id, user_id, latitude, longitude, heading, speed, accuracy, updated_at) VALUES
  ('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 12.1372, 77.8253, 45.0, 0.0, 5.0, now()),
  ('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 12.1400, 77.8280, 90.0, 0.0, 5.0, now()),
  ('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 12.1350, 77.8220, 180.0, 0.0, 5.0, now()),
  ('880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 12.1390, 77.8270, 270.0, 0.0, 5.0, now()),
  ('880e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 12.1360, 77.8240, 315.0, 0.0, 5.0, now())
ON CONFLICT (id) DO NOTHING;