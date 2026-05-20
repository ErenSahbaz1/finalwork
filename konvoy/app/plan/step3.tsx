import React from "react";
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
import {
	StepHeader,
	SectionLabel,
	Stepper,
	Chip,
} from "../../src/components/PlanUI";
import {
	Colors,
	FontSize,
	FontWeight,
	Sizing,
	Spacing,
} from "../../src/constants/theme";
import { usePlanStore } from "../../src/store/planStore";
import type { PlannerStopType } from "../../src/store/planStore";

const STOP_OPTIONS: { key: PlannerStopType; icon: string; label: string }[] = [
	{ key: "fuel", icon: "⛽", label: "Fuel" },
	{ key: "food", icon: "🍔", label: "Food" },
	{ key: "rest", icon: "😴", label: "Rest" },
	{ key: "sightseeing", icon: "📸", label: "Sightseeing" },
	{ key: "shopping", icon: "🛒", label: "Shopping" },
	{ key: "overnight", icon: "🏨", label: "Overnight" },
];

export default function PlanStep3() {
	const router = useRouter();
	const stopsPerDay = usePlanStore((s) => s.stopsPerDay);
	const setStopsPerDay = usePlanStore((s) => s.setStopsPerDay);
	const stopTypes = usePlanStore((s) => s.stopTypes);
	const toggleStopType = usePlanStore((s) => s.toggleStopType);
	const tripDays = usePlanStore((s) => s.tripDays);

	function goNext() {
		// Skip overnight step for single-day trips.
		if (tripDays <= 1) {
			router.push("/plan/step5");
		} else {
			router.push("/plan/step4");
		}
	}

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
						step={3}
						title="Stops along the way"
						sub="How often and what kind."
					/>

					<SectionLabel>Stops per day</SectionLabel>
					<Stepper
						value={stopsPerDay}
						onChange={setStopsPerDay}
						min={1}
						max={8}
					/>

					<SectionLabel>What kind of stops?</SectionLabel>
					<View style={styles.chipsGrid}>
						{STOP_OPTIONS.map((opt) => (
							<View key={opt.key} style={styles.chipCell}>
								<Chip
									label={opt.label}
									icon={opt.icon}
									selected={stopTypes.includes(opt.key)}
									onPress={() => {
										// "Fuel" is recommended — keep it pre-selected, allow toggling.
										toggleStopType(opt.key);
									}}
								/>
							</View>
						))}
					</View>

					<View style={styles.actions}>
						<Button
							label="Continue"
							onPress={goNext}
							disabled={stopTypes.length === 0}
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
	chipsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginBottom: Spacing.xl,
	},
	chipCell: { width: "48%" },
	actions: { marginTop: Spacing.xl },
});
