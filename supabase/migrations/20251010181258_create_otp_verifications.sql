/*
  # Create OTP Verifications Table

  1. New Tables
    - `otp_verifications`
      - `id` (uuid, primary key)
      - `phone_number` (text, not null) - User's phone number
      - `otp_code` (text, not null) - 6-digit OTP code
      - `name` (text, not null) - User's name for registration
      - `verified` (boolean, default false) - Whether OTP has been verified
      - `expires_at` (timestamptz, not null) - Expiration time for OTP
      - `created_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `otp_verifications` table
    - No public access policies (server-side only access via service role)
  
  3. Indexes
    - Index on phone_number for faster lookups
    - Index on expires_at for cleanup operations
  
  4. Notes
    - OTP codes are valid for 10 minutes
    - Table is used for temporary storage during authentication flow
    - Access restricted to server-side operations only
*/

CREATE TABLE IF NOT EXISTS otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_code text NOT NULL,
  name text NOT NULL,
  verified boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON otp_verifications(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);

CREATE POLICY "Service role has full access"
  ON otp_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);