import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// TODO: Replace with your actual Supabase project URL and anon key
// Get these from: https://supabase.com → your project → Settings → API
const SUPABASE_URL = "https://cotrvpyhdlpozcwxhdyx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4w0Jje0AnvVL35UyRRmktQ_Ywurlw69";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: {
		
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});
