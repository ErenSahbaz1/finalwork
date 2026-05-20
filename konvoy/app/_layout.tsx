import { useCallback, useEffect, useState } from "react";
import {
	View,
	Text,
	ActivityIndicator,
	StyleSheet,
	Pressable,
	LogBox,
} from "react-native";

// Silence the known-benign warning from react-native-google-places-autocomplete
// rendering its (very short) suggestion FlatList inside the propose-stop
// ScrollView. Windowing matters for long lists; a 5-row dropdown is fine.
LogBox.ignoreLogs([
	"VirtualizedLists should never be nested inside plain ScrollViews",
]);
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
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
import { getOrCreateUser } from "../src/lib/auth";
import { useUserStore } from "../src/store/userStore";

const ONBOARDED_KEY = "konvoy_onboarded";

export default function RootLayout() {
	const setUser = useUserStore((s) => s.setUser);
	const setLoading = useUserStore((s) => s.setLoading);
	const setOnboarded = useUserStore((s) => s.setOnboarded);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState("");
	const [attempt, setAttempt] = useState(0);

	const bootstrap = useCallback(async () => {
		try {
			setError("");
			setLoading(true);

			// Restore onboarded flag from disk so /index can route correctly.
			const onboardedRaw = await AsyncStorage.getItem(ONBOARDED_KEY);
			setOnboarded(onboardedRaw === "true");

			const u = await getOrCreateUser();
			setUser(u.id, u.display_name, u.avatar_color);
			setReady(true);
		} catch (e: any) {
			const msg =
				typeof e?.message === "string" && e.message.length > 0
					? e.message
					: "Couldn't sign in. Check your connection and try again.";
			setError(msg);
			setLoading(false);
		}
	}, [setUser, setLoading, setOnboarded]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			await bootstrap();
			if (cancelled) {
				// nothing to undo; setters are idempotent
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [bootstrap, attempt]);

	if (!ready) {
		return (
			<View style={styles.bootRoot}>
				<SoftBackground />
				<StatusBar style="dark" />
				<FadeInView style={styles.bootContent}>
					<Text style={styles.bootLogo}>Konvoy</Text>
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
		<>
			<StatusBar style="dark" />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: Colors.bg },
					animation: "slide_from_right",
				}}
			>
				<Stack.Screen name="index" />
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
		</>
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
