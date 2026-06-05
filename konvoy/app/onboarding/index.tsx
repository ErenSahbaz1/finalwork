import React from "react";
import { View, Text, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { SoftBackground } from "../../src/components/SoftBackground";
import {
	Colors,
	Spacing,
	FontSize,
	Radius,
	Shadows,
} from "../../src/constants/theme";

export default function WelcomeScreen() {
	const router = useRouter();

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
			<SoftBackground />
			<FadeInView style={styles.container}>
				{/* Progress dots */}
				<View style={styles.dots}>
					<View style={[styles.dotPill]} />
					<View style={styles.dot} />
					<View style={styles.dot} />
					<View style={styles.dot} />
				</View>

				<View style={styles.hero}>
					<Text style={styles.appName}>Convoi</Text>
					<Text style={styles.tagline}>Drive together. Arrive together.</Text>
				</View>

				<View style={styles.features}>
					{FEATURES.map((f) => (
						<View key={f.label} style={[styles.featureRow, Shadows.card]}>
							<View style={styles.featureIconBox}>
								<Text style={styles.featureIcon}>{f.icon}</Text>
							</View>
							<Text style={styles.featureLabel}>{f.label}</Text>
						</View>
					))}
				</View>

				<View style={styles.actions}>
					<Button
						label="Get started"
						onPress={() => router.push("/onboarding/permissions")}
					/>
					<Button
						label="I have an invite code"
						variant="ghost"
						onPress={() => router.push("/convoy/join")}
					/>
				</View>
			</FadeInView>
		</SafeAreaView>
	);
}

const FEATURES = [
	{ icon: "📍", label: "Live group position sharing" },
	{ icon: "⛽", label: "Smart fuel stop planning" },
	{ icon: "🤝", label: "Coordinate stops as a group" },
];

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	container: { flex: 1, padding: Spacing.xl, justifyContent: "space-between" },

	dots: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 6,
		paddingTop: Spacing.md,
	},
	dotPill: {
		width: 24,
		height: 6,
		borderRadius: 3,
		backgroundColor: Colors.primary,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: "#1a1a1a",
	},

	hero: { alignItems: "center", gap: Spacing.sm, marginTop: Spacing.xxl },
	appName: {
		fontSize: 48,
		fontWeight: "200",
		color: "#ffffff",
		letterSpacing: -2,
	},
	tagline: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		fontWeight: "400",
	},

	features: {
		paddingVertical: Spacing.md,
		gap: Spacing.md,
	},
	featureRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		borderRadius: Radius.lg,
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	featureIconBox: {
		width: 36,
		height: 36,
		borderRadius: 10,
		backgroundColor: Colors.primaryDim,
		alignItems: "center",
		justifyContent: "center",
	},
	featureIcon: { fontSize: 18 },
	featureLabel: {
		fontSize: FontSize.md,
		color: Colors.textSecondary,
		fontWeight: "400",
		flex: 1,
	},

	actions: { gap: Spacing.md },
});
