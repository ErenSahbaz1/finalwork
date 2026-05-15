import React from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../src/components/Button";
import { Colors, Spacing, FontSize, Radius } from "../src/constants/theme";
export default function HomeScreen() {
	const router = useRouter();

	return (
		<SafeAreaView style={styles.safe}>
			<View style={styles.container}>
				<View style={styles.header}>
					<Text style={styles.logo}>Konvoy</Text>
					<TouchableOpacity onPress={() => router.push("/settings")}>
						<Text style={styles.settingsIcon}>⚙️</Text>
					</TouchableOpacity>
				</View>

				<View style={styles.hero}>
					<Text style={styles.heroText}>Ready to roll?</Text>
					<Text style={styles.heroSub}>
						Start a convoy or join one with an invite code.
					</Text>
				</View>

				<View style={styles.actions}>
					<TouchableOpacity
						style={styles.bigBtn}
						onPress={() => router.push("/convoy/create")}
						activeOpacity={0.8}
					>
						<Text style={styles.bigBtnEmoji}>🚗</Text>
						<View>
							<Text style={styles.bigBtnTitle}>Start a convoy</Text>
							<Text style={styles.bigBtnSub}>You lead, others follow</Text>
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						style={[styles.bigBtn, styles.bigBtnSecondary]}
						onPress={() => router.push("/convoy/join")}
						activeOpacity={0.8}
					>
						<Text style={styles.bigBtnEmoji}>🔗</Text>
						<View>
							<Text style={styles.bigBtnTitle}>Join a convoy</Text>
							<Text style={styles.bigBtnSub}>Enter a code or scan QR</Text>
						</View>
					</TouchableOpacity>
				</View>

				{/* Past convoys placeholder */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Recent convoys</Text>
					<View style={styles.emptyState}>
						<Text style={styles.emptyIcon}>🛣️</Text>
						<Text style={styles.emptyText}>
							No convoys yet.{"\n"}Start your first one!
						</Text>
					</View>
				</View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	container: { flex: 1, padding: Spacing.xl },
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.xl,
	},
	logo: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.primary },
	settingsIcon: { fontSize: 22 },
	hero: { marginBottom: Spacing.xl },
	heroText: {
		fontSize: FontSize.xxl,
		fontWeight: "700",
		color: Colors.textPrimary,
	},
	heroSub: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: Spacing.xs,
	},
	actions: { gap: Spacing.md, marginBottom: Spacing.xl },
	bigBtn: {
		backgroundColor: Colors.primary,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
	},
	bigBtnSecondary: {
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	bigBtnEmoji: { fontSize: 28 },
	bigBtnTitle: {
		fontSize: FontSize.md,
		fontWeight: "700",
		color: Colors.textPrimary,
	},
	bigBtnSub: {
		fontSize: FontSize.xs,
		color: "rgba(255,255,255,0.6)",
		marginTop: 2,
	},
	section: { flex: 1 },
	sectionTitle: {
		fontSize: FontSize.sm,
		fontWeight: "600",
		color: Colors.textSecondary,
		marginBottom: Spacing.md,
	},
	emptyState: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.md,
	},
	emptyIcon: { fontSize: 40 },
	emptyText: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		textAlign: "center",
		lineHeight: 20,
	},
});
