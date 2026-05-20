import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TextInput,
	ScrollView,
	TouchableOpacity,
	Share,
} from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../../src/lib/supabase";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { SoftBackground } from "../../src/components/SoftBackground";
import {
	Colors,
	Spacing,
	FontSize,
	Radius,
	FontWeight,
	Mono,
	Sizing,
} from "../../src/constants/theme";
import { useUserStore } from "../../src/store/userStore";

function generateInviteCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return Array.from({ length: 6 }, () =>
		chars.charAt(Math.floor(Math.random() * chars.length)),
	).join("");
}

export default function CreateConvoyScreen() {
	const router = useRouter();
	const userId = useUserStore((s) => s.userId);
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
		if (!userId) {
			setError("Still signing you in — try again in a sec.");
			return;
		}
		setError("");
		setLoading(true);

		try {
			const invite_code = generateInviteCode();
			const expires_at = new Date(
				Date.now() + 48 * 60 * 60 * 1000,
			).toISOString();

			const { data, error: dbError } = await supabase
				.from("convoys")
				.insert({
					created_by: userId,
					title: title.trim(),
					invite_code,
					status: "preparation",
					expires_at,
				})
				.select()
				.single();

			if (dbError) throw dbError;

			await supabase.from("convoy_members").insert({
				convoy_id: data.id,
				user_id: userId,
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
			message: `Join my Convoi. Use code: ${createdConvoy.invite_code}`,
		});
	}

	function handleGoToLobby() {
		if (!createdConvoy) return;
		router.push(`/convoy/${createdConvoy.id}/lobby`);
	}

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView
					contentContainerStyle={styles.container}
					keyboardShouldPersistTaps="handled"
				>
					<View style={styles.header}>
						<TouchableOpacity
							onPress={() => router.back()}
							style={styles.backBtn}
							hitSlop={12}
						>
							<Text style={styles.backText}>Back</Text>
						</TouchableOpacity>
						<View style={{ width: 50 }} />
					</View>

					{!createdConvoy ? (
						<View style={styles.form}>
							<Text style={styles.title}>New convoy</Text>
							<Text style={styles.sub}>
								You'll be the leader. Share the invite code with your group.
							</Text>

							<Text style={styles.label}>Convoy name</Text>
							<NeumorphicView pressed style={styles.inputWrap}>
								<TextInput
									style={styles.input}
									value={title}
									onChangeText={(t) => {
										setTitle(t);
										setError("");
									}}
									placeholder="Bursa 2026"
									placeholderTextColor={Colors.textMuted}
									autoFocus
									maxLength={40}
								/>
							</NeumorphicView>
							<Text style={styles.charCount}>{title.length}/40</Text>

							{error ? (
								<NeumorphicView style={styles.errorBox}>
									<Text style={styles.errorText}>{error}</Text>
								</NeumorphicView>
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
						<View style={styles.success}>
							<Text style={styles.successTitle}>{title}</Text>
							<Text style={styles.successSub}>
								Your convoy is ready. Share the code below.
							</Text>

							<NeumorphicView style={styles.qrCard}>
								<Text style={styles.qrLabel}>Scan to join</Text>
								<View style={styles.qrWrapper}>
									<QRCode
										value={createdConvoy.invite_code}
										size={200}
										color="#000000"
										backgroundColor="#ffffff"
									/>
								</View>
								<Text style={styles.codeLabel}>or enter this code</Text>
								<Text style={styles.codeText}>{createdConvoy.invite_code}</Text>
								<Text style={styles.codeExpiry}>Expires in 48 hours</Text>
							</NeumorphicView>

							<View style={styles.successActions}>
								<Button label="Share invite" onPress={handleShare} />
								<Button
									label="Go to lobby"
									variant="ghost"
									onPress={handleGoToLobby}
								/>
							</View>
						</View>
					)}
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: { padding: Spacing.xl, flexGrow: 1 },

	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.xl,
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

	form: { flex: 1 },
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
	label: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		marginBottom: Spacing.sm,
	},
	inputWrap: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
	},
	input: {
		backgroundColor: "transparent",
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
	},
	charCount: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textAlign: "right",
		marginTop: 6,
		marginBottom: Spacing.md,
		fontWeight: FontWeight.regular,
	},
	errorBox: {
		backgroundColor: "rgba(220,38,38,0.08)",
		borderRadius: Radius.lg,
		padding: Spacing.md,
		marginBottom: Spacing.md,
	},
	errorText: {
		fontSize: FontSize.sm,
		color: Colors.danger,
		fontWeight: FontWeight.medium,
	},
	createBtn: { marginTop: Spacing.md },

	success: { flex: 1, alignItems: "stretch" },
	successTitle: {
		fontSize: FontSize.xxl,
		fontWeight: FontWeight.light,
		color: Colors.textPrimary,
		marginBottom: Spacing.sm,
		letterSpacing: -0.5,
	},
	successSub: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		lineHeight: 22,
		marginBottom: Spacing.xl,
		fontWeight: FontWeight.regular,
	},

	qrCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.xl,
		padding: Spacing.xl,
		alignItems: "center",
		marginBottom: Spacing.xl,
	},
	qrLabel: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		fontWeight: FontWeight.semibold,
		marginBottom: Spacing.lg,
	},
	qrWrapper: {
		padding: Spacing.md,
		backgroundColor: "#fff",
		borderRadius: Radius.md,
		marginBottom: Spacing.xl,
	},
	codeLabel: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		fontWeight: FontWeight.semibold,
		marginBottom: Spacing.sm,
	},
	codeText: {
		fontFamily: Mono,
		fontSize: 36,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		letterSpacing: 5,
	},
	codeExpiry: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: Spacing.sm,
		fontWeight: FontWeight.regular,
	},

	successActions: { gap: Spacing.md },
});
