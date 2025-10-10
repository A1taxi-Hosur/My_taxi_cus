/*
  # Fix infinite recursion in users table RLS policies

  1. Problem
    - Current RLS policies on users table contain recursive queries
    - Policies reference the users table within their own conditions
    - This causes infinite recursion when querying user data

  2. Solution
    - Drop all existing problematic policies
    - Create simple, non-recursive policies using auth.uid() directly
    - Ensure policies don't query the users table within their conditions

  3. New Policies
    - Users can read their own profile using auth.uid() = id
    - Users can update their own profile using auth.uid() = id
    - Users can insert their own profile using auth.uid() = id
    - Admins can manage all users (simplified condition)
*/

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "users_can_read_own_profile" ON users;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON users;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON users;
DROP POLICY IF EXISTS "admins_can_read_all_users" ON users;
DROP POLICY IF EXISTS "admins_can_manage_all_users" ON users;
DROP POLICY IF EXISTS "Admins can insert driver users" ON users;

-- Create simple, non-recursive policies
CREATE POLICY "users_can_read_own_profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_can_update_own_profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_can_insert_own_profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Simple admin policy using JWT claims instead of recursive query
CREATE POLICY "admins_can_manage_all_users"
  ON users
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');