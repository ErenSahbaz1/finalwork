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
	StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { FadeInView } from "../../src/components/FadeInView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { StaggeredFadeIn } from "../../src/components/StaggeredFadeIn";
import {
	Colors,
	Spacing,
	FontSize,
	Radius,
	Shadows,
} from "../../src/constants/theme";
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
			<StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView
					contentContainerStyle={styles.container}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					{/* Progress dots */}
					<View style={styles.dots}>
						<View style={styles.dotDone} />
						<View style={styles.dotDone} />
						<View style={styles.dotPill} />
						<View style={styles.dotInactive} />
					</View>

					<Text style={styles.title}>Who's driving?</Text>
					<Text style={styles.sub}>Shown on the convoy map. No account needed.</Text>

					<TextInput
						style={styles.nameInput}
						value={name}
						onChangeText={setName}
						placeholder="Your name"
						placeholderTextColor={Colors.textMuted}
						autoFocus
						maxLength={32}
						selectionColor={Colors.primary}
					/>

					{/* Vehicle type — 2×2 grid */}
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Vehicle type</Text>
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
												selected && Shadows.glowSm,
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
						<Text style={styles.sectionLabel}>Your color</Text>
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
											{ borderColor: selected ? Colors.primary : "transparent" },
										]}
									>
										<View
											style={[
												styles.swatch,
												{ backgroundColor: c },
												selected && {
													shadowColor: c,
													shadowOffset: { width: 0, height: 0 },
													shadowOpacity: 0.7,
													shadowRadius: 8,
													elevation: 6,
												},
											]}
										/>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					{error ? (
						<View style={styles.errorBox}>
							<Text style={styles.errorText}>{error}</Text>
						</View>
					) : null}

					<TouchableOpacity
						onPress={handleContinue}
						disabled={!canContinue || saving}
						activeOpacity={0.85}
						style={[
							styles.continueBtn,
							Shadows.glow,
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

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: { padding: SCREEN_PADDING, paddingBottom: 48 },

	dots: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 6,
		marginBottom: 32,
	},
	dotDone: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
	dotPill: { width: 24, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
	dotInactive: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#1a1a1a" },

	title: {
		fontSize: 30,
		fontWeight: "700",
		color: Colors.textPrimary,
		marginBottom: 6,
		letterSpacing: -0.5,
	},
	sub: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		marginBottom: 28,
		lineHeight: 22,
	},

	nameInput: {
		height: 56,
		borderRadius: Radius.md,
		backgroundColor: Colors.bgElevated,
		paddingHorizontal: 18,
		fontSize: 17,
		color: Colors.textPrimary,
		fontWeight: "400",
		borderWidth: 1,
		borderColor: Colors.border,
	},

	section: { marginTop: 28 },
	sectionLabel: {
		fontSize: 10,
		fontWeight: "600",
		color: Colors.textMuted,
		letterSpacing: 1.5,
		textTransform: "uppercase",
		marginBottom: 12,
	},

	vehicleGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: CHIP_GAP,
	},
	vehicleChip: {
		height: 72,
		borderRadius: Radius.md,
		backgroundColor: Colors.bgCard,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 16,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	vehicleChipSel: {
		backgroundColor: Colors.bgAccent,
		borderColor: Colors.borderAccent,
	},
	vehicleIcon: { fontSize: 24 },
	vehicleLabel: {
		fontSize: FontSize.md,
		fontWeight: "500",
		color: Colors.textSecondary,
		flexShrink: 1,
	},
	vehicleLabelSel: { color: Colors.primary, fontWeight: "600" },

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
	},

	errorBox: {
		marginTop: 20,
		backgroundColor: Colors.bgAccent,
		borderRadius: Radius.md,
		padding: 12,
		borderWidth: 1,
		borderColor: Colors.borderAccent,
	},
	errorText: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: "500" },

	continueBtn: {
		marginTop: 32,
		height: 56,
		borderRadius: Radius.lg,
		backgroundColor: Colors.primary,
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
