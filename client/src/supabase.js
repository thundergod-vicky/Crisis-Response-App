import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tahiyvkmkokhdjkcohmx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GrUYyFz6S_jufKe3MS3aLw_6QVUaQ9O';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
