import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { SoftBackground } from "../../src/components/SoftBackground";
import {
	Colors,
	Spacing,
	FontSize,
	FontWeight,
	Radius,
} from "../../src/constants/theme";

export default function WelcomeScreen() {
	const router = useRouter();

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.container}>
				{/* Progress dots */}
				<View style={styles.dots}>
					<View style={[styles.dot, styles.dotActive]} />
					<View style={styles.dot} />
					<View style={styles.dot} />
					<View style={styles.dot} />
				</View>

				<View style={styles.hero}>
					<Text style={styles.appName}>Konvoy</Text>
					<Text style={styles.tagline}>Drive together. Arrive together.</Text>
				</View>

				<View style={styles.features}>
					{FEATURES.map((f) => (
						<NeumorphicView key={f.label} style={styles.featureRow}>
							<Text style={styles.featureLabel}>{f.label}</Text>
						</NeumorphicView>
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
						style={styles.ghostBtn}
					/>
				</View>
			</FadeInView>
		</SafeAreaView>
	);
}

const FEATURES = [
	{ label: "Live group position sharing" },
	{ label: "Smart fuel stop planning" },
	{ label: "Coordinate stops as a group" },
];

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	container: { flex: 1, padding: Spacing.xl, justifyContent: "space-between" },
	dots: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.xs,
		paddingTop: Spacing.md,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: Colors.primaryDim,
	},
	dotActive: { width: 22, borderRadius: 3, backgroundColor: Colors.primary },
	hero: { alignItems: "center", gap: Spacing.sm, marginTop: Spacing.xxl },
	appName: {
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
	features: {
		paddingVertical: Spacing.md,
		gap: Spacing.md,
	},
	featureRow: {
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.lg,
		borderRadius: Radius.lg,
		backgroundColor: Colors.bgCard,
	},
	featureLabel: {
		fontSize: FontSize.md,
		color: Colors.textSecondary,
		fontWeight: FontWeight.regular,
	},
	actions: { gap: Spacing.md },
	ghostBtn: {},
});
