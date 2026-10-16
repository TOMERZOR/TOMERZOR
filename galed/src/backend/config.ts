// The app runs against Supabase when both values are set at build time
// (see .env.example); otherwise it runs as a demo with sample data.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isLive = Boolean(supabaseUrl && supabaseKey);
