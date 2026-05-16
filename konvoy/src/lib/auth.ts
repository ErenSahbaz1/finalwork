// ─── Supabase setup ────────────────────────────────────────────────────────────
// IMPORTANT: Anonymous auth must be enabled in the Supabase dashboard before
// this code will work:
//   Supabase dashboard → Authentication → Providers → Anonymous → Enable
//
// TODO (post-MVP): now that we have real auth, add an RLS policy on public.users:
//   create policy "users can read/write own row"
//     on public.users for all
//     using (auth.uid() = id);
// ────────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

export interface AppUser {
	id: string;
	display_name: string;
	avatar_color: string;
	lang: string;
}

const DEFAULT_DISPLAY_NAME = "Driver";
const DEFAULT_AVATAR_COLOR = "#33a86d";

/**
 * Ensures we have an anonymous Supabase session and a matching row in
 * public.users. Safe to call on every app start — it's idempotent.
 * Returns the public.users row.
 */
export async function getOrCreateUser(): Promise<AppUser> {
	const { data: sessionData } = await supabase.auth.getSession();
	let session = sessionData.session;

	if (!session) {
		const { data, error } = await supabase.auth.signInAnonymously();
		if (error) throw error;
		session = data.session;
	}

	const userId = session?.user?.id;
	if (!userId) throw new Error("Failed to create anonymous session.");

	const { data: existing, error: lookupErr } = await supabase
		.from("users")
		.select("id, display_name, avatar_color, lang")
		.eq("id", userId)
		.maybeSingle();
	if (lookupErr) throw lookupErr;

	if (existing) return existing as AppUser;

	const { data: inserted, error: insertErr } = await supabase
		.from("users")
		.insert({
			id: userId,
			display_name: DEFAULT_DISPLAY_NAME,
			avatar_color: DEFAULT_AVATAR_COLOR,
			lang: "en",
		})
		.select("id, display_name, avatar_color, lang")
		.single();
	if (insertErr) throw insertErr;

	return inserted as AppUser;
}

export async function getCurrentUserId(): Promise<string | null> {
	const { data } = await supabase.auth.getUser();
	return data.user?.id ?? null;
}

export async function signOut(): Promise<void> {
	await supabase.auth.signOut();
}
