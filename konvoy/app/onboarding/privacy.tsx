import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	Switch,
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
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView contentContainerStyle={styles.container}>
					<View style={styles.dots}>
						{[0, 1, 2, 3].map((i) => (
							<View
								key={i}
								style={[
									styles.dot,
									i < 3 && styles.dotDone,
									i === 3 && styles.dotActive,
								]}
							/>
						))}
					</View>

					<Text style={styles.title}>Your privacy, your rules</Text>
					<Text style={styles.sub}>Change these anytime during your trip.</Text>

					<View style={styles.toggleList}>
						{TOGGLES.map((t, index) => (
							<StaggeredFadeIn key={t.key} index={index}>
								<NeumorphicView style={styles.toggleRow}>
									<View style={{ flex: 1 }}>
										<Text style={styles.toggleName}>{t.name}</Text>
										<Text style={styles.toggleDesc}>{t.desc}</Text>
									</View>
									<Switch
										value={settings[t.key as keyof PrivacySettings]}
										onValueChange={() => toggle(t.key as keyof PrivacySettings)}
										trackColor={{
											false: Colors.primaryDim,
											true: Colors.primary,
										}}
										thumbColor="#fff"
										ios_backgroundColor={Colors.primaryDim}
									/>
								</NeumorphicView>
							</StaggeredFadeIn>
						))}
					</View>

					<NeumorphicView pressed style={styles.infoPill}>
						<Text style={styles.infoText}>
							Location sharing stops automatically 48h after the convoy ends.
						</Text>
					</NeumorphicView>

					<Button label="Start using Convoi" onPress={handleStart} />
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

const TOGGLES = [
	{
		key: "exactLocation",
		name: "Exact location",
		desc: "Share precise GPS with convoy",
	},
	{
		key: "autoWipe",
		name: "Auto-wipe on trip end",
		desc: "Delete all data when convoy closes",
	},
	{
		key: "shareVehicleProfile",
		name: "Share vehicle profile",
		desc: "Helps plan smarter fuel stops",
	},
];

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
	dotDone: { backgroundColor: Colors.textPrimary },
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
	toggleList: { gap: Spacing.md, marginBottom: Spacing.xl },
	toggleRow: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
	},
	toggleName: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},
	toggleDesc: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: 4,
		fontWeight: FontWeight.regular,
	},
	infoPill: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.xl,
	},
	infoText: {
		fontSize: FontSize.sm,
		color: Colors.textSecondary,
		textAlign: "center",
		lineHeight: 20,
		fontWeight: FontWeight.regular,
	},
});
