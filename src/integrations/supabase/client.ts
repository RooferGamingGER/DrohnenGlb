
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://izxnwueltpkfarlqdovn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6eG53dWVsdHBrZmFybHFkb3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MTQ0MjAsImV4cCI6MjA1NzI5MDQyMH0.CDSkOGYnr3qpcYJ2VM2m560fbJebumGCzlB8HqNP42U";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
