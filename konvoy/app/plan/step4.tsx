import React, { useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TouchableOpacity,
	ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { StepHeader, SectionLabel, Chip } from "../../src/components/PlanUI";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Spacing,
} from "../../src/constants/theme";
import { usePlanStore } from "../../src/store/planStore";
import type { SleepType } from "../../src/store/planStore";

const SLEEP_OPTIONS: { key: SleepType; icon: string; label: string }[] = [
	{ key: "car", icon: "🚗", label: "Sleep in car" },
	{ key: "hotel", icon: "🏨", label: "Hotel" },
	{ key: "both", icon: "🔀", label: "Both" },
];

const BUDGET_OPTIONS = [
	{ value: 50, label: "<€50" },
	{ value: 100, label: "€50–100" },
	{ value: 150, label: "€100–150" },
	{ value: 200, label: "€150–200" },
	{ value: 250, label: "€200+" },
];

export default function PlanStep4() {
	const router = useRouter();
	const tripDays = usePlanStore((s) => s.tripDays);
	const sleepType = usePlanStore((s) => s.sleepType);
	const setSleepType = usePlanStore((s) => s.setSleepType);
	const hotelBudget = usePlanStore((s) => s.hotelBudget);
	const setHotelBudget = usePlanStore((s) => s.setHotelBudget);
	const hotelStars = usePlanStore((s) => s.hotelStars);
	const setHotelStars = usePlanStore((s) => s.setHotelStars);

	// Single-day trips don't need overnight prefs — skip this step.
	useEffect(() => {
		if (tripDays <= 1) {
			router.replace("/plan/step5");
		}
	}, [tripDays, router]);

	const showHotelPrefs = sleepType === "hotel" || sleepType === "both";

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView contentContainerStyle={styles.container}>
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

					<StepHeader
						step={4}
						title="Where to sleep?"
						sub="Hotels, the car, or a mix."
					/>

					<SectionLabel>Pick your style</SectionLabel>
					<View style={styles.sleepGrid}>
						{SLEEP_OPTIONS.map((opt) => {
							const selected = sleepType === opt.key;
							return (
								<TouchableOpacity
									key={opt.key}
									onPress={() => setSleepType(opt.key)}
									activeOpacity={0.85}
									style={styles.sleepTap}
								>
									<NeumorphicView
										pressed={selected}
										style={[
											styles.sleepCard,
											selected && styles.sleepCardSel,
										]}
									>
										<Text style={styles.sleepIcon}>{opt.icon}</Text>
										<Text
											style={[
												styles.sleepLabel,
												selected && styles.sleepLabelSel,
											]}
										>
											{opt.label}
										</Text>
									</NeumorphicView>
								</TouchableOpacity>
							);
						})}
					</View>

					{showHotelPrefs ? (
						<>
							<SectionLabel>Hotel budget / night</SectionLabel>
							<View style={styles.chipsRow}>
								{BUDGET_OPTIONS.map((b) => (
									<Chip
										key={b.value}
										label={b.label}
										selected={hotelBudget === b.value}
										onPress={() => setHotelBudget(b.value)}
									/>
								))}
							</View>

							<SectionLabel>Hotel stars</SectionLabel>
							<View style={styles.starsRow}>
								{[1, 2, 3, 4, 5].map((n) => {
									const selected = hotelStars === n;
									return (
										<TouchableOpacity
											key={n}
											onPress={() => setHotelStars(n)}
											activeOpacity={0.85}
											style={styles.starTap}
										>
											<NeumorphicView
												pressed={selected}
												style={[
													styles.starCard,
													selected && styles.starCardSel,
												]}
											>
												<Text
													style={[
														styles.starText,
														selected && styles.starTextSel,
													]}
												>
													{"★".repeat(n)}
												</Text>
											</NeumorphicView>
										</TouchableOpacity>
									);
								})}
							</View>
						</>
					) : null}

					<View style={styles.actions}>
						<Button
							label="Continue"
							onPress={() => router.push("/plan/step5")}
						/>
					</View>
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.lg,
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
	sleepGrid: {
		flexDirection: "row",
		gap: Spacing.sm,
		marginBottom: Spacing.lg,
	},
	sleepTap: { flex: 1 },
	sleepCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingVertical: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		minHeight: 110,
	},
	sleepCardSel: {
		backgroundColor: Colors.primary,
	},
	sleepIcon: { fontSize: 28 },
	sleepLabel: {
		fontSize: FontSize.sm,
		color: Colors.textSecondary,
		fontWeight: FontWeight.medium,
		textAlign: "center",
	},
	sleepLabelSel: {
		color: Colors.bgElevated,
		fontWeight: FontWeight.semibold,
	},
	chipsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginBottom: Spacing.lg,
	},
	starsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginBottom: Spacing.lg,
	},
	starTap: { flex: 1, minWidth: "30%" },
	starCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingVertical: Spacing.md,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 48,
	},
	starCardSel: { backgroundColor: Colors.primary },
	starText: {
		fontSize: FontSize.md,
		color: Colors.textSecondary,
		fontWeight: FontWeight.medium,
		letterSpacing: 2,
	},
	starTextSel: { color: Colors.bgElevated },
	actions: { marginTop: Spacing.xl },
});
