// ─── Supabase auth helpers ────────────────────────────────────────────────────
// IMPORTANT — Supabase dashboard setup:
//   • Authentication → Providers → Email: enabled (default)
//   • Authentication → Providers → Google: enabled, with Client ID + Secret
//     from Google Cloud Console, redirect URI:
//       https://<project>.supabase.co/auth/v1/callback
//   • Authentication → Providers → Anonymous: enabled (used for guests)
//
// Security notes:
//   • Passwords are never stored client-side — Supabase handles auth tokens.
//   • Tokens persist via AsyncStorage (configured in src/lib/supabase.ts).
//   • Google OAuth tokens are managed by Supabase, never exposed to app code.
//   • Guest sessions use Supabase anonymous auth — zero PII stored.
//
// TODO (post-MVP) — Supabase RLS:
//   create policy "users can read/write own row"
//     on public.users for all
//     using (auth.uid() = id);
// ──────────────────────────────────────────────────────────────────────────────

import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export interface AppUser {
	id: string;
	display_name: string;
	avatar_color: string;
	lang: string;
}

const DEFAULT_DISPLAY_NAME = "Driver";
const DEFAULT_AVATAR_COLOR = "#1a1a1a";

// ─── Anonymous / guest session ────────────────────────────────────────────────

/**
 * Ensures we have a Supabase session (anonymous if none exists) and a matching
 * row in public.users. Used as the legacy/guest entry point. Returns the
 * public.users row.
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

	return await ensureUserRow(userId);
}

/** Idempotent — returns the row whether it already existed or was just made. */
export async function ensureUserRow(
	userId: string,
	overrides?: Partial<Pick<AppUser, "display_name" | "avatar_color">>,
): Promise<AppUser> {
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
			display_name: overrides?.display_name ?? DEFAULT_DISPLAY_NAME,
			avatar_color: overrides?.avatar_color ?? DEFAULT_AVATAR_COLOR,
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

// ─── Email auth ───────────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string) {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});
	if (error) throw error;
	if (!data.user) throw new Error("Sign-in failed: no user returned.");
	await ensureUserRow(data.user.id, {
		display_name: data.user.user_metadata?.display_name as string | undefined,
	});
	return data.user;
}

export async function signUpWithEmail(
	email: string,
	password: string,
	displayName: string,
) {
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: { data: { display_name: displayName } },
	});
	if (error) throw error;
	if (!data.user) throw new Error("Sign-up failed: no user returned.");
	await ensureUserRow(data.user.id, {
		display_name: displayName,
	});
	return data.user;
}

// ─── Google OAuth (PKCE via expo-auth-session) ────────────────────────────────

export async function signInWithGoogle(): Promise<void> {
	const redirectUri = makeRedirectUri({ scheme: "convoi" });

	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: {
			redirectTo: redirectUri,
			skipBrowserRedirect: true,
		},
	});
	if (error) throw error;
	if (!data?.url) throw new Error("No OAuth URL returned from Supabase.");

	const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

	if (res.type !== "success") {
		// User dismissed or system cancelled — not an error worth surfacing.
		throw new Error("Google sign-in cancelled.");
	}

	const { params, errorCode } = QueryParams.getQueryParams(res.url);
	if (errorCode) throw new Error(errorCode);

	const { access_token, refresh_token } = params;
	if (!access_token || !refresh_token) {
		throw new Error("Missing tokens from Google OAuth callback.");
	}

	const { data: sessionData, error: sessionErr } =
		await supabase.auth.setSession({ access_token, refresh_token });
	if (sessionErr) throw sessionErr;

	const user = sessionData.user;
	if (user) {
		await ensureUserRow(user.id, {
			display_name:
				(user.user_metadata?.full_name as string | undefined) ??
				(user.user_metadata?.name as string | undefined) ??
				user.email?.split("@")[0],
		});
	}
}
