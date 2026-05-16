// ─── Settings screen ──────────────────────────────────────────────────────────
// Privacy, vehicle, data management, preferences.
//
// GDPR notes:
//   • Article 17 — Right to erasure: implemented by "Delete all my data".
//   • Article 20 — Right to portability: stubbed by "Download my data" (toast).
//   • Article  5 — Data minimisation: location auto-wipe after convoy ends
//                  (toggled by the "Auto-wipe on trip end" switch).
// ──────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Switch,
	Alert,
	Modal,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { StaggeredFadeIn } from "../../src/components/StaggeredFadeIn";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Spacing,
} from "../../src/constants/theme";
import { supabase } from "../../src/lib/supabase";
import { signOut } from "../../src/lib/auth";
import { useUserStore } from "../../src/store/userStore";
import type { FuelType, VehicleType } from "../../src/types";

// ─── Storage keys ─────────────────────────────────────────────────────────────
const ONBOARDED_KEY = "konvoy_onboarded";
const PRIVACY_KEY = "konvoy_privacy_settings";
const LANGUAGE_KEY = "konvoy_language";
const UNITS_KEY = "konvoy_units";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PrivacySettings {
	exactLocation: boolean;
	autoWipe: boolean;
	showInMemberList: boolean;
	shareVehicleProfile: boolean;
}

interface UnitSettings {
	distance: "km" | "mi";
	fuel: "lp100" | "mpg";
}

type Language = "nl" | "en" | "fr" | "tr";

interface VehicleRow {
	id: string;
	user_id: string;
	label: string;
	type: VehicleType;
	fuel_type: FuelType;
	consumption: number;
	tank_size: number;
	icon_color: string;
	is_ev: boolean;
}

// ─── Defaults & options ───────────────────────────────────────────────────────
const DEFAULT_PRIVACY: PrivacySettings = {
	exactLocation: true,
	autoWipe: true,
	showInMemberList: true,
	shareVehicleProfile: true,
};

const DEFAULT_UNITS: UnitSettings = {
	distance: "km",
	fuel: "lp100",
};

const PRIVACY_ROWS: {
	key: keyof PrivacySettings;
	label: string;
	hint: string;
}[] = [
	{
		key: "exactLocation",
		label: "Exact location",
		hint: "Share precise GPS with convoy members",
	},
	{
		key: "autoWipe",
		label: "Auto-wipe on trip end",
		hint: "Delete all position data when convoy ends",
	},
	{
		key: "showInMemberList",
		label: "Show in member list",
		hint: "Let others see your name and vehicle",
	},
	{
		key: "shareVehicleProfile",
		label: "Share vehicle profile",
		hint: "Helps calculate smarter fuel stops",
	},
];

const FUEL_OPTIONS: { type: FuelType; label: string }[] = [
	{ type: "petrol_95", label: "95" },
	{ type: "petrol_98", label: "98" },
	{ type: "diesel", label: "Diesel" },
	{ type: "lpg", label: "LPG" },
	{ type: "electric", label: "Electric" },
];

const VEHICLE_TYPE_OPTIONS: { type: VehicleType; label: string }[] = [
	{ type: "petrol", label: "Petrol" },
	{ type: "ev", label: "EV" },
	{ type: "suv", label: "SUV" },
	{ type: "moto", label: "Moto" },
];

const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
	{ code: "nl", label: "Nederlands" },
	{ code: "en", label: "English" },
	{ code: "fr", label: "Français" },
	{ code: "tr", label: "Türkçe" },
];

const APP_VERSION = "1.0.0";

// ─── Component ────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
	const router = useRouter();
	const userId = useUserStore((s) => s.userId);
	const displayName = useUserStore((s) => s.displayName);
	const avatarColor = useUserStore((s) => s.avatarColor);
	const setUser = useUserStore((s) => s.setUser);
	const clearUser = useUserStore((s) => s.clear);

	// Profile-edit modal
	const [nameModalOpen, setNameModalOpen] = useState(false);
	const [draftName, setDraftName] = useState(displayName);
	const [savingName, setSavingName] = useState(false);

	// Vehicle
	const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
	const [vehicleLoading, setVehicleLoading] = useState(true);
	const [tankDraft, setTankDraft] = useState("");
	const [consumptionDraft, setConsumptionDraft] = useState("");

	// Privacy
	const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY);

	// Preferences
	const [language, setLanguage] = useState<Language>("en");
	const [units, setUnits] = useState<UnitSettings>(DEFAULT_UNITS);

	// Two-step delete confirmation
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState("");
	const [deleting, setDeleting] = useState(false);

	// Toast
	const [toast, setToast] = useState("");

	const showToast = useCallback((msg: string) => {
		setToast(msg);
		setTimeout(() => setToast(""), 1500);
	}, []);

	// ─── Initial load ─────────────────────────────────────────────────────────
	useEffect(() => {
		(async () => {
			try {
				const [privRaw, langRaw, unitsRaw] = await Promise.all([
					AsyncStorage.getItem(PRIVACY_KEY),
					AsyncStorage.getItem(LANGUAGE_KEY),
					AsyncStorage.getItem(UNITS_KEY),
				]);
				if (privRaw) {
					try {
						setPrivacy({ ...DEFAULT_PRIVACY, ...JSON.parse(privRaw) });
					} catch {
						// ignore corrupt JSON, fall back to defaults
					}
				}
				if (langRaw === "nl" || langRaw === "en" || langRaw === "fr" || langRaw === "tr") {
					setLanguage(langRaw);
				}
				if (unitsRaw) {
					try {
						setUnits({ ...DEFAULT_UNITS, ...JSON.parse(unitsRaw) });
					} catch {
						// ignore
					}
				}
			} catch {
				// AsyncStorage is best-effort
			}
		})();
	}, []);

	// Fetch (or create) the user's primary vehicle
	useEffect(() => {
		if (!userId) return;
		let cancelled = false;
		(async () => {
			setVehicleLoading(true);
			try {
				const { data, error } = await supabase
					.from("vehicles")
					.select("*")
					.eq("user_id", userId)
					.order("created_at", { ascending: true })
					.limit(1)
					.maybeSingle();
				if (error) throw error;
				if (cancelled) return;

				if (data) {
					const row = data as VehicleRow;
					setVehicle(row);
					setTankDraft(String(row.tank_size));
					setConsumptionDraft(String(row.consumption));
				} else {
					// Auto-create a default vehicle so later edits can update in place.
					const { data: created, error: insErr } = await supabase
						.from("vehicles")
						.insert({
							user_id: userId,
							label: "My vehicle",
							type: "petrol" as VehicleType,
							fuel_type: "petrol_95" as FuelType,
							consumption: 7.0,
							tank_size: 50.0,
							icon_color: avatarColor || "#33a86d",
							is_ev: false,
						})
						.select("*")
						.single();
					if (insErr) throw insErr;
					if (cancelled) return;
					const row = created as VehicleRow;
					setVehicle(row);
					setTankDraft(String(row.tank_size));
					setConsumptionDraft(String(row.consumption));
				}
			} catch {
				// Non-fatal; leave the vehicle card in a "—" state.
			} finally {
				if (!cancelled) setVehicleLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [userId, avatarColor]);

	// ─── Profile name save ────────────────────────────────────────────────────
	function openNameModal() {
		setDraftName(displayName);
		setNameModalOpen(true);
	}

	async function saveDisplayName() {
		if (!userId) return;
		const trimmed = draftName.trim();
		if (!trimmed) return;
		setSavingName(true);
		try {
			const { error } = await supabase
				.from("users")
				.update({ display_name: trimmed })
				.eq("id", userId);
			if (error) throw error;
			setUser(userId, trimmed, avatarColor);
			setNameModalOpen(false);
			showToast("Saved");
		} catch (e: any) {
			Alert.alert("Couldn't save", e?.message ?? "Try again.");
		} finally {
			setSavingName(false);
		}
	}

	// ─── Vehicle updates ──────────────────────────────────────────────────────
	const updateVehicle = useCallback(
		async (patch: Partial<VehicleRow>) => {
			if (!vehicle) return;
			const next = { ...vehicle, ...patch };
			setVehicle(next);
			try {
				const { error } = await supabase
					.from("vehicles")
					.update(patch)
					.eq("id", vehicle.id);
				if (error) throw error;
				showToast("Saved");
			} catch (e: any) {
				Alert.alert("Couldn't save vehicle", e?.message ?? "Try again.");
			}
		},
		[vehicle, showToast],
	);

	function selectFuel(fuel: FuelType) {
		updateVehicle({ fuel_type: fuel, is_ev: fuel === "electric" });
	}

	function selectVehicleType(type: VehicleType) {
		updateVehicle({ type, is_ev: type === "ev" });
	}

	function commitTankSize() {
		const n = parseFloat(tankDraft.replace(",", "."));
		if (!Number.isFinite(n) || n <= 0) {
			setTankDraft(String(vehicle?.tank_size ?? ""));
			return;
		}
		if (vehicle && n === vehicle.tank_size) return;
		updateVehicle({ tank_size: n });
	}

	function commitConsumption() {
		const n = parseFloat(consumptionDraft.replace(",", "."));
		if (!Number.isFinite(n) || n <= 0) {
			setConsumptionDraft(String(vehicle?.consumption ?? ""));
			return;
		}
		if (vehicle && n === vehicle.consumption) return;
		updateVehicle({ consumption: n });
	}

	// ─── Privacy / preferences saves ──────────────────────────────────────────
	const persistPrivacy = useCallback(
		async (next: PrivacySettings) => {
			setPrivacy(next);
			try {
				await AsyncStorage.setItem(PRIVACY_KEY, JSON.stringify(next));
				showToast("Saved");
			} catch {
				// best effort
			}
		},
		[showToast],
	);

	function togglePrivacy(key: keyof PrivacySettings) {
		persistPrivacy({ ...privacy, [key]: !privacy[key] });
	}

	const persistLanguage = useCallback(
		async (lang: Language) => {
			setLanguage(lang);
			try {
				await AsyncStorage.setItem(LANGUAGE_KEY, lang);
				showToast("Saved");
			} catch {
				// best effort
			}
		},
		[showToast],
	);

	const persistUnits = useCallback(
		async (next: UnitSettings) => {
			setUnits(next);
			try {
				await AsyncStorage.setItem(UNITS_KEY, JSON.stringify(next));
				showToast("Saved");
			} catch {
				// best effort
			}
		},
		[showToast],
	);

	// ─── Data management ──────────────────────────────────────────────────────
	function handleDownloadData() {
		Alert.alert(
			"Download my data",
			"We're working on this — a JSON export of your profile, convoys, and stops will be available in a future update.",
			[{ text: "OK" }],
		);
		showToast("Coming soon");
	}

	function handleWipeLocationHistory() {
		Alert.alert(
			"Wipe location history",
			"This will delete all your GPS positions from every convoy. This cannot be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Wipe",
					style: "destructive",
					onPress: async () => {
						if (!userId) return;
						try {
							const { data: memberRows, error: memErr } = await supabase
								.from("convoy_members")
								.select("id")
								.eq("user_id", userId);
							if (memErr) throw memErr;
							const memberIds = (memberRows ?? []).map((m: any) => m.id);
							if (memberIds.length === 0) {
								showToast("Nothing to wipe");
								return;
							}
							const { error: delErr } = await supabase
								.from("live_positions")
								.delete()
								.in("convoy_member_id", memberIds);
							if (delErr) throw delErr;
							showToast("Location history wiped");
						} catch (e: any) {
							Alert.alert("Couldn't wipe", e?.message ?? "Try again.");
						}
					},
				},
			],
		);
	}

	function handleDeleteAllRequest() {
		Alert.alert(
			"Delete all my data?",
			"This will delete your profile and all convoy history. You'll need to set up Konvoy again from scratch.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Continue",
					style: "destructive",
					onPress: () => {
						setDeleteConfirm("");
						setDeleteModalOpen(true);
					},
				},
			],
		);
	}

	async function performDelete() {
		if (!userId) return;
		if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
			Alert.alert("Type DELETE to confirm.");
			return;
		}
		setDeleting(true);
		try {
			// 1. Wipe live positions for any convoy this user belongs to.
			const { data: memberRows } = await supabase
				.from("convoy_members")
				.select("id")
				.eq("user_id", userId);
			const memberIds = (memberRows ?? []).map((m: any) => m.id);
			if (memberIds.length > 0) {
				await supabase
					.from("live_positions")
					.delete()
					.in("convoy_member_id", memberIds);
			}

			// 2. Remove convoy memberships (ON DELETE CASCADE on FKs handles
			//    related records like stop_votes / stop_arrivals).
			await supabase.from("convoy_members").delete().eq("user_id", userId);

			// 3. Vehicles (also cascades from users, but explicit is clearer).
			await supabase.from("vehicles").delete().eq("user_id", userId);

			// 4. The user row itself.
			await supabase.from("users").delete().eq("id", userId);

			// 5. End the auth session and wipe local state.
			await signOut();
			await AsyncStorage.multiRemove([
				ONBOARDED_KEY,
				PRIVACY_KEY,
				LANGUAGE_KEY,
				UNITS_KEY,
			]);
			clearUser();

			setDeleteModalOpen(false);
			setDeleting(false);
			router.replace("/onboarding");
		} catch (e: any) {
			setDeleting(false);
			Alert.alert("Couldn't delete", e?.message ?? "Try again.");
		}
	}

	// ─── Reset onboarding (dev convenience) ───────────────────────────────────
	async function resetOnboarding() {
		try {
			await AsyncStorage.removeItem(ONBOARDED_KEY);
		} catch {
			// best effort
		}
		router.replace("/onboarding");
	}

	// ─── Render ───────────────────────────────────────────────────────────────
	const avatarLetter = useMemo(
		() => (displayName?.trim()?.charAt(0) || "?").toUpperCase(),
		[displayName],
	);

	if (!userId) {
		return (
			<SafeAreaView style={styles.safe}>
				<SoftBackground />
				<View style={styles.center}>
					<ActivityIndicator color={Colors.primary} />
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView contentContainerStyle={styles.container}>
					{/* Header */}
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

					<Text style={styles.title}>Settings</Text>

					{/* ─── Profile card ───────────────────────────────────────── */}
					<TouchableOpacity activeOpacity={0.85} onPress={openNameModal}>
						<NeumorphicView style={styles.profileCard}>
							<View
								style={[styles.avatar, { backgroundColor: avatarColor }]}
							>
								<Text style={styles.avatarLetter}>{avatarLetter}</Text>
							</View>
							<View style={{ flex: 1 }}>
								<Text style={styles.profileName} numberOfLines={1}>
									{displayName || "New Driver"}
								</Text>
								<Text style={styles.profileSub}>Anonymous user · Tap to edit</Text>
							</View>
							<Text style={styles.chevron}>›</Text>
						</NeumorphicView>
					</TouchableOpacity>

					{/* ─── Vehicle ────────────────────────────────────────────── */}
					<Section title="My vehicle">
						<NeumorphicView style={styles.card}>
							{vehicleLoading ? (
								<View style={{ padding: Spacing.md, alignItems: "center" }}>
									<ActivityIndicator color={Colors.primary} />
								</View>
							) : !vehicle ? (
								<Text style={styles.muted}>
									Couldn't load your vehicle. Pull to refresh later.
								</Text>
							) : (
								<>
									<SubLabel>Fuel type</SubLabel>
									<View style={styles.chipRow}>
										{FUEL_OPTIONS.map((opt) => {
											const sel = vehicle.fuel_type === opt.type;
											return (
												<TouchableOpacity
													key={opt.type}
													onPress={() => selectFuel(opt.type)}
													activeOpacity={0.85}
													style={styles.chipTap}
												>
													<NeumorphicView
														pressed={sel}
														style={[
															styles.chip,
															sel && styles.chipSelected,
														]}
													>
														<Text
															style={[
																styles.chipText,
																sel && styles.chipTextSelected,
															]}
														>
															{opt.label}
														</Text>
													</NeumorphicView>
												</TouchableOpacity>
											);
										})}
									</View>

									<View style={styles.divider} />

									<SubLabel>Vehicle type</SubLabel>
									<View style={styles.chipRow}>
										{VEHICLE_TYPE_OPTIONS.map((opt) => {
											const sel = vehicle.type === opt.type;
											return (
												<TouchableOpacity
													key={opt.type}
													onPress={() => selectVehicleType(opt.type)}
													activeOpacity={0.85}
													style={styles.chipTap}
												>
													<NeumorphicView
														pressed={sel}
														style={[
															styles.chip,
															sel && styles.chipSelected,
														]}
													>
														<Text
															style={[
																styles.chipText,
																sel && styles.chipTextSelected,
															]}
														>
															{opt.label}
														</Text>
													</NeumorphicView>
												</TouchableOpacity>
											);
										})}
									</View>

									<View style={styles.divider} />

									<View style={styles.numberRow}>
										<View style={{ flex: 1 }}>
											<SubLabel>
												Tank size ({vehicle.is_ev ? "kWh" : "L"})
											</SubLabel>
											<NeumorphicView pressed style={styles.numberInputWrap}>
												<TextInput
													style={styles.numberInput}
													value={tankDraft}
													onChangeText={setTankDraft}
													onBlur={commitTankSize}
													keyboardType="decimal-pad"
													returnKeyType="done"
													placeholder="50"
													placeholderTextColor={Colors.textMuted}
												/>
											</NeumorphicView>
										</View>
										<View style={{ width: Spacing.md }} />
										<View style={{ flex: 1 }}>
											<SubLabel>
												Consumption ({vehicle.is_ev ? "kWh/100km" : "L/100km"})
											</SubLabel>
											<NeumorphicView pressed style={styles.numberInputWrap}>
												<TextInput
													style={styles.numberInput}
													value={consumptionDraft}
													onChangeText={setConsumptionDraft}
													onBlur={commitConsumption}
													keyboardType="decimal-pad"
													returnKeyType="done"
													placeholder="7.0"
													placeholderTextColor={Colors.textMuted}
												/>
											</NeumorphicView>
										</View>
									</View>
								</>
							)}
						</NeumorphicView>
					</Section>

					{/* ─── Privacy ───────────────────────────────────────────── */}
					<Section title="Privacy">
						<NeumorphicView style={styles.card}>
							{PRIVACY_ROWS.map((row, idx) => (
								<StaggeredFadeIn key={row.key} index={idx}>
									<View
										style={[
											styles.toggleRow,
											idx < PRIVACY_ROWS.length - 1 && styles.toggleDivider,
										]}
									>
										<View style={{ flex: 1 }}>
											<Text style={styles.toggleLabel}>{row.label}</Text>
											<Text style={styles.toggleHint}>{row.hint}</Text>
										</View>
										<Switch
											value={privacy[row.key]}
											onValueChange={() => togglePrivacy(row.key)}
											trackColor={{
												false: Colors.primaryDim,
												true: Colors.primary,
											}}
											thumbColor="#fff"
											ios_backgroundColor={Colors.primaryDim}
										/>
									</View>
								</StaggeredFadeIn>
							))}
						</NeumorphicView>
					</Section>

					{/* ─── Data ──────────────────────────────────────────────── */}
					<Section title="Data">
						<View style={styles.actionStack}>
							<Button
								label="Download my data"
								variant="ghost"
								onPress={handleDownloadData}
							/>
							<Button
								label="Wipe location history"
								variant="ghost"
								onPress={handleWipeLocationHistory}
							/>
							<Button
								label="Delete all my data"
								variant="danger"
								onPress={handleDeleteAllRequest}
							/>
						</View>
					</Section>

					{/* ─── Preferences ───────────────────────────────────────── */}
					<Section title="Preferences">
						<NeumorphicView style={styles.card}>
							<SubLabel>Language</SubLabel>
							<View style={styles.chipRow}>
								{LANGUAGE_OPTIONS.map((opt) => {
									const sel = language === opt.code;
									return (
										<TouchableOpacity
											key={opt.code}
											onPress={() => persistLanguage(opt.code)}
											activeOpacity={0.85}
											style={styles.chipTap}
										>
											<NeumorphicView
												pressed={sel}
												style={[styles.chip, sel && styles.chipSelected]}
											>
												<Text
													style={[
														styles.chipText,
														sel && styles.chipTextSelected,
													]}
												>
													{opt.label}
												</Text>
											</NeumorphicView>
										</TouchableOpacity>
									);
								})}
							</View>

							<View style={styles.divider} />

							<SubLabel>Distance</SubLabel>
							<View style={styles.chipRow}>
								{(["km", "mi"] as const).map((opt) => {
									const sel = units.distance === opt;
									return (
										<TouchableOpacity
											key={opt}
											onPress={() => persistUnits({ ...units, distance: opt })}
											activeOpacity={0.85}
											style={styles.chipTap}
										>
											<NeumorphicView
												pressed={sel}
												style={[styles.chip, sel && styles.chipSelected]}
											>
												<Text
													style={[
														styles.chipText,
														sel && styles.chipTextSelected,
													]}
												>
													{opt === "km" ? "Kilometres" : "Miles"}
												</Text>
											</NeumorphicView>
										</TouchableOpacity>
									);
								})}
							</View>

							<View style={styles.divider} />

							<SubLabel>Fuel economy</SubLabel>
							<View style={styles.chipRow}>
								{(["lp100", "mpg"] as const).map((opt) => {
									const sel = units.fuel === opt;
									return (
										<TouchableOpacity
											key={opt}
											onPress={() => persistUnits({ ...units, fuel: opt })}
											activeOpacity={0.85}
											style={styles.chipTap}
										>
											<NeumorphicView
												pressed={sel}
												style={[styles.chip, sel && styles.chipSelected]}
											>
												<Text
													style={[
														styles.chipText,
														sel && styles.chipTextSelected,
													]}
												>
													{opt === "lp100" ? "L/100km" : "MPG"}
												</Text>
											</NeumorphicView>
										</TouchableOpacity>
									);
								})}
							</View>
						</NeumorphicView>
					</Section>

					{/* ─── About ─────────────────────────────────────────────── */}
					<Section title="About">
						<NeumorphicView style={styles.aboutCard}>
							<Text style={styles.aboutTitle}>Konvoy</Text>
							<Text style={styles.aboutSub}>
								Version {APP_VERSION} · Bachelor thesis project
							</Text>
						</NeumorphicView>
					</Section>

					{/* ─── Reset onboarding ─────────────────────────────────── */}
					<View style={styles.actionStack}>
						<Button
							label="Reset onboarding"
							variant="ghost"
							onPress={resetOnboarding}
						/>
					</View>
				</ScrollView>

				{/* ─── Toast ────────────────────────────────────────────────── */}
				{toast ? (
					<View pointerEvents="none" style={styles.toastWrap}>
						<NeumorphicView style={styles.toast}>
							<Text style={styles.toastText}>{toast}</Text>
						</NeumorphicView>
					</View>
				) : null}
			</FadeInView>

			{/* ─── Edit-name modal ─────────────────────────────────────────── */}
			<Modal
				visible={nameModalOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setNameModalOpen(false)}
			>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
					style={styles.modalRoot}
				>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Display name</Text>
						<Text style={styles.modalSub}>How others see you in convoys.</Text>
						<NeumorphicView pressed style={styles.modalInputWrap}>
							<TextInput
								style={styles.modalInput}
								value={draftName}
								onChangeText={setDraftName}
								placeholder="Driver"
								placeholderTextColor={Colors.textMuted}
								autoFocus
								maxLength={40}
							/>
						</NeumorphicView>
						<View style={styles.modalActions}>
							<Button
								label="Cancel"
								variant="ghost"
								onPress={() => setNameModalOpen(false)}
								style={{ flex: 1 } as any}
							/>
							<View style={{ width: Spacing.md }} />
							<Button
								label="Save"
								onPress={saveDisplayName}
								loading={savingName}
								disabled={!draftName.trim() || savingName}
								style={{ flex: 1 } as any}
							/>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* ─── Delete-everything modal (type DELETE) ──────────────────── */}
			<Modal
				visible={deleteModalOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setDeleteModalOpen(false)}
			>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
					style={styles.modalRoot}
				>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>This cannot be undone.</Text>
						<Text style={styles.modalSub}>
							Type <Text style={styles.modalEmphasis}>DELETE</Text> to confirm.
						</Text>
						<NeumorphicView pressed style={styles.modalInputWrap}>
							<TextInput
								style={styles.modalInput}
								value={deleteConfirm}
								onChangeText={setDeleteConfirm}
								placeholder="DELETE"
								placeholderTextColor={Colors.textMuted}
								autoCapitalize="characters"
								autoCorrect={false}
								autoFocus
							/>
						</NeumorphicView>
						<View style={styles.modalActions}>
							<Button
								label="Cancel"
								variant="ghost"
								onPress={() => setDeleteModalOpen(false)}
								style={{ flex: 1 } as any}
							/>
							<View style={{ width: Spacing.md }} />
							<Button
								label="Delete"
								variant="danger"
								onPress={performDelete}
								loading={deleting}
								disabled={
									deleting ||
									deleteConfirm.trim().toUpperCase() !== "DELETE"
								}
								style={{ flex: 1 } as any}
							/>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</SafeAreaView>
	);
}

// ─── Small subcomponents ──────────────────────────────────────────────────────
function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<View style={styles.section}>
			<Text style={styles.sectionLabel}>{title}</Text>
			{children}
		</View>
	);
}

function SubLabel({ children }: { children: React.ReactNode }) {
	return <Text style={styles.subLabel}>{children}</Text>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	center: { flex: 1, alignItems: "center", justifyContent: "center" },
	container: { padding: Spacing.xl, paddingBottom: Spacing.xxl * 2, gap: Spacing.lg },

	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.sm,
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
	title: {
		fontSize: FontSize.xxl,
		fontWeight: FontWeight.light,
		color: Colors.textPrimary,
		letterSpacing: -0.5,
		marginBottom: Spacing.md,
	},

	// Profile card
	profileCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.xl,
		padding: Spacing.lg,
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
	},
	avatar: {
		width: 56,
		height: 56,
		borderRadius: 28,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarLetter: {
		color: Colors.bgElevated,
		fontSize: FontSize.xl,
		fontWeight: FontWeight.semibold,
	},
	profileName: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		letterSpacing: -0.3,
	},
	profileSub: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: 4,
		fontWeight: FontWeight.regular,
	},
	chevron: {
		fontSize: 24,
		color: Colors.textMuted,
		fontWeight: FontWeight.light,
	},

	// Sections
	section: { gap: Spacing.md },
	sectionLabel: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		marginBottom: Spacing.sm,
	},
	subLabel: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		marginBottom: Spacing.sm,
	},

	card: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.xl,
		padding: Spacing.lg,
	},
	divider: {
		height: 1,
		backgroundColor: Colors.borderSubtle,
		marginVertical: Spacing.md,
	},
	muted: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},

	// Chips
	chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
	chipTap: {},
	chip: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.full,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		minHeight: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	chipSelected: { backgroundColor: Colors.bgElevated },
	chipText: {
		fontSize: FontSize.sm,
		color: Colors.textSecondary,
		fontWeight: FontWeight.medium,
	},
	chipTextSelected: {
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},

	// Number inputs (tank, consumption)
	numberRow: { flexDirection: "row", alignItems: "flex-start" },
	numberInputWrap: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
	},
	numberInput: {
		backgroundColor: "transparent",
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},

	// Privacy toggle rows
	toggleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		paddingVertical: Spacing.md,
	},
	toggleDivider: {
		borderBottomWidth: 1,
		borderBottomColor: Colors.borderSubtle,
	},
	toggleLabel: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},
	toggleHint: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: 4,
		fontWeight: FontWeight.regular,
	},

	actionStack: { gap: Spacing.md },

	// About
	aboutCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.xl,
		padding: Spacing.lg,
		alignItems: "center",
	},
	aboutTitle: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.light,
		color: Colors.textPrimary,
		letterSpacing: -0.3,
	},
	aboutSub: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: 4,
		fontWeight: FontWeight.regular,
	},

	// Toast
	toastWrap: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: Spacing.xxl,
		alignItems: "center",
	},
	toast: {
		backgroundColor: Colors.primary,
		borderRadius: Radius.full,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		minWidth: 120,
		alignItems: "center",
	},
	toastText: {
		color: Colors.bgElevated,
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.3,
	},

	// Modals
	modalRoot: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.4)",
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
	},
	modalCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.xl,
		padding: Spacing.xl,
		width: "100%",
		maxWidth: 400,
	},
	modalTitle: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		marginBottom: Spacing.sm,
	},
	modalSub: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginBottom: Spacing.lg,
		fontWeight: FontWeight.regular,
		lineHeight: 20,
	},
	modalEmphasis: {
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},
	modalInputWrap: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
		marginBottom: Spacing.lg,
	},
	modalInput: {
		backgroundColor: "transparent",
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.medium,
	},
	modalActions: { flexDirection: "row", alignItems: "center" },
});
