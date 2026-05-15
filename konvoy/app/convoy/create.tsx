import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TextInput,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	Share,
} from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../../src/lib/supabase";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Colors, Spacing, FontSize, Radius } from "../../src/constants/theme";

// TODO: Replace with real user ID from auth
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

function generateInviteCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return Array.from({ length: 6 }, () =>
		chars.charAt(Math.floor(Math.random() * chars.length)),
	).join("");
}


export default function CreateConvoyScreen() {
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [createdConvoy, setCreatedConvoy] = useState<{
		id: string;
		invite_code: string;
	} | null>(null);

	async function handleCreate() {
		if (!title.trim()) {
			setError("Give your convoy a name first.");
			return;
		}
		setError("");
		setLoading(true);

		try {
			const invite_code = generateInviteCode();
			const expires_at = new Date(
				Date.now() + 48 * 60 * 60 * 1000,
			).toISOString();

			// TODO: Replace TEST_USER_ID with real auth user ID
			const { data, error: dbError } = await supabase
				.from("convoys")
				.insert({
					created_by: TEST_USER_ID,
					title: title.trim(),
					invite_code,
					status: "preparation",
					expires_at,
				})
				.select()
				.single();

			if (dbError) throw dbError;

			// Add creator as leader in convoy_members
			await supabase.from("convoy_members").insert({
				convoy_id: data.id,
				user_id: TEST_USER_ID,
				role: "leader",
				status: "online",
			});

			setCreatedConvoy({ id: data.id, invite_code: data.invite_code });
		} catch (e: any) {
			setError(e.message ?? "Something went wrong. Try again.");
		} finally {
			setLoading(false);
		}
	}

	async function handleShare() {
		if (!createdConvoy) return;
		await Share.share({
			message: `Join my Konvoy! 🚗\nUse code: ${createdConvoy.invite_code}\nOr open the app and enter the code manually.`,
		});
	}

	function handleGoToLobby() {
		if (!createdConvoy) return;
		router.push(`/convoy/${createdConvoy.id}/lobby`);
	}

	return (
		<SafeAreaView style={styles.safe}>
			<ScrollView
				contentContainerStyle={styles.container}
				keyboardShouldPersistTaps="handled"
			>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity
						onPress={() => router.back()}
						style={styles.backBtn}
					>
						<Text style={styles.backText}>← Back</Text>
					</TouchableOpacity>
					<Text style={styles.title}>New convoy</Text>
					<View style={{ width: 60 }} />
				</View>

				{!createdConvoy ? (
					/* ── Setup form ── */
					<View style={styles.form}>
						<View style={styles.heroIcon}>
							<Text style={styles.heroEmoji}>🚗</Text>
						</View>
						<Text style={styles.formTitle}>Set up your convoy</Text>
						<Text style={styles.formSub}>
							You'll be the leader. Share the invite code with your group.
						</Text>

						<Text style={styles.label}>Convoy name</Text>
						<TextInput
							style={[styles.input, error ? styles.inputError : null]}
							value={title}
							onChangeText={(t) => {
								setTitle(t);
								setError("");
							}}
							placeholder="e.g. Bursa 2026 🇹🇷"
							placeholderTextColor={Colors.textMuted}
							autoFocus
							maxLength={40}
						/>
						<Text style={styles.charCount}>{title.length}/40</Text>

						{error ? (
							<View style={styles.errorBox}>
								<Text style={styles.errorText}>⚠️ {error}</Text>
							</View>
						) : null}

						<Button
							label="Create convoy"
							onPress={handleCreate}
							loading={loading}
							disabled={!title.trim()}
							style={styles.createBtn}
						/>
					</View>
				) : (
					/* ── Success: show QR + code ── */
					<View style={styles.success}>
						<View style={styles.successHeader}>
							<Text style={styles.successEmoji}>🎉</Text>
							<Text style={styles.successTitle}>{title}</Text>
							<Text style={styles.successSub}>
								Your convoy is ready. Share the code below.
							</Text>
						</View>

						{/* QR Code */}
						<Card style={styles.qrCard}>
							<Text style={styles.qrLabel}>Scan to join</Text>
							<View style={styles.qrWrapper}>
								<QRCode
									value={createdConvoy.invite_code}
									size={180}
									color={Colors.textPrimary}
									backgroundColor={Colors.bgCard}
								/>
							</View>
						</Card>

						{/* Invite code */}
						<Card style={styles.codeCard}>
							<Text style={styles.codeLabel}>Or enter this code</Text>
							<Text style={styles.codeText}>{createdConvoy.invite_code}</Text>
							<Text style={styles.codeExpiry}>Expires in 48 hours</Text>
						</Card>

						{/* Actions */}
						<Button
							label="📤  Share invite"
							onPress={handleShare}
							style={styles.shareBtn}
						/>
						<Button
							label="Go to lobby →"
							onPress={handleGoToLobby}
							style={styles.lobbyBtn}
						/>
					</View>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	container: { padding: Spacing.xl, flexGrow: 1 },

	// Header
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.xl,
	},
	backBtn: { padding: Spacing.xs },
	backText: { fontSize: FontSize.sm, color: Colors.primary },
	title: {
		fontSize: FontSize.lg,
		fontWeight: "700",
		color: Colors.textPrimary,
	},

	// Form
	form: { flex: 1 },
	heroIcon: {
		width: 72,
		height: 72,
		borderRadius: 22,
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.primaryBorder,
		alignSelf: "center",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.lg,
	},
	heroEmoji: { fontSize: 36 },
	formTitle: {
		fontSize: FontSize.xl,
		fontWeight: "700",
		color: Colors.textPrimary,
		textAlign: "center",
		marginBottom: Spacing.xs,
	},
	formSub: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		textAlign: "center",
		lineHeight: 20,
		marginBottom: Spacing.xl,
	},
	label: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginBottom: Spacing.xs,
	},
	input: {
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.primary,
		borderRadius: Radius.md,
		padding: Spacing.md,
		fontSize: FontSize.lg,
		color: Colors.textPrimary,
		fontWeight: "600",
	},
	inputError: { borderColor: Colors.danger },
	charCount: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textAlign: "right",
		marginTop: Spacing.xs,
		marginBottom: Spacing.md,
	},
	errorBox: {
		backgroundColor: "rgba(226,75,74,0.1)",
		borderRadius: Radius.sm,
		borderWidth: 1,
		borderColor: Colors.danger,
		padding: Spacing.md,
		marginBottom: Spacing.md,
	},
	errorText: { fontSize: FontSize.sm, color: Colors.danger },
	createBtn: { marginTop: Spacing.md },

	// Success
	success: { flex: 1 },
	successHeader: { alignItems: "center", marginBottom: Spacing.xl },
	successEmoji: { fontSize: 48, marginBottom: Spacing.sm },
	successTitle: {
		fontSize: FontSize.xxl,
		fontWeight: "700",
		color: Colors.textPrimary,
		marginBottom: Spacing.xs,
	},
	successSub: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		textAlign: "center",
	},

	// QR
	qrCard: { alignItems: "center", marginBottom: Spacing.md },
	qrLabel: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: Spacing.md,
	},
	qrWrapper: {
		padding: Spacing.md,
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.md,
	},

	// Code
	codeCard: { alignItems: "center", marginBottom: Spacing.xl },
	codeLabel: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: Spacing.sm,
	},
	codeText: {
		fontSize: 38,
		fontWeight: "700",
		color: Colors.primary,
		letterSpacing: 8,
	},
	codeExpiry: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginTop: Spacing.xs,
	},

	// Buttons
	shareBtn: { marginBottom: Spacing.sm, backgroundColor: Colors.bgElevated },
	lobbyBtn: {},
});
