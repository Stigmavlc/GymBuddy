-- Fix RLS policies to allow bot synchronization
-- Generated: August 7, 2025

-- Add service role policy for availability table
CREATE POLICY "Service role can manage all availability" 
ON availability 
FOR ALL 
TO public 
USING (auth.role() = 'service_role'::text) 
WITH CHECK (auth.role() = 'service_role'::text);

-- Add service role policy for sessions table  
CREATE POLICY "Service role can manage all sessions"
ON sessions
FOR ALL  
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Add service role policy for users table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Service role can manage all users'
  ) THEN
    CREATE POLICY "Service role can manage all users" 
    ON users 
    FOR ALL 
    TO public 
    USING (auth.role() = 'service_role'::text) 
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END $$;

-- Verify policies were created
SELECT 
  tablename, 
  policyname, 
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('availability', 'sessions', 'users') 
  AND policyname LIKE '%Service role%'
ORDER BY tablename, policyname;