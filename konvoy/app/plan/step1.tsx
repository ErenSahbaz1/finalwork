import React from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TouchableOpacity,
	ScrollView,
	TextInput,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { NeumorphicView } from "../../src/components/NeumorphicView";
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

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? "";

export default function PlanStep1() {
	const router = useRouter();
	const origin = usePlanStore((s) => s.origin);
	const destination = usePlanStore((s) => s.destination);
	const setOrigin = usePlanStore((s) => s.setOrigin);
	const setDestination = usePlanStore((s) => s.setDestination);

	const canContinue = Boolean(origin && destination);

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<KeyboardAvoidingView
					style={styles.flex}
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
				>
					<ScrollView
						contentContainerStyle={styles.container}
						keyboardShouldPersistTaps="handled"
						keyboardDismissMode="interactive"
						nestedScrollEnabled
						showsVerticalScrollIndicator={false}
					>
						<HeaderRow onBack={() => router.back()} />
						<StepHeader
							step={1}
							title="Where to?"
							sub="Pick your start and finish."
						/>

						<SectionLabel>📍 Starting from</SectionLabel>
						<PlaceField
							value={origin}
							onPick={(p) => setOrigin(p)}
							placeholder="Brussels, Belgium"
						/>

						<SectionLabel>🏁 Going to</SectionLabel>
						<PlaceField
							value={destination}
							onPick={(p) => setDestination(p)}
							placeholder="Istanbul, Türkiye"
						/>

						{origin && destination ? (
							<NeumorphicView style={styles.preview}>
								<Text style={styles.previewName} numberOfLines={1}>
									{origin.name}
								</Text>
								<Text style={styles.previewArrow}>↓</Text>
								<Text style={styles.previewName} numberOfLines={1}>
									{destination.name}
								</Text>
							</NeumorphicView>
						) : null}

						<View style={styles.actions}>
							<Button
								label="Continue"
								onPress={() => router.push("/plan/step2")}
								disabled={!canContinue}
							/>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</FadeInView>
		</SafeAreaView>
	);
}

function HeaderRow({ onBack }: { onBack: () => void }) {
	return (
		<View style={styles.header}>
			<TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
				<Text style={styles.backText}>Back</Text>
			</TouchableOpacity>
			<View style={{ width: 50 }} />
		</View>
	);
}

function PlaceField({
	value,
	onPick,
	placeholder,
}: {
	value: { name: string; lat: number; lng: number } | null;
	onPick: (p: { name: string; lat: number; lng: number } | null) => void;
	placeholder: string;
}) {
	if (!PLACES_KEY) {
		// Fallback when no Places API key is configured.
		return (
			<>
				<NeumorphicView pressed style={styles.fallbackWrap}>
					<TextInput
						style={styles.fallbackInput}
						placeholder={placeholder}
						placeholderTextColor={Colors.textMuted}
						value={value?.name ?? ""}
						onChangeText={(t) =>
							onPick(t.trim() ? { name: t, lat: 0, lng: 0 } : null)
						}
					/>
				</NeumorphicView>
				<Text style={styles.fallbackHint}>
					Add EXPO_PUBLIC_GOOGLE_PLACES_KEY to .env for autocomplete.
				</Text>
			</>
		);
	}
	return (
		<GooglePlacesAutocomplete
			placeholder={placeholder}
			fetchDetails
			debounce={400}
			minLength={2}
			keyboardShouldPersistTaps="handled"
			listViewDisplayed="auto"
			enablePoweredByContainer={false}
			onPress={(data, details = null) => {
				onPick({
					name: data.description,
					lat: details?.geometry?.location?.lat ?? 0,
					lng: details?.geometry?.location?.lng ?? 0,
				});
			}}
			query={{ key: PLACES_KEY, language: "en", types: "geocode" }}
			textInputProps={{
				placeholderTextColor: Colors.textMuted,
				onChangeText: (t: string) => {
					if (!t) onPick(null);
				},
			}}
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
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: {
		padding: Spacing.xl,
		// Generous bottom padding so the second (destination) autocomplete can
		// scroll above the keyboard and reveal its suggestion list.
		paddingBottom: 320,
		gap: Spacing.sm,
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
	fallbackWrap: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
		marginBottom: Spacing.sm,
	},
	fallbackInput: {
		backgroundColor: "transparent",
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
	},
	fallbackHint: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		fontStyle: "italic",
		marginBottom: Spacing.md,
	},
	preview: {
		backgroundColor: Colors.bgElevated,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		marginTop: Spacing.lg,
		alignItems: "center",
		gap: Spacing.xs,
	},
	previewName: {
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},
	previewArrow: {
		fontSize: 20,
		color: Colors.textMuted,
		fontWeight: FontWeight.light,
	},
	actions: { marginTop: Spacing.xl },
});
