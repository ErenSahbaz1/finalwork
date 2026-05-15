import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TextInput,
	ScrollView,
	TouchableOpacity,
	Modal,
	Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { supabase } from "../../src/lib/supabase";
import { Button } from "../../src/components/Button";
import { Colors, Spacing, FontSize, Radius } from "../../src/constants/theme";

// TODO: Replace with real user ID from auth
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

const CODE_LENGTH = 6;

export default function JoinConvoyScreen() {
	const router = useRouter();
	const [code, setCode] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [scannerOpen, setScannerOpen] = useState(false);
	const [scanLocked, setScanLocked] = useState(false);
	const [permission, requestPermission] = useCameraPermissions();

	async function joinWithCode(rawCode: string) {
		const cleanCode = rawCode.trim().toUpperCase();
		if (cleanCode.length !== CODE_LENGTH) {
			setError("Invite code must be 6 characters.");
			return;
		}
		setError("");
		setLoading(true);

		try {
			const nowIso = new Date().toISOString();

			const { data: convoy, error: lookupErr } = await supabase
				.from("convoys")
				.select("id, status, expires_at")
				.eq("invite_code", cleanCode)
				.neq("status", "ended")
				.gt("expires_at", nowIso)
				.maybeSingle();

			if (lookupErr) throw lookupErr;
			if (!convoy) {
				setError("Invalid or expired code. Double-check with your leader.");
				return;
			}

			const { data: existing, error: memberErr } = await supabase
				.from("convoy_members")
				.select("id")
				.eq("convoy_id", convoy.id)
				.eq("user_id", TEST_USER_ID)
				.maybeSingle();

			if (memberErr) throw memberErr;

			if (!existing) {
				const { error: insertErr } = await supabase
					.from("convoy_members")
					.insert({
						convoy_id: convoy.id,
						user_id: TEST_USER_ID,
						role: "member",
						status: "online",
					});
				if (insertErr) throw insertErr;
			}

			router.push(`/convoy/${convoy.id}/lobby`);
		} catch (e: any) {
			setError(e?.message ?? "Something went wrong. Try again.");
		} finally {
			setLoading(false);
		}
	}

	function handleCodeChange(value: string) {
		const sanitized = value
			.toUpperCase()
			.replace(/[^A-Z0-9]/g, "")
			.slice(0, CODE_LENGTH);
		setCode(sanitized);
		if (error) setError("");
	}

	async function handleOpenScanner() {
		setError("");
		if (!permission?.granted) {
			const result = await requestPermission();
			if (!result.granted) {
				setError("Camera permission needed to scan QR codes.");
				return;
			}
		}
		setScanLocked(false);
		setScannerOpen(true);
	}

	function handleCloseScanner() {
		setScannerOpen(false);
		setScanLocked(false);
	}

	async function handleBarcodeScanned({ data }: { data: string }) {
		if (scanLocked) return;
		setScanLocked(true);
		setScannerOpen(false);
		const extracted = (data ?? "")
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9]/g, "")
			.slice(0, CODE_LENGTH);
		setCode(extracted);
		await joinWithCode(extracted);
	}

	const canSubmit = code.length === CODE_LENGTH && !loading;

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
						hitSlop={12}
					>
						<Text style={styles.backText}>← Back</Text>
					</TouchableOpacity>
					<Text style={styles.title}>Join convoy</Text>
					<View style={{ width: 60 }} />
				</View>

				<View style={styles.heroIcon}>
					<Text style={styles.heroEmoji}>🔑</Text>
				</View>
				<Text style={styles.formTitle}>Enter your invite</Text>
				<Text style={styles.formSub}>
					Type the 6-character code or scan a QR code from the leader.
				</Text>

				{/* Code input */}
				<Text style={styles.label}>Invite code</Text>
				<TextInput
					style={[styles.codeInput, error ? styles.inputError : null]}
					value={code}
					onChangeText={handleCodeChange}
					placeholder="ABC123"
					placeholderTextColor={Colors.textMuted}
					autoCapitalize="characters"
					autoCorrect={false}
					autoComplete="off"
					maxLength={CODE_LENGTH}
					selectionColor={Colors.primary}
					returnKeyType="go"
					onSubmitEditing={() => canSubmit && joinWithCode(code)}
				/>
				<Text style={styles.charCount}>
					{code.length}/{CODE_LENGTH}
				</Text>

				{error ? (
					<View style={styles.errorBox}>
						<Text style={styles.errorText}>⚠️ {error}</Text>
					</View>
				) : null}

				<Button
					label="Join convoy"
					onPress={() => joinWithCode(code)}
					loading={loading}
					disabled={!canSubmit}
					style={styles.joinBtn}
				/>

				{/* Divider */}
				<View style={styles.dividerRow}>
					<View style={styles.dividerLine} />
					<Text style={styles.dividerText}>OR</Text>
					<View style={styles.dividerLine} />
				</View>

				<Button
					label="📷  Scan QR code"
					onPress={handleOpenScanner}
					variant="ghost"
					style={styles.scanBtn}
				/>
			</ScrollView>

			{/* QR Scanner Modal */}
			<Modal
				visible={scannerOpen}
				animationType="slide"
				onRequestClose={handleCloseScanner}
				statusBarTranslucent
			>
				<View style={styles.scannerRoot}>
					{permission?.granted ? (
						<CameraView
							style={StyleSheet.absoluteFill}
							facing="back"
							barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
							onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
						/>
					) : (
						<View style={styles.scannerFallback}>
							<Text style={styles.scannerFallbackText}>
								Camera permission required.
							</Text>
						</View>
					)}

					{/* Dim overlay with cut-out frame */}
					<View style={styles.overlayTop} />
					<View style={styles.overlayMiddle}>
						<View style={styles.overlaySide} />
						<View style={styles.scanFrame}>
							<View style={[styles.corner, styles.cornerTL]} />
							<View style={[styles.corner, styles.cornerTR]} />
							<View style={[styles.corner, styles.cornerBL]} />
							<View style={[styles.corner, styles.cornerBR]} />
						</View>
						<View style={styles.overlaySide} />
					</View>
					<View style={styles.overlayBottom}>
						<Text style={styles.scanLabel}>Point at QR code</Text>
						<TouchableOpacity
							onPress={handleCloseScanner}
							style={styles.cancelBtn}
							activeOpacity={0.75}
						>
							<Text style={styles.cancelText}>Cancel</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

const FRAME_SIZE = 260;
const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

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
	backBtn: { padding: Spacing.xs, minHeight: 44, justifyContent: "center" },
	backText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
	title: {
		fontSize: FontSize.lg,
		fontWeight: "700",
		color: Colors.textPrimary,
	},

	// Hero
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

	// Input
	label: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginBottom: Spacing.xs,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	codeInput: {
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.primary,
		borderRadius: Radius.md,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.md,
		fontSize: 32,
		fontWeight: "700",
		color: Colors.primary,
		letterSpacing: 8,
		textAlign: "center",
		minHeight: 64,
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

	// Buttons
	joinBtn: { minHeight: 48, marginTop: Spacing.sm },
	scanBtn: { minHeight: 48 },

	// Divider
	dividerRow: {
		flexDirection: "row",
		alignItems: "center",
		marginVertical: Spacing.xl,
	},
	dividerLine: {
		flex: 1,
		height: 1,
		backgroundColor: Colors.borderSubtle,
	},
	dividerText: {
		marginHorizontal: Spacing.md,
		color: Colors.textMuted,
		fontSize: FontSize.xs,
		fontWeight: "700",
		letterSpacing: 2,
	},

	// Scanner
	scannerRoot: { flex: 1, backgroundColor: "#000" },
	scannerFallback: {
		...StyleSheet.absoluteFillObject,
		alignItems: "center",
		justifyContent: "center",
	},
	scannerFallbackText: { color: Colors.textPrimary, fontSize: FontSize.md },
	overlayTop: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: `${Platform.OS === "ios" ? 22 : 20}%`,
		backgroundColor: Colors.overlay,
	},
	overlayMiddle: {
		position: "absolute",
		top: `${Platform.OS === "ios" ? 22 : 20}%`,
		left: 0,
		right: 0,
		height: FRAME_SIZE,
		flexDirection: "row",
	},
	overlaySide: { flex: 1, backgroundColor: Colors.overlay },
	scanFrame: {
		width: FRAME_SIZE,
		height: FRAME_SIZE,
		position: "relative",
	},
	corner: {
		position: "absolute",
		width: CORNER_SIZE,
		height: CORNER_SIZE,
		borderColor: Colors.primary,
	},
	cornerTL: {
		top: 0,
		left: 0,
		borderTopWidth: CORNER_THICKNESS,
		borderLeftWidth: CORNER_THICKNESS,
		borderTopLeftRadius: Radius.sm,
	},
	cornerTR: {
		top: 0,
		right: 0,
		borderTopWidth: CORNER_THICKNESS,
		borderRightWidth: CORNER_THICKNESS,
		borderTopRightRadius: Radius.sm,
	},
	cornerBL: {
		bottom: 0,
		left: 0,
		borderBottomWidth: CORNER_THICKNESS,
		borderLeftWidth: CORNER_THICKNESS,
		borderBottomLeftRadius: Radius.sm,
	},
	cornerBR: {
		bottom: 0,
		right: 0,
		borderBottomWidth: CORNER_THICKNESS,
		borderRightWidth: CORNER_THICKNESS,
		borderBottomRightRadius: Radius.sm,
	},
	overlayBottom: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		top: `${Platform.OS === "ios" ? 22 : 20}%`,
		marginTop: FRAME_SIZE,
		backgroundColor: Colors.overlay,
		alignItems: "center",
		paddingTop: Spacing.xl,
		paddingBottom: Spacing.xxl,
	},
	scanLabel: {
		color: Colors.textPrimary,
		fontSize: FontSize.lg,
		fontWeight: "700",
		marginBottom: Spacing.xl,
	},
	cancelBtn: {
		minHeight: 48,
		minWidth: 160,
		paddingHorizontal: Spacing.xl,
		paddingVertical: Spacing.md,
		borderRadius: Radius.md,
		borderWidth: 1,
		borderColor: Colors.borderSubtle,
		alignItems: "center",
		justifyContent: "center",
	},
	cancelText: {
		color: Colors.textPrimary,
		fontSize: FontSize.md,
		fontWeight: "700",
	},
});
