# Fix Row Level Security (RLS) Issues

The current RLS policies prevent users from seeing their partner's data. Here are 3 solutions:

## Solution 1: Update RLS Policies (Recommended)

This allows users to see their partner's data while maintaining security.

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your GymBuddy project
3. Click on "SQL Editor" in the left menu

### Step 2: Run These SQL Commands
Copy and paste each command one by one:

```sql
-- 1. Allow users to see their partner's profile
CREATE POLICY "Users can view their partner's profile" ON public.users
    FOR SELECT USING (
        id IN (
            SELECT partner_id FROM public.users WHERE id = auth.uid()
        )
    );

-- 2. Allow users to see their partner's availability
CREATE POLICY "Users can view their partner's availability" ON public.availability
    FOR SELECT USING (
        user_id IN (
            SELECT partner_id FROM public.users WHERE id = auth.uid()
        )
    );

-- 3. For testing: Allow Ivan to see all users (temporary)
CREATE POLICY "Ivan can see all users for testing" ON public.users
    FOR SELECT USING (
        auth.email() = 'ivanaguilarmari@gmail.com'
    );

CREATE POLICY "Ivan can see all availability for testing" ON public.availability
    FOR SELECT USING (
        auth.email() = 'ivanaguilarmari@gmail.com'
    );
```

### Step 3: Link Ivan and Youssef as Partners
```sql
-- Update both users to be partners
UPDATE public.users 
SET partner_id = (SELECT id FROM public.users WHERE email = 'youssef.dummy@test.com')
WHERE email = 'ivanaguilarmari@gmail.com';

UPDATE public.users 
SET partner_id = (SELECT id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com')
WHERE email = 'youssef.dummy@test.com';
```

## Solution 2: Use Service Role Key (Quick Testing)

This bypasses RLS completely - use only for testing!

### Step 1: Get Service Role Key
1. In Supabase Dashboard → Settings → API
2. Copy the "service_role" key (NOT anon key)
3. ⚠️ WARNING: This key bypasses all security!

### Step 2: Add to .env (TESTING ONLY)
```bash
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 3: Create Test Service
Create a new file: `src/services/testSupabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

// Only use for testing!
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

## Solution 3: Temporarily Disable RLS (Not Recommended)

⚠️ This removes ALL security - use only as last resort!

```sql
-- Disable RLS (NOT RECOMMENDED)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability DISABLE ROW LEVEL SECURITY;

-- To re-enable later:
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
```

## Testing After Fix

### 1. Test in Your App
```bash
npm run dev
```
Go to: http://localhost:5173/test-whatsapp

### 2. Check if Both Users Are Visible
You should see:
- Ivan: ivanaguilarmari@gmail.com
- Youssef: youssef.dummy@test.com

### 3. Verify WhatsApp Flow
The test page should show:
- "✓ Both users have set availability"
- Common availability slots
- WhatsApp message preview

## Troubleshooting

### "Policy already exists" Error
Drop the old policy first:
```sql
DROP POLICY IF EXISTS "policy_name" ON public.table_name;
```

### Still Can't See Test User
Check if test user exists:
```sql
SELECT * FROM public.users WHERE email = 'youssef.dummy@test.com';
```

### Create Test User If Missing
```sql
-- Create test user with proper UUID
INSERT INTO public.users (id, email, name, phone_number)
VALUES (
    gen_random_uuid(),
    'youssef.dummy@test.com',
    'Youssef Test',
    '+447123456789'
);
```

## Which Solution to Choose?

- **Development/Testing**: Use Solution 1 (update policies)
- **Quick Demo**: Use Solution 2 (service role key)
- **Never in Production**: Solution 3 (disable RLS)

The RLS policies are there for security - they prevent users from seeing other people's data. We're just adjusting them to allow partners to see each other's information!