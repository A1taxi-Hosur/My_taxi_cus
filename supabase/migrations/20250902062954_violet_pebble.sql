/*
  # Fix infinite recursion in users table RLS policies

  1. Security Changes
    - Drop the problematic admin policy that causes infinite recursion
    - Create a new admin policy that uses auth.jwt() to check role claims
    - Keep existing user policies intact

  2. Notes
    - The infinite recursion was caused by the admin policy querying the users table 
      while being applied to the same table
    - The new policy uses JWT claims which avoids the circular reference
*/

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "admins_can_read_all_users" ON users;

-- Create a new admin policy using JWT claims to avoid recursion
CREATE POLICY "admins_can_read_all_users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_role')::text = 'admin'
    OR auth.uid() = id
  );