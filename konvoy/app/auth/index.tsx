import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	ScrollView,
	TextInput,
	TouchableOpacity,
	KeyboardAvoidingView,
	Platform,
	ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { SoftBackground } from "../../src/components/SoftBackground";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Spacing,
} from "../../src/constants/theme";
import {
	signInWithEmail,
	signInWithGoogle,
	signUpWithEmail,
} from "../../src/lib/auth";
import { useUserStore } from "../../src/store/userStore";

type Mode = "signin" | "signup";

export default function AuthScreen() {
	const router = useRouter();
	const setEmailStore = useUserStore((s) => s.setEmail);
	const setGuest = useUserStore((s) => s.setGuest);

	const [mode, setMode] = useState<Mode>("signin");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [googleLoading, setGoogleLoading] = useState(false);

	function validate(): string {
		if (!email.trim()) return "Enter your email.";
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
			return "That email looks off.";
		if (password.length < 6)
			return "Password must be at least 6 characters.";
		if (mode === "signup") {
			if (!name.trim()) return "Enter your name.";
			if (password !== confirm) return "Passwords do not match.";
		}
		return "";
	}

	async function handleEmailSubmit() {
		const v = validate();
		if (v) {
			setError(v);
			return;
		}
		setError("");
		setLoading(true);
		try {
			if (mode === "signin") {
				await signInWithEmail(email.trim(), password);
			} else {
				await signUpWithEmail(email.trim(), password, name.trim());
			}
			setEmailStore(email.trim());
			setGuest(false);
			// _layout's onAuthStateChange will flip isAuthenticated and the home
			// screen will render. Replace so back-button can't return to /auth.
			router.replace("/");
		} catch (e: any) {
			setError(translateAuthError(e?.message));
		} finally {
			setLoading(false);
		}
	}

	async function handleGoogle() {
		setError("");
		setGoogleLoading(true);
		try {
			await signInWithGoogle();
			setGuest(false);
			router.replace("/");
		} catch (e: any) {
			if (e?.message !== "Google sign-in cancelled.") {
				setError(e?.message ?? "Google sign-in failed.");
			}
		} finally {
			setGoogleLoading(false);
		}
	}

	function handleGuest() {
		setGuest(true);
		router.replace("/convoy/join");
	}

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<KeyboardAvoidingView
					style={styles.flex}
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<ScrollView
						contentContainerStyle={styles.container}
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
					>
						<View style={styles.hero}>
							<Text style={styles.brand}>Convoi</Text>
							<Text style={styles.tagline}>Plan your convoy together</Text>
						</View>

						<TouchableOpacity
							style={styles.googleBtn}
							onPress={handleGoogle}
							disabled={googleLoading || loading}
							activeOpacity={0.85}
						>
							{googleLoading ? (
								<ActivityIndicator color={Colors.textPrimary} />
							) : (
								<>
									<Text style={styles.googleG}>G</Text>
									<Text style={styles.googleLabel}>Continue with Google</Text>
								</>
							)}
						</TouchableOpacity>

						<View style={styles.dividerRow}>
							<View style={styles.dividerLine} />
							<Text style={styles.dividerText}>or</Text>
							<View style={styles.dividerLine} />
						</View>

						{mode === "signup" ? (
							<>
								<Text style={styles.label}>Display name</Text>
								<NeumorphicView pressed style={styles.inputWrap}>
									<TextInput
										style={styles.input}
										value={name}
										onChangeText={setName}
										placeholder="Ayse D."
										placeholderTextColor={Colors.textMuted}
										autoCapitalize="words"
										autoCorrect={false}
									/>
								</NeumorphicView>
							</>
						) : null}

						<Text style={styles.label}>Email</Text>
						<NeumorphicView pressed style={styles.inputWrap}>
							<TextInput
								style={styles.input}
								value={email}
								onChangeText={(t) => {
									setEmail(t);
									if (error) setError("");
								}}
								placeholder="you@example.com"
								placeholderTextColor={Colors.textMuted}
								autoCapitalize="none"
								autoCorrect={false}
								keyboardType="email-address"
								autoComplete="email"
							/>
						</NeumorphicView>

						<Text style={styles.label}>Password</Text>
						<NeumorphicView pressed style={styles.inputWrap}>
							<TextInput
								style={styles.input}
								value={password}
								onChangeText={(t) => {
									setPassword(t);
									if (error) setError("");
								}}
								placeholder="••••••••"
								placeholderTextColor={Colors.textMuted}
								secureTextEntry
								autoCapitalize="none"
								autoCorrect={false}
								autoComplete={mode === "signup" ? "new-password" : "current-password"}
							/>
						</NeumorphicView>

						{mode === "signup" ? (
							<>
								<Text style={styles.label}>Confirm password</Text>
								<NeumorphicView pressed style={styles.inputWrap}>
									<TextInput
										style={styles.input}
										value={confirm}
										onChangeText={setConfirm}
										placeholder="••••••••"
										placeholderTextColor={Colors.textMuted}
										secureTextEntry
										autoCapitalize="none"
										autoCorrect={false}
									/>
								</NeumorphicView>
							</>
						) : null}

						{error ? <Text style={styles.errorText}>{error}</Text> : null}

						<Button
							label={mode === "signin" ? "Sign in" : "Create account"}
							onPress={handleEmailSubmit}
							loading={loading}
							style={styles.primaryBtn}
						/>

						<TouchableOpacity
							onPress={() => {
								setMode(mode === "signin" ? "signup" : "signin");
								setError("");
							}}
							hitSlop={8}
							style={styles.toggleRow}
						>
							<Text style={styles.toggleText}>
								{mode === "signin"
									? "Don't have an account?  "
									: "Already have an account?  "}
								<Text style={styles.toggleLink}>
									{mode === "signin" ? "Create one" : "Sign in"}
								</Text>
							</Text>
						</TouchableOpacity>

						<View style={styles.guestSection}>
							<Text style={styles.guestPrompt}>Just joining a convoy?</Text>
							<Button
								label="Continue as guest →"
								variant="ghost"
								onPress={handleGuest}
							/>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</FadeInView>
		</SafeAreaView>
	);
}

// Translate a few common Supabase auth errors to friendlier copy.
function translateAuthError(msg?: string): string {
	if (!msg) return "Something went wrong. Try again.";
	const m = msg.toLowerCase();
	if (m.includes("invalid login")) return "Invalid email or password.";
	if (m.includes("already registered") || m.includes("already in use"))
		return "Email already in use.";
	if (m.includes("password") && m.includes("6"))
		return "Password must be at least 6 characters.";
	if (m.includes("user not found")) return "No account found for that email.";
	return msg;
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: {
		padding: Spacing.xl,
		paddingBottom: Spacing.xxl,
		gap: Spacing.sm,
	},

	hero: {
		alignItems: "center",
		marginTop: Spacing.xxl,
		marginBottom: Spacing.xl,
		gap: Spacing.xs,
	},
	brand: {
		fontSize: FontSize.display,
		fontWeight: FontWeight.thin,
		color: Colors.primary,
		letterSpacing: -1.5,
	},
	tagline: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},

	googleBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		backgroundColor: Colors.bgElevated,
		borderRadius: Radius.full,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		minHeight: Sizing.touchTarget + 8,
		borderWidth: 1,
		borderColor: Colors.border,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.35,
		shadowRadius: 10,
		elevation: 4,
	},
	googleG: {
		fontSize: 22,
		fontWeight: FontWeight.semibold,
		color: "#4285F4",
		letterSpacing: -0.5,
	},
	googleLabel: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},

	dividerRow: {
		flexDirection: "row",
		alignItems: "center",
		marginVertical: Spacing.lg,
	},
	dividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderSubtle },
	dividerText: {
		marginHorizontal: Spacing.md,
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.medium,
	},

	label: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		marginTop: Spacing.md,
		marginBottom: Spacing.sm,
	},
	inputWrap: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
	},
	input: {
		backgroundColor: "transparent",
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
	},
	errorText: {
		fontSize: FontSize.sm,
		color: Colors.danger,
		fontWeight: FontWeight.medium,
		marginTop: Spacing.sm,
	},

	primaryBtn: { marginTop: Spacing.lg },

	toggleRow: {
		alignItems: "center",
		paddingVertical: Spacing.md,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
	},
	toggleText: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},
	toggleLink: {
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},

	guestSection: {
		marginTop: Spacing.lg,
		alignItems: "center",
		gap: Spacing.sm,
	},
	guestPrompt: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},
});
