import React, { useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { StaggeredFadeIn } from "../../src/components/StaggeredFadeIn";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Spacing,
} from "../../src/constants/theme";
import { usePlanStore } from "../../src/store/planStore";

const FEATURES = [
	{ icon: "🤖", label: "AI-planned route in 3 styles" },
	{ icon: "⛽", label: "Fuel stops in the cheapest countries" },
	{ icon: "🏨", label: "Overnight hotels in your budget" },
];

export default function PlanIntroScreen() {
	const router = useRouter();
	const reset = usePlanStore((s) => s.reset);

	// Always start a fresh plan when entering the wizard.
	useEffect(() => {
		reset();
	}, [reset]);

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<View style={styles.container}>
					<View style={styles.header}>
						<TouchableOpacity
							onPress={() => router.back()}
							hitSlop={12}
							style={styles.backBtn}
						>
							<Text style={styles.backText}>Back</Text>
						</TouchableOpacity>
						<View style={{ width: 50 }} />
					</View>

					<View style={styles.hero}>
						<Text style={styles.eyebrow}>CONVOI AI</Text>
						<Text style={styles.title}>Plan your trip together</Text>
						<Text style={styles.sub}>
							Answer 5 quick questions. We'll generate 3 complete routes
							with stops, hotels and fuel costs.
						</Text>
					</View>

					<View style={styles.features}>
						{FEATURES.map((f, i) => (
							<StaggeredFadeIn key={f.label} index={i}>
								<NeumorphicView style={styles.featureRow}>
									<Text style={styles.featureIcon}>{f.icon}</Text>
									<Text style={styles.featureLabel}>{f.label}</Text>
								</NeumorphicView>
							</StaggeredFadeIn>
						))}
					</View>

					<View style={styles.actions}>
						<Button
							label="Start planning"
							onPress={() => router.push("/plan/step1")}
						/>
					</View>
				</View>
			</FadeInView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: {
		flex: 1,
		padding: Spacing.xl,
		justifyContent: "space-between",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	backBtn: {
		padding: Spacing.xs,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
	},
	backText: {
		fontSize: FontSize.sm,
		color: Colors.textPrimary,
		fontWeight: FontWeight.medium,
	},
	hero: { gap: Spacing.sm },
	eyebrow: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		letterSpacing: 1.4,
	},
	title: {
		fontSize: FontSize.xxl,
		fontWeight: "700",
		color: Colors.textPrimary,
		letterSpacing: -0.5,
	},
	sub: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		lineHeight: 22,
		fontWeight: FontWeight.regular,
	},
	features: { gap: Spacing.md },
	featureRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	featureIcon: { fontSize: 22 },
	featureLabel: {
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.medium,
		flex: 1,
	},
	actions: { gap: Spacing.md },
});
