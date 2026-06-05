import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
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

export default function PermissionsScreen() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	async function handleAllow() {
		setLoading(true);
		try {
			await Location.requestForegroundPermissionsAsync();
			await Location.requestBackgroundPermissionsAsync();
			await Notifications.requestPermissionsAsync();
		} catch {
			// User can deny — app will handle limited mode
		} finally {
			setLoading(false);
			router.push("/onboarding/profile");
		}
	}

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView contentContainerStyle={styles.container}>
					<View style={styles.dots}>
						<View style={styles.dotDone} />
						<View style={styles.dotPill} />
						<View style={styles.dotInactive} />
						<View style={styles.dotInactive} />
					</View>

					<Text style={styles.title}>A few permissions first</Text>
					<Text style={styles.sub}>
						Only active during your convoy. Auto-off when the trip ends.
					</Text>

					<View style={styles.permList}>
						{PERMISSIONS.map((p, index) => (
							<StaggeredFadeIn key={p.name} index={index}>
								<View style={[styles.permCard, Shadows.card]}>
									<View style={styles.permText}>
										<Text style={styles.permName}>{p.name}</Text>
										<Text style={styles.permDesc}>{p.desc}</Text>
									</View>
									<View
										style={[
											styles.badge,
											p.required ? styles.badgeReq : styles.badgeOpt,
										]}
									>
										<Text
											style={[
												styles.badgeText,
												p.required ? styles.badgeTextReq : styles.badgeTextOpt,
											]}
										>
											{p.required ? "Required" : "Optional"}
										</Text>
									</View>
								</View>
							</StaggeredFadeIn>
						))}
					</View>

					<View style={styles.note}>
						<View style={styles.noteAccentBar} />
						<Text style={styles.noteText}>
							Your location is only visible to convoy members and is
							auto-deleted when the trip ends.
						</Text>
					</View>

					<View style={styles.actions}>
						<Button
							label="Allow & continue"
							onPress={handleAllow}
							loading={loading}
						/>
						<Button
							label="Set up manually later"
							variant="ghost"
							onPress={() => router.push("/onboarding/profile")}
						/>
					</View>
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

const PERMISSIONS = [
	{ name: "Location", desc: "Share live position with convoy only", required: true },
	{ name: "Notifications", desc: "Stop alerts and emergencies", required: true },
	{ name: "Camera", desc: "Scan QR codes to join", required: false },
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
	dotDone: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: Colors.primary,
	},
	dotPill: {
		width: 24,
		height: 6,
		borderRadius: 3,
		backgroundColor: Colors.primary,
	},
	dotInactive: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: "#1a1a1a",
	},

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

	permList: { gap: Spacing.md, marginBottom: Spacing.lg },
	permCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	permText: { flex: 1 },
	permName: {
		fontSize: FontSize.md,
		fontWeight: "600",
		color: Colors.textPrimary,
	},
	permDesc: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: 4,
		lineHeight: 18,
		fontWeight: "400",
	},
	badge: {
		borderRadius: Radius.full,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 5,
	},
	badgeReq: { backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryBorder },
	badgeOpt: { backgroundColor: "rgba(255,255,255,0.05)" },
	badgeText: { fontSize: FontSize.xs, fontWeight: "600", letterSpacing: 0.3 },
	badgeTextReq: { color: Colors.primary },
	badgeTextOpt: { color: Colors.textMuted },

	note: {
		flexDirection: "row",
		backgroundColor: Colors.bgAccent,
		borderRadius: Radius.lg,
		marginBottom: Spacing.xl,
		overflow: "hidden",
	},
	noteAccentBar: {
		width: 3,
		backgroundColor: Colors.primary,
		borderTopLeftRadius: Radius.lg,
		borderBottomLeftRadius: Radius.lg,
	},
	noteText: {
		flex: 1,
		padding: Spacing.lg,
		fontSize: FontSize.sm,
		color: Colors.textSecondary,
		lineHeight: 20,
		fontWeight: "400",
	},

	actions: { gap: Spacing.md },
});
