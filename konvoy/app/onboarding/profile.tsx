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
import { FadeInView } from "../../src/components/FadeInView";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { StaggeredFadeIn } from "../../src/components/StaggeredFadeIn";
import {
	Colors,
	Spacing,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
} from "../../src/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VehicleType } from "../../src/types";
import { supabase } from "../../src/lib/supabase";
import { useUserStore } from "../../src/store/userStore";

const ONBOARDED_KEY = "konvoy_onboarded";

const VEHICLE_OPTIONS: { type: VehicleType; label: string }[] = [
	{ type: "petrol", label: "Petrol / Diesel" },
	{ type: "ev", label: "Electric (EV)" },
	{ type: "suv", label: "SUV / Van" },
	{ type: "moto", label: "Moto" },
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
	const userId = useUserStore((s) => s.userId);
	const setUser = useUserStore((s) => s.setUser);
	const setOnboarded = useUserStore((s) => s.setOnboarded);
	const [name, setName] = useState("");
	const [vehicleType, setVehicleType] = useState<VehicleType>("petrol");
	const [color, setColor] = useState(VEHICLE_COLORS[0]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	async function handleContinue() {
		if (!name.trim() || !userId) return;
		setSaving(true);
		setError("");
		try {
			const { error: e } = await supabase
				.from("users")
				.update({
					display_name: name.trim(),
					avatar_color: color,
				})
				.eq("id", userId);
			if (e) throw e;
			setUser(userId, name.trim(), color);
			await AsyncStorage.setItem(ONBOARDED_KEY, "true");
			setOnboarded(true);
			router.push("/onboarding/privacy");
		} catch (e: any) {
			setError(e?.message ?? "Couldn't save your profile.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView contentContainerStyle={styles.container}>
					<View style={styles.dots}>
						<View style={[styles.dot, styles.dotDone]} />
						<View style={[styles.dot, styles.dotDone]} />
						<View style={[styles.dot, styles.dotActive]} />
						<View style={styles.dot} />
					</View>

					<Text style={styles.title}>Who's driving?</Text>
					<Text style={styles.sub}>
						Shown on the convoy map. No account needed.
					</Text>

					<Text style={styles.label}>Your name</Text>
					<NeumorphicView pressed style={styles.inputWrap}>
						<TextInput
							style={styles.input}
							value={name}
							onChangeText={setName}
							placeholder="e.g. Ayse D."
							placeholderTextColor={Colors.textMuted}
							autoFocus
						/>
					</NeumorphicView>

					<Text style={styles.label}>Vehicle type</Text>
					<View style={styles.vehicleGrid}>
						{VEHICLE_OPTIONS.map((v, index) => (
							<StaggeredFadeIn key={v.type} index={index}>
								<TouchableOpacity
									style={styles.vehicleTap}
									onPress={() => setVehicleType(v.type)}
									activeOpacity={0.85}
								>
									<NeumorphicView
										pressed={vehicleType === v.type}
										style={[
											styles.vehicleChip,
											vehicleType === v.type && styles.vehicleChipSel,
										]}
									>
										<Text
											style={[
												styles.vehicleLabel,
												vehicleType === v.type && styles.vehicleLabelSel,
											]}
										>
											{v.label}
										</Text>
									</NeumorphicView>
								</TouchableOpacity>
							</StaggeredFadeIn>
						))}
					</View>

					<Text style={styles.label}>Your color on the map</Text>
					<View style={styles.swatches}>
						{VEHICLE_COLORS.map((c) => (
							<TouchableOpacity
								key={c}
								style={styles.swatchTap}
								onPress={() => setColor(c)}
								activeOpacity={0.85}
							>
								<NeumorphicView pressed={color === c} style={styles.swatchWrap}>
									<View style={[styles.swatch, { backgroundColor: c }]} />
								</NeumorphicView>
							</TouchableOpacity>
						))}
					</View>

					{error ? (
						<NeumorphicView style={styles.errorBox}>
							<Text style={styles.errorText}>{error}</Text>
						</NeumorphicView>
					) : null}

					<Button
						label="Continue"
						onPress={handleContinue}
						loading={saving}
						disabled={!name.trim() || saving || !userId}
						style={styles.btn}
					/>
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
	dots: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.xs,
		marginBottom: Spacing.xxl,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: Colors.primaryDim,
	},
	dotActive: { width: 22, borderRadius: 3, backgroundColor: Colors.primary },
	dotDone: { width: 6, backgroundColor: Colors.textPrimary },
	title: {
		fontSize: FontSize.xxl,
		fontWeight: FontWeight.light,
		color: Colors.textPrimary,
		marginBottom: Spacing.sm,
		letterSpacing: -0.5,
	},
	sub: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		lineHeight: 22,
		marginBottom: Spacing.xl,
		fontWeight: FontWeight.regular,
	},
	label: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		marginBottom: Spacing.sm,
		marginTop: Spacing.lg,
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
	vehicleGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
	},
	vehicleTap: { width: "48%" },
	vehicleChip: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 56,
	},
	vehicleChipSel: {
		backgroundColor: Colors.bgElevated,
	},
	vehicleLabel: {
		fontSize: FontSize.sm,
		color: Colors.textSecondary,
		fontWeight: FontWeight.medium,
	},
	vehicleLabelSel: {
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},
	swatches: {
		flexDirection: "row",
		gap: Spacing.md,
		marginBottom: Spacing.xl,
	},
	swatchTap: { width: 48, height: 48 },
	swatchWrap: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: Colors.bgCard,
		alignItems: "center",
		justifyContent: "center",
	},
	swatch: {
		width: 32,
		height: 32,
		borderRadius: 16,
	},
	btn: { marginTop: Spacing.md },
	errorBox: {
		backgroundColor: "rgba(220,38,38,0.08)",
		borderRadius: Radius.lg,
		padding: Spacing.md,
		marginBottom: Spacing.md,
	},
	errorText: {
		fontSize: FontSize.sm,
		color: Colors.danger,
		fontWeight: FontWeight.medium,
	},
});
