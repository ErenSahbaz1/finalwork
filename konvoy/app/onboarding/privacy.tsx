import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	Switch,
	ScrollView,
	StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
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

interface PrivacySettings {
	exactLocation: boolean;
	autoWipe: boolean;
	shareVehicleProfile: boolean;
}

export default function PrivacyScreen() {
	const router = useRouter();
	const [settings, setSettings] = useState<PrivacySettings>({
		exactLocation: true,
		autoWipe: true,
		shareVehicleProfile: true,
	});

	function toggle(key: keyof PrivacySettings) {
		setSettings((s) => ({ ...s, [key]: !s[key] }));
	}

	function handleStart() {
		router.replace("/");
	}

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView contentContainerStyle={styles.container}>
					<View style={styles.dots}>
						{[0, 1, 2, 3].map((i) => (
							<View
								key={i}
								style={[
									i === 3 ? styles.dotPill : styles.dotDone,
								]}
							/>
						))}
					</View>

					<Text style={styles.title}>Your privacy, your rules</Text>
					<Text style={styles.sub}>Change these anytime during your trip.</Text>

					<View style={styles.toggleList}>
						{TOGGLES.map((t, index) => (
							<StaggeredFadeIn key={t.key} index={index}>
								<View style={[styles.toggleRow, Shadows.card]}>
									<View style={{ flex: 1 }}>
										<Text style={styles.toggleName}>{t.name}</Text>
										<Text style={styles.toggleDesc}>{t.desc}</Text>
									</View>
									<Switch
										value={settings[t.key as keyof PrivacySettings]}
										onValueChange={() => toggle(t.key as keyof PrivacySettings)}
										trackColor={{ false: "#1a1a1a", true: Colors.primary }}
										thumbColor="#fff"
										ios_backgroundColor="#1a1a1a"
									/>
								</View>
							</StaggeredFadeIn>
						))}
					</View>

					<View style={styles.infoPill}>
						<View style={styles.infoAccentBar} />
						<Text style={styles.infoText}>
							Location sharing stops automatically 48h after the convoy ends.
						</Text>
					</View>

					<Button label="Start using Convoi" onPress={handleStart} />
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

const TOGGLES = [
	{ key: "exactLocation", name: "Exact location", desc: "Share precise GPS with convoy" },
	{ key: "autoWipe", name: "Auto-wipe on trip end", desc: "Delete all data when convoy closes" },
	{ key: "shareVehicleProfile", name: "Share vehicle profile", desc: "Helps plan smarter fuel stops" },
];

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },

	dots: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 6,
		marginBottom: Spacing.xxl,
	},
	dotDone: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
	dotPill: { width: 24, height: 6, borderRadius: 3, backgroundColor: Colors.primary },

	title: {
		fontSize: FontSize.xxl,
		fontWeight: "700",
		color: Colors.textPrimary,
		marginBottom: Spacing.sm,
		letterSpacing: -0.5,
	},
	sub: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		lineHeight: 22,
		marginBottom: Spacing.xl,
		fontWeight: "400",
	},

	toggleList: { gap: Spacing.md, marginBottom: Spacing.xl },
	toggleRow: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	toggleName: {
		fontSize: FontSize.md,
		fontWeight: "600",
		color: Colors.textPrimary,
	},
	toggleDesc: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: 4,
		fontWeight: "400",
	},

	infoPill: {
		flexDirection: "row",
		backgroundColor: Colors.bgAccent,
		borderRadius: Radius.lg,
		marginBottom: Spacing.xl,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: Colors.borderAccent,
	},
	infoAccentBar: {
		width: 3,
		backgroundColor: Colors.primary,
	},
	infoText: {
		flex: 1,
		padding: Spacing.lg,
		fontSize: FontSize.sm,
		color: Colors.primary,
		textAlign: "center",
		lineHeight: 20,
		fontWeight: "400",
	},
});
