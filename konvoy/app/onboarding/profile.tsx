import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TextInput,
	TouchableOpacity,
	ScrollView,
	useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { FadeInView } from "../../src/components/FadeInView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { StaggeredFadeIn } from "../../src/components/StaggeredFadeIn";
import { Colors } from "../../src/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VehicleType } from "../../src/types";
import { supabase } from "../../src/lib/supabase";
import { useUserStore } from "../../src/store/userStore";

const ONBOARDED_KEY = "convoi_onboarded";

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: string }[] = [
	{ type: "petrol", label: "Petrol / Diesel", icon: "🚗" },
	{ type: "ev", label: "Electric", icon: "⚡" },
	{ type: "suv", label: "SUV / Van", icon: "🚙" },
	{ type: "moto", label: "Moto", icon: "🏍️" },
];

const VEHICLE_COLORS = [
	Colors.vehicleGreen,
	Colors.vehicleBlue,
	Colors.vehicleOrange,
	Colors.vehiclePink,
	Colors.vehiclePurple,
	Colors.vehicleYellow,
];

const SCREEN_PADDING = 24;
const CHIP_GAP = 12;

export default function ProfileScreen() {
	const router = useRouter();
	const { width: screenWidth } = useWindowDimensions();

	const userId = useUserStore((s) => s.userId);
	const setUser = useUserStore((s) => s.setUser);
	const setOnboarded = useUserStore((s) => s.setOnboarded);

	const [name, setName] = useState("");
	const [vehicleType, setVehicleType] = useState<VehicleType>("petrol");
	const [color, setColor] = useState(VEHICLE_COLORS[0]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	// Two chips per row, accounting for outer padding (24 × 2) + gap between
	const chipWidth = (screenWidth - SCREEN_PADDING * 2 - CHIP_GAP) / 2;

	async function handleContinue() {
		if (!name.trim() || !userId) return;
		setSaving(true);
		setError("");
		try {
			const { error: e } = await supabase
				.from("users")
				.update({ display_name: name.trim(), avatar_color: color })
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

	const canContinue = name.trim().length > 0 && !!userId;

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView
					contentContainerStyle={styles.container}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					{/* Progress dots */}
					<View style={styles.dots}>
						<View style={[styles.dot, styles.dotDone]} />
						<View style={[styles.dot, styles.dotDone]} />
						<View style={[styles.dot, styles.dotActive]} />
						<View style={styles.dot} />
					</View>

					{/* Title */}
					<Text style={styles.title}>Who's driving?</Text>
					<Text style={styles.sub}>
						Shown on the convoy map. No account needed.
					</Text>

					{/* Name input */}
					<TextInput
						style={styles.nameInput}
						value={name}
						onChangeText={setName}
						placeholder="Your name"
						placeholderTextColor="#bbb"
						autoFocus
						maxLength={32}
					/>

					{/* Vehicle type — 2×2 grid */}
					<View style={styles.section}>
						<View style={styles.vehicleGrid}>
							{VEHICLE_OPTIONS.map((opt, i) => {
								const selected = vehicleType === opt.type;
								return (
									<StaggeredFadeIn key={opt.type} index={i}>
										<TouchableOpacity
											onPress={() => setVehicleType(opt.type)}
											activeOpacity={0.85}
											style={[
												styles.vehicleChip,
												{ width: chipWidth },
												selected && styles.vehicleChipSel,
											]}
										>
											<Text style={styles.vehicleIcon}>{opt.icon}</Text>
											<Text
												style={[
													styles.vehicleLabel,
													selected && styles.vehicleLabelSel,
												]}
												numberOfLines={1}
											>
												{opt.label}
											</Text>
										</TouchableOpacity>
									</StaggeredFadeIn>
								);
							})}
						</View>
					</View>

					{/* Color picker */}
					<View style={styles.section}>
						<View style={styles.swatchesRow}>
							{VEHICLE_COLORS.map((c) => {
								const selected = color === c;
								return (
									<TouchableOpacity
										key={c}
										onPress={() => setColor(c)}
										activeOpacity={0.85}
										hitSlop={6}
										style={[
											styles.swatchOuter,
											{
												borderColor: selected ? "#1a1a1a" : "transparent",
											},
										]}
									>
										<View
											style={[
												styles.swatch,
												{
													backgroundColor: c,
													borderColor: selected ? "#fff" : "transparent",
													shadowColor: selected ? c : "#000",
													shadowOpacity: selected ? 0.5 : 0.1,
												},
											]}
										/>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					{/* Error */}
					{error ? (
						<View style={styles.errorBox}>
							<Text style={styles.errorText}>{error}</Text>
						</View>
					) : null}

					{/* Continue button */}
					<TouchableOpacity
						onPress={handleContinue}
						disabled={!canContinue || saving}
						activeOpacity={0.85}
						style={[
							styles.continueBtn,
							(!canContinue || saving) && styles.continueBtnDisabled,
						]}
					>
						<Text style={styles.continueBtnText}>
							{saving ? "Saving…" : "Continue"}
						</Text>
					</TouchableOpacity>
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

// Reusable subtle drop shadow for the inputs/chips
const shadowSm = {
	shadowColor: "#000",
	shadowOffset: { width: 0, height: 2 },
	shadowOpacity: 0.06,
	shadowRadius: 6,
	elevation: 2,
};

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: {
		padding: SCREEN_PADDING,
		paddingBottom: 48,
	},

	// ── Progress dots ────────────────────────────────────────────────────────
	dots: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 6,
		marginBottom: 32,
	},
	dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ddd" },
	dotDone: { backgroundColor: "#1a1a1a" },
	dotActive: {
		width: 24,
		height: 8,
		borderRadius: 4,
		backgroundColor: "#1a1a1a",
	},

	// ── Title ────────────────────────────────────────────────────────────────
	title: {
		fontSize: 30,
		fontWeight: "300",
		color: "#1a1a1a",
		marginBottom: 6,
		letterSpacing: -0.5,
	},
	sub: {
		fontSize: 15,
		color: "#999",
		marginBottom: 32,
		lineHeight: 22,
	},

	// ── Name input ───────────────────────────────────────────────────────────
	nameInput: {
		height: 56,
		borderRadius: 16,
		backgroundColor: "#fff",
		paddingHorizontal: 18,
		fontSize: 17,
		color: "#1a1a1a",
		fontWeight: "400",
		...shadowSm,
	},

	section: { marginTop: 28 },

	// ── Vehicle 2×2 grid ─────────────────────────────────────────────────────
	vehicleGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: CHIP_GAP,
	},
	vehicleChip: {
		height: 72,
		borderRadius: 16,
		backgroundColor: "#fff",
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 16,
		borderWidth: 2,
		borderColor: "transparent",
		...shadowSm,
	},
	vehicleChipSel: {
		backgroundColor: "#1a1a1a",
		borderColor: "#1a1a1a",
	},
	vehicleIcon: { fontSize: 24 },
	vehicleLabel: {
		fontSize: 15,
		fontWeight: "500",
		color: "#1a1a1a",
		flexShrink: 1,
	},
	vehicleLabelSel: { color: "#fff", fontWeight: "600" },

	// ── Color swatches ───────────────────────────────────────────────────────
	swatchesRow: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 16,
	},
	swatchOuter: {
		padding: 3,
		borderRadius: 25,
		borderWidth: 2,
	},
	swatch: {
		width: 44,
		height: 44,
		borderRadius: 22,
		borderWidth: 3,
		shadowOffset: { width: 0, height: 2 },
		shadowRadius: 6,
		elevation: 3,
	},

	// ── Error ────────────────────────────────────────────────────────────────
	errorBox: {
		marginTop: 28,
		backgroundColor: "rgba(220,38,38,0.08)",
		borderRadius: 12,
		padding: 12,
	},
	errorText: { fontSize: 14, color: Colors.danger, fontWeight: "500" },

	// ── Continue ─────────────────────────────────────────────────────────────
	continueBtn: {
		marginTop: 32,
		height: 56,
		borderRadius: 28,
		backgroundColor: "#1a1a1a",
		alignItems: "center",
		justifyContent: "center",
	},
	continueBtnDisabled: { opacity: 0.4 },
	continueBtnText: {
		color: "#fff",
		fontSize: 17,
		fontWeight: "600",
	},
});
