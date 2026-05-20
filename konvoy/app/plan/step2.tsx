import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TouchableOpacity,
	ScrollView,
	Platform,
} from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker, {
	DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { StepHeader, SectionLabel, Stepper } from "../../src/components/PlanUI";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Spacing,
} from "../../src/constants/theme";
import { usePlanStore } from "../../src/store/planStore";

function formatDate(d: Date) {
	return d.toLocaleDateString("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

export default function PlanStep2() {
	const router = useRouter();
	const carCount = usePlanStore((s) => s.carCount);
	const setCarCount = usePlanStore((s) => s.setCarCount);
	const tripDays = usePlanStore((s) => s.tripDays);
	const setTripDays = usePlanStore((s) => s.setTripDays);
	const departureDate = usePlanStore((s) => s.departureDate);
	const setDepartureDate = usePlanStore((s) => s.setDepartureDate);

	const [pickerOpen, setPickerOpen] = useState(false);

	function handleDateChange(_: DateTimePickerEvent, date?: Date) {
		// On Android, the picker closes itself; on iOS keep open until user dismisses.
		if (Platform.OS === "android") setPickerOpen(false);
		if (date) setDepartureDate(date);
	}

	const canContinue = Boolean(departureDate);

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
						step={2}
						title="Who's going & when?"
						sub="Group size and dates."
					/>

					<SectionLabel>How many cars?</SectionLabel>
					<Stepper value={carCount} onChange={setCarCount} min={1} max={20} />

					<SectionLabel>Departure date</SectionLabel>
					<TouchableOpacity
						activeOpacity={0.85}
						onPress={() => setPickerOpen(true)}
					>
						<NeumorphicView style={styles.dateCard}>
							<Text
								style={[
									styles.dateText,
									!departureDate && styles.dateTextPlaceholder,
								]}
							>
								{departureDate
									? formatDate(departureDate)
									: "Tap to pick a date"}
							</Text>
							<Text style={styles.dateChevron}>📅</Text>
						</NeumorphicView>
					</TouchableOpacity>

					{pickerOpen ? (
						<DateTimePicker
							mode="date"
							value={departureDate ?? new Date()}
							minimumDate={new Date()}
							display={Platform.OS === "ios" ? "inline" : "default"}
							onChange={handleDateChange}
						/>
					) : null}
					{Platform.OS === "ios" && pickerOpen ? (
						<Button
							label="Done"
							variant="ghost"
							onPress={() => setPickerOpen(false)}
							style={styles.iosDoneBtn}
						/>
					) : null}

					<SectionLabel>How many days?</SectionLabel>
					<Stepper
						value={tripDays}
						onChange={setTripDays}
						min={1}
						max={30}
						unit={tripDays === 1 ? "day" : "days"}
					/>

					<View style={styles.actions}>
						<Button
							label="Continue"
							onPress={() => router.push("/plan/step3")}
							disabled={!canContinue}
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
	dateCard: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: Colors.bgElevated,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		minHeight: 60,
		marginBottom: Spacing.xl,
	},
	dateText: {
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.medium,
	},
	dateTextPlaceholder: {
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},
	dateChevron: { fontSize: 18 },
	iosDoneBtn: { marginBottom: Spacing.md },
	actions: { marginTop: Spacing.xl },
});
