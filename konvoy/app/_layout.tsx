import { useCallback, useEffect, useState } from "react";
import {
	View,
	Text,
	ActivityIndicator,
	StyleSheet,
	Pressable,
	LogBox,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
	Stack,
	useRouter,
	useSegments,
	usePathname,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Spacing,
} from "../src/constants/theme";
import { FadeInView } from "../src/components/FadeInView";
import { SoftBackground } from "../src/components/SoftBackground";
import { ensureUserRow } from "../src/lib/auth";
import { supabase } from "../src/lib/supabase";
import { useUserStore } from "../src/store/userStore";

const ONBOARDED_KEY = "convoi_onboarded";

// Silence the known-benign warning from react-native-google-places-autocomplete
// rendering its (very short) suggestion FlatList inside the propose-stop
// ScrollView. Windowing matters for long lists; a 5-row dropdown is fine.
LogBox.ignoreLogs([
	"VirtualizedLists should never be nested inside plain ScrollViews",
]);

// Routes that require a real (non-guest) authenticated session.
const AUTH_REQUIRED_PREFIXES = ["/plan", "/convoy/create", "/settings"];
// Routes that should redirect to / when a logged-in user lands on them.
const AUTH_ONLY_WHEN_LOGGED_OUT = ["/auth"];

export default function RootLayout() {
	const router = useRouter();
	const pathname = usePathname();
	const segments = useSegments();

	const setUser = useUserStore((s) => s.setUser);
	const setEmail = useUserStore((s) => s.setEmail);
	const setLoading = useUserStore((s) => s.setLoading);
	const setOnboarded = useUserStore((s) => s.setOnboarded);
	const setAuthenticated = useUserStore((s) => s.setAuthenticated);
	const setGuest = useUserStore((s) => s.setGuest);
	const isAuthenticated = useUserStore((s) => s.isAuthenticated);
	const isGuest = useUserStore((s) => s.isGuest);

	const [ready, setReady] = useState(false);
	const [error, setError] = useState("");
	const [attempt, setAttempt] = useState(0);

	// ─── Bootstrap: restore session + onboarded flag ─────────────────────────
	const bootstrap = useCallback(async () => {
		try {
			setError("");
			setLoading(true);

			const onboardedRaw = await AsyncStorage.getItem(ONBOARDED_KEY);
			setOnboarded(onboardedRaw === "true");

			const { data: sessionData } = await supabase.auth.getSession();
			const session = sessionData?.session;

			if (session?.user) {
				const isAnon = (session.user as any).is_anonymous === true;
				const row = await ensureUserRow(session.user.id, {
					display_name:
						(session.user.user_metadata?.display_name as string | undefined) ??
						(session.user.user_metadata?.full_name as string | undefined),
				});
				setUser(row.id, row.display_name, row.avatar_color);
				setEmail(session.user.email ?? null);
				setAuthenticated(!isAnon);
				setGuest(isAnon);
			} else {
				setAuthenticated(false);
				setGuest(false);
				setLoading(false);
			}

			setReady(true);
		} catch (e: any) {
			const msg =
				typeof e?.message === "string" && e.message.length > 0
					? e.message
					: "Couldn't restore your session. Check your connection and try again.";
			setError(msg);
			setLoading(false);
		}
	}, [
		setUser,
		setEmail,
		setLoading,
		setOnboarded,
		setAuthenticated,
		setGuest,
	]);

	useEffect(() => {
		bootstrap();
	}, [bootstrap, attempt]);

	// ─── Subscribe to auth state changes (login/logout) ──────────────────────
	useEffect(() => {
		const { data: sub } = supabase.auth.onAuthStateChange(
			async (event, session) => {
				if (session?.user) {
					const isAnon = (session.user as any).is_anonymous === true;
					try {
						const row = await ensureUserRow(session.user.id, {
							display_name:
								(session.user.user_metadata?.display_name as
									| string
									| undefined) ??
								(session.user.user_metadata?.full_name as string | undefined),
						});
						setUser(row.id, row.display_name, row.avatar_color);
					} catch {
						// non-fatal
					}
					setEmail(session.user.email ?? null);
					setAuthenticated(!isAnon);
					setGuest(isAnon);
				} else if (event === "SIGNED_OUT") {
					setAuthenticated(false);
					setGuest(false);
					setEmail(null);
				}
			},
		);
		return () => {
			sub.subscription.unsubscribe();
		};
	}, [setAuthenticated, setEmail, setGuest, setUser]);

	// ─── Route protection ────────────────────────────────────────────────────
	useEffect(() => {
		if (!ready) return;
		const path = pathname ?? "/" + (segments.join("/") || "");
		const inAuthRoute = path.startsWith("/auth");
		const needsAuth = AUTH_REQUIRED_PREFIXES.some((p) => path.startsWith(p));

		// Logged-in users shouldn't sit on /auth.
		if (isAuthenticated && AUTH_ONLY_WHEN_LOGGED_OUT.includes(path)) {
			router.replace("/");
			return;
		}

		// Block auth-required routes for non-authenticated users (guests count
		// as not authenticated for these routes).
		if (needsAuth && !isAuthenticated) {
			router.replace("/auth");
			return;
		}

		// If user is not authenticated AND not a guest AND not already on /auth,
		// send them to the auth screen as the starting point.
		if (!isAuthenticated && !isGuest && !inAuthRoute && path !== "/") {
			// Allow /convoy/join (guest path) explicitly
			if (!path.startsWith("/convoy/join")) {
				router.replace("/auth");
			}
		}
	}, [ready, pathname, segments, isAuthenticated, isGuest, router]);

	// ─── Loading screen ──────────────────────────────────────────────────────
	if (!ready) {
		return (
			<View style={styles.bootRoot}>
				<SoftBackground />
				<StatusBar style="dark" />
				<FadeInView style={styles.bootContent}>
					<Text style={styles.bootLogo}>Convoi</Text>
					{error ? (
						<>
							<Text style={styles.bootError}>{error}</Text>
							<Pressable
								onPress={() => setAttempt((n) => n + 1)}
								style={styles.retryBtn}
								hitSlop={8}
							>
								<Text style={styles.retryText}>Retry</Text>
							</Pressable>
						</>
					) : (
						<ActivityIndicator color={Colors.primary} size="large" />
					)}
				</FadeInView>
			</View>
		);
	}

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<StatusBar style="dark" />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: Colors.bg },
					animation: "slide_from_right",
				}}
			>
				<Stack.Screen name="index" />
				<Stack.Screen
					name="auth/index"
					options={{ animation: "fade" }}
				/>
				<Stack.Screen name="onboarding/index" />
				<Stack.Screen name="onboarding/permissions" />
				<Stack.Screen name="onboarding/profile" />
				<Stack.Screen name="onboarding/privacy" />
				<Stack.Screen name="convoy/create" />
				<Stack.Screen name="convoy/join" />
				<Stack.Screen name="convoy/[id]/lobby" />
				<Stack.Screen name="convoy/[id]/map" />
				<Stack.Screen name="convoy/[id]/stops" />
				<Stack.Screen name="convoy/fuel/index" />
				<Stack.Screen name="plan/index" />
				<Stack.Screen name="plan/step1" />
				<Stack.Screen name="plan/step2" />
				<Stack.Screen name="plan/step3" />
				<Stack.Screen name="plan/step4" />
				<Stack.Screen name="plan/step5" />
				<Stack.Screen name="plan/results" />
				<Stack.Screen name="settings/index" />
			</Stack>
		</GestureHandlerRootView>
	);
}

const styles = StyleSheet.create({
	bootRoot: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.bg,
		gap: Spacing.xl,
	},
	bootContent: {
		alignItems: "center",
		gap: Spacing.lg,
		paddingHorizontal: Spacing.xl,
	},
	bootLogo: {
		fontSize: FontSize.display,
		fontWeight: FontWeight.thin,
		color: Colors.primary,
		letterSpacing: -1,
	},
	bootError: {
		fontSize: FontSize.sm,
		color: Colors.danger,
		paddingHorizontal: Spacing.xl,
		textAlign: "center",
		fontWeight: FontWeight.regular,
	},
	retryBtn: {
		marginTop: Spacing.sm,
		paddingHorizontal: Spacing.xl,
		paddingVertical: Spacing.md,
		borderRadius: Radius.full,
		backgroundColor: Colors.primary,
		minWidth: 140,
		alignItems: "center",
	},
	retryText: {
		color: Colors.bgElevated,
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
	},
});
