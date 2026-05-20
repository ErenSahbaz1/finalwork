import React, { useEffect, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { StaggeredFadeIn } from "../../src/components/StaggeredFadeIn";
import { StepHeader, SectionLabel } from "../../src/components/PlanUI";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Spacing,
} from "../../src/constants/theme";
import { usePlanStore } from "../../src/store/planStore";
import { getAiSuggestions } from "../../src/lib/planner";

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? "";

export default function PlanStep5() {
	const router = useRouter();
	const origin = usePlanStore((s) => s.origin);
	const destination = usePlanStore((s) => s.destination);
	const tripDays = usePlanStore((s) => s.tripDays);
	const carCount = usePlanStore((s) => s.carCount);
	const stopTypes = usePlanStore((s) => s.stopTypes);
	const aiSuggestedPlaces = usePlanStore((s) => s.aiSuggestedPlaces);
	const setAiSuggestedPlaces = usePlanStore((s) => s.setAiSuggestedPlaces);
	const selectedAiPlaces = usePlanStore((s) => s.selectedAiPlaces);
	const toggleAiPlace = usePlanStore((s) => s.toggleAiPlace);
	const manualPlaces = usePlanStore((s) => s.manualPlaces);
	const addManualPlace = usePlanStore((s) => s.addManualPlace);
	const removeManualPlace = usePlanStore((s) => s.removeManualPlace);

	const [loadingAi, setLoadingAi] = useState(false);
	const [aiError, setAiError] = useState("");

	// Fetch AI suggestions on mount if we haven't already.
	useEffect(() => {
		if (aiSuggestedPlaces.length > 0 || !origin || !destination) return;
		let cancelled = false;
		(async () => {
			setLoadingAi(true);
			setAiError("");
			try {
				const result = await getAiSuggestions({
					origin,
					destination,
					tripDays,
					carCount,
					stopTypes,
				});
				if (!cancelled) setAiSuggestedPlaces(result);
			} catch (e: any) {
				if (!cancelled) {
					setAiError(e?.message ?? "Couldn't load AI suggestions.");
				}
			} finally {
				if (!cancelled) setLoadingAi(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [
		origin,
		destination,
		tripDays,
		carCount,
		stopTypes,
		aiSuggestedPlaces.length,
		setAiSuggestedPlaces,
	]);

	function isSelected(name: string) {
		return selectedAiPlaces.some((p) => p.name === name);
	}

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<KeyboardAvoidingView
					style={styles.flex}
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
				<ScrollView
					contentContainerStyle={styles.container}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="interactive"
					nestedScrollEnabled
				>
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
						step={5}
						title="Must-see along the way"
						sub="AI suggestions + anywhere you'd like to stop."
					/>

					{/* ── AI suggestions ─────────────────────────────────────────── */}
					<SectionLabel>✨ Suggested by AI</SectionLabel>

					{loadingAi ? (
						<View style={styles.skeletonList}>
							{[0, 1, 2].map((i) => (
								<NeumorphicView key={i} style={styles.skeletonCard}>
									<View style={styles.skeletonBarTitle} />
									<View style={styles.skeletonBar} />
								</NeumorphicView>
							))}
							<View style={styles.loadingRow}>
								<ActivityIndicator color={Colors.primary} />
								<Text style={styles.loadingText}>
									KonvoyAI is thinking…
								</Text>
							</View>
						</View>
					) : aiError ? (
						<NeumorphicView style={styles.errorBox}>
							<Text style={styles.errorText}>{aiError}</Text>
							<Button
								label="Try again"
								variant="ghost"
								onPress={() => setAiSuggestedPlaces([])}
								style={{ marginTop: Spacing.sm }}
							/>
						</NeumorphicView>
					) : aiSuggestedPlaces.length === 0 ? (
						<NeumorphicView style={styles.emptyBox}>
							<Text style={styles.emptyText}>
								No suggestions yet. Try refreshing the wizard.
							</Text>
						</NeumorphicView>
					) : (
						<View style={styles.aiList}>
							{aiSuggestedPlaces.map((p, idx) => {
								const sel = isSelected(p.name);
								return (
									<StaggeredFadeIn key={p.name + idx} index={idx}>
										<NeumorphicView style={styles.aiCard}>
											<View style={styles.aiBody}>
												<Text style={styles.aiName}>{p.name}</Text>
												<Text style={styles.aiReason} numberOfLines={2}>
													{p.reason}
												</Text>
											</View>
											<TouchableOpacity
												onPress={() => toggleAiPlace(p)}
												activeOpacity={0.85}
												style={styles.addBtnTap}
											>
												<NeumorphicView
													pressed={sel}
													style={[
														styles.addBtn,
														sel && styles.addBtnSel,
													]}
												>
													<Text
														style={[
															styles.addBtnText,
															sel && styles.addBtnTextSel,
														]}
													>
														{sel ? "✓ Added" : "+ Add"}
													</Text>
												</NeumorphicView>
											</TouchableOpacity>
										</NeumorphicView>
									</StaggeredFadeIn>
								);
							})}
						</View>
					)}

					{/* ── Manual places ──────────────────────────────────────────── */}
					<SectionLabel>📍 Your own places</SectionLabel>

					{PLACES_KEY ? (
						<GooglePlacesAutocomplete
							placeholder="Add a place you want to visit…"
							fetchDetails
							debounce={400}
							minLength={2}
							keyboardShouldPersistTaps="handled"
							listViewDisplayed="auto"
							enablePoweredByContainer={false}
							onPress={(data, details = null) => {
								addManualPlace({
									name: data.description,
									lat: details?.geometry?.location?.lat ?? 0,
									lng: details?.geometry?.location?.lng ?? 0,
								});
							}}
							query={{
								key: PLACES_KEY,
								language: "en",
								types: "establishment|geocode",
							}}
							textInputProps={{ placeholderTextColor: Colors.textMuted }}
							styles={{
								container: { flex: 0, marginBottom: Spacing.md },
								textInput: {
									backgroundColor: "#ffffff",
									borderRadius: 12,
									borderWidth: 1,
									borderColor: "#e8e8e8",
									fontSize: 15,
									color: "#1a1a1a",
									paddingHorizontal: 14,
									height: 48,
								},
								listView: {
									backgroundColor: "#ffffff",
									borderRadius: 12,
									marginTop: 4,
									shadowColor: "#000",
									shadowOffset: { width: 0, height: 4 },
									shadowOpacity: 0.08,
									shadowRadius: 12,
									elevation: 4,
								},
								row: { backgroundColor: "#ffffff", padding: 12 },
								description: { fontSize: 14, color: "#1a1a1a" },
							}}
						/>
					) : (
						<Text style={styles.placesHint}>
							Add EXPO_PUBLIC_GOOGLE_PLACES_KEY to .env for place search.
						</Text>
					)}

					<View style={styles.manualList}>
						{manualPlaces.map((p) => (
							<NeumorphicView key={p.name} style={styles.manualRow}>
								<Text style={styles.manualPin}>📍</Text>
								<Text style={styles.manualName} numberOfLines={1}>
									{p.name}
								</Text>
								<TouchableOpacity
									onPress={() => removeManualPlace(p.name)}
									hitSlop={10}
									style={styles.manualRemove}
								>
									<Text style={styles.manualRemoveText}>✕</Text>
								</TouchableOpacity>
							</NeumorphicView>
						))}
					</View>

					<View style={styles.actions}>
						<Button
							label="Generate routes"
							onPress={() => router.push("/plan/results")}
						/>
					</View>
				</ScrollView>
				</KeyboardAvoidingView>
			</FadeInView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: {
		padding: Spacing.xl,
		// Extra room so the manual-places autocomplete dropdown can scroll
		// above the on-screen keyboard.
		paddingBottom: 320,
	},
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

	// AI
	aiList: { gap: Spacing.md, marginBottom: Spacing.xl },
	aiCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		gap: Spacing.md,
	},
	aiBody: { flex: 1 },
	aiName: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		marginBottom: 4,
	},
	aiReason: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		lineHeight: 18,
		fontWeight: FontWeight.regular,
	},
	addBtnTap: {},
	addBtn: {
		backgroundColor: Colors.bgElevated,
		borderRadius: Radius.full,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
		minHeight: 36,
		alignItems: "center",
		justifyContent: "center",
	},
	addBtnSel: { backgroundColor: Colors.primary },
	addBtnText: {
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},
	addBtnTextSel: { color: Colors.bgElevated },

	// Skeleton / loading
	skeletonList: { gap: Spacing.md, marginBottom: Spacing.lg },
	skeletonCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		gap: Spacing.sm,
	},
	skeletonBarTitle: {
		height: 14,
		width: "60%",
		borderRadius: 4,
		backgroundColor: Colors.primaryDim,
	},
	skeletonBar: {
		height: 10,
		width: "85%",
		borderRadius: 4,
		backgroundColor: Colors.primaryDim,
		opacity: 0.6,
	},
	loadingRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		marginTop: Spacing.sm,
	},
	loadingText: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.medium,
	},

	errorBox: {
		backgroundColor: "rgba(220,38,38,0.08)",
		borderRadius: Radius.lg,
		padding: Spacing.md,
		marginBottom: Spacing.lg,
	},
	errorText: {
		fontSize: FontSize.sm,
		color: Colors.danger,
		fontWeight: FontWeight.medium,
	},
	emptyBox: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.lg,
		alignItems: "center",
	},
	emptyText: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},

	// Manual
	placesHint: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		fontStyle: "italic",
		marginBottom: Spacing.md,
	},
	manualList: { gap: Spacing.sm, marginBottom: Spacing.lg },
	manualRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		gap: Spacing.sm,
		minHeight: 48,
	},
	manualPin: { fontSize: 16 },
	manualName: {
		flex: 1,
		fontSize: FontSize.sm,
		color: Colors.textPrimary,
		fontWeight: FontWeight.medium,
	},
	manualRemove: {
		width: 28,
		height: 28,
		alignItems: "center",
		justifyContent: "center",
	},
	manualRemoveText: {
		fontSize: 16,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},

	actions: { marginTop: Spacing.xl },
});
