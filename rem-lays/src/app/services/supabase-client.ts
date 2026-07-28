import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// Single shared client for the whole app. RLS on the `devices` and `items`
// tables (see supabase/migrations) is what actually enforces per-user
// scoping — this anon key is safe to ship in the client by design.
export const supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
