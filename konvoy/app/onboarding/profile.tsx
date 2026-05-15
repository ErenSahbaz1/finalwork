import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TextInput,
	TouchableOpacity,
	ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { Colors, Spacing, FontSize, Radius } from "../../src/constants/theme";
import { VehicleType } from "../../src/types";

const VEHICLE_OPTIONS: { type: VehicleType; emoji: string; label: string }[] = [
	{ type: "petrol", emoji: "🚗", label: "Petrol/Diesel" },
	{ type: "ev", emoji: "⚡", label: "Electric (EV)" },
	{ type: "suv", emoji: "🚙", label: "SUV / Van" },
	{ type: "moto", emoji: "🏍️", label: "Moto" },
];

const VEHICLE_COLORS = [
	Colors.vehicleGreen,
	Colors.vehicleBlue,
	Colors.vehicleOrange,
	Colors.vehiclePink,
	Colors.vehiclePurple,
	Colors.vehicleYellow,
];

export default function ProfileScreen() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [vehicleType, setVehicleType] = useState<VehicleType>("petrol");
	const [color, setColor] = useState(VEHICLE_COLORS[0]);

	function handleContinue() {
		if (!name.trim()) return;
		// TODO: save to Supabase / local store
		router.push("/onboarding/privacy");
	}

	return (
		<SafeAreaView style={styles.safe}>
			<ScrollView contentContainerStyle={styles.container}>
				<View style={styles.dots}>
					<View style={[styles.dot, styles.dotDone]} />
					<View style={[styles.dot, styles.dotDone]} />
					<View style={[styles.dot, styles.dotActive]} />
					<View style={styles.dot} />
				</View>

				<View style={styles.iconWrap}>
					<Text style={styles.icon}>👤</Text>
				</View>
				<Text style={styles.title}>Who's driving?</Text>
				<Text style={styles.sub}>
					Shown on the convoy map. No account needed.
				</Text>

				<Text style={styles.label}>Your name</Text>
				<TextInput
					style={styles.input}
					value={name}
					onChangeText={setName}
					placeholder="e.g. Ayse D."
					placeholderTextColor={Colors.textMuted}
					autoFocus
				/>

				<Text style={styles.label}>Vehicle type</Text>
				<View style={styles.vehicleGrid}>
					{VEHICLE_OPTIONS.map((v) => (
						<TouchableOpacity
							key={v.type}
							style={[
								styles.vehicleChip,
								vehicleType === v.type && styles.vehicleChipSel,
							]}
							onPress={() => setVehicleType(v.type)}
							activeOpacity={0.7}
						>
							<Text style={styles.vehicleEmoji}>{v.emoji}</Text>
							<Text
								style={[
									styles.vehicleLabel,
									vehicleType === v.type && styles.vehicleLabelSel,
								]}
							>
								{v.label}
							</Text>
						</TouchableOpacity>
					))}
				</View>

				<Text style={styles.label}>Your color on the map</Text>
				<View style={styles.swatches}>
					{VEHICLE_COLORS.map((c) => (
						<TouchableOpacity
							key={c}
							style={[
								styles.swatch,
								{ backgroundColor: c },
								color === c && styles.swatchSel,
							]}
							onPress={() => setColor(c)}
							activeOpacity={0.8}
						/>
					))}
				</View>

				<Button
					label="Continue"
					onPress={handleContinue}
					disabled={!name.trim()}
					style={styles.btn}
				/>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	container: { padding: Spacing.xl },
	dots: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.xs,
		marginBottom: Spacing.xl,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: Colors.bgElevated,
	},
	dotActive: { width: 18, borderRadius: 3, backgroundColor: Colors.primary },
	dotDone: { width: 6, backgroundColor: Colors.primary },
	iconWrap: {
		width: 56,
		height: 56,
		borderRadius: 18,
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.primaryBorder,
		alignSelf: "center",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.md,
	},
	icon: { fontSize: 28 },
	title: {
		fontSize: FontSize.lg,
		fontWeight: "700",
		color: Colors.textPrimary,
		textAlign: "center",
		marginBottom: Spacing.xs,
	},
	sub: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textAlign: "center",
		lineHeight: 16,
		marginBottom: Spacing.xl,
	},
	label: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginBottom: Spacing.xs,
		marginTop: Spacing.sm,
	},
	input: {
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.primary,
		borderRadius: Radius.md,
		padding: Spacing.md,
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		marginBottom: Spacing.md,
	},
	vehicleGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginBottom: Spacing.md,
	},
	vehicleChip: {
		width: "47%",
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.borderSubtle,
		borderRadius: Radius.md,
		padding: Spacing.md,
		alignItems: "center",
		gap: Spacing.xs,
	},
	vehicleChipSel: {
		borderColor: Colors.primary,
		backgroundColor: Colors.primaryDim,
	},
	vehicleEmoji: { fontSize: 22 },
	vehicleLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
	vehicleLabelSel: { color: Colors.primary },
	swatches: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.xl },
	swatch: { width: 28, height: 28, borderRadius: 14 },
	swatchSel: { borderWidth: 2.5, borderColor: "#fff" },
	btn: { marginTop: Spacing.md },
});
