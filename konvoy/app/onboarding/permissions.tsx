import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
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

export default function PermissionsScreen() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	async function handleAllow() {
		setLoading(true);
		try {
			await Location.requestForegroundPermissionsAsync();
			await Location.requestBackgroundPermissionsAsync();
			await Notifications.requestPermissionsAsync();
		} catch (e) {
			// User can deny — app will handle limited mode
		} finally {
			setLoading(false);
			router.push("/onboarding/profile");
		}
	}

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView contentContainerStyle={styles.container}>
					<View style={styles.dots}>
						<View style={[styles.dot, styles.dotDone]} />
						<View style={[styles.dot, styles.dotActive]} />
						<View style={styles.dot} />
						<View style={styles.dot} />
					</View>

					<Text style={styles.title}>A few permissions first</Text>
					<Text style={styles.sub}>
						Only active during your convoy. Auto-off when the trip ends.
					</Text>

					<View style={styles.permList}>
						{PERMISSIONS.map((p, index) => (
							<StaggeredFadeIn key={p.name} index={index}>
								<NeumorphicView style={styles.permCard}>
									<View style={styles.permText}>
										<Text style={styles.permName}>{p.name}</Text>
										<Text style={styles.permDesc}>{p.desc}</Text>
									</View>
									<NeumorphicView
										pressed
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
									</NeumorphicView>
								</NeumorphicView>
							</StaggeredFadeIn>
						))}
					</View>

					<NeumorphicView pressed style={styles.note}>
						<Text style={styles.noteText}>
							Your location is only visible to convoy members and is
							auto-deleted when the trip ends.
						</Text>
					</NeumorphicView>

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
	{
		name: "Location",
		desc: "Share live position with convoy only",
		required: true,
	},
	{
		name: "Notifications",
		desc: "Stop alerts and emergencies",
		required: true,
	},
	{ name: "Camera", desc: "Scan QR codes to join", required: false },
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
	permList: { gap: Spacing.md, marginBottom: Spacing.lg },
	permCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
	},
	permText: { flex: 1 },
	permName: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},
	permDesc: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: 4,
		lineHeight: 18,
		fontWeight: FontWeight.regular,
	},
	badge: {
		borderRadius: Radius.full,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 6,
	},
	badgeReq: { backgroundColor: Colors.primary },
	badgeOpt: { backgroundColor: Colors.bgElevated },
	badgeText: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.3,
	},
	badgeTextReq: { color: "#fff" },
	badgeTextOpt: { color: Colors.textMuted },
	note: {
		padding: Spacing.lg,
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		marginBottom: Spacing.xl,
	},
	noteText: {
		fontSize: FontSize.sm,
		color: Colors.textSecondary,
		lineHeight: 20,
		fontWeight: FontWeight.regular,
	},
	actions: { gap: Spacing.md },
});
