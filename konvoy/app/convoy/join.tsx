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
} from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { supabase } from "../../src/lib/supabase";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { SoftBackground } from "../../src/components/SoftBackground";
import {
	Colors,
	Spacing,
	FontSize,
	FontWeight,
	Radius,
	Shadow,
	Sizing,
	Mono,
} from "../../src/constants/theme";
import { useUserStore } from "../../src/store/userStore";

const CODE_LENGTH = 6;

export default function JoinConvoyScreen() {
	const router = useRouter();
	const userId = useUserStore((s) => s.userId);
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
		if (!userId) {
			setError("Still signing you in — try again in a sec.");
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
				.eq("user_id", userId)
				.maybeSingle();

			if (memberErr) throw memberErr;

			if (!existing) {
				const { error: insertErr } = await supabase
					.from("convoy_members")
					.insert({
						convoy_id: convoy.id,
						user_id: userId,
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

					<Text style={styles.title}>Join a convoy</Text>
					<Text style={styles.sub}>
						Type the 6-character code or scan a QR from the leader.
					</Text>

					<Text style={styles.label}>Invite code</Text>
					<NeumorphicView pressed style={styles.codeInputWrap}>
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
					</NeumorphicView>
					<Text style={styles.charCount}>
						{code.length}/{CODE_LENGTH}
					</Text>

					{error ? (
						<NeumorphicView style={styles.errorBox}>
							<Text style={styles.errorText}>{error}</Text>
						</NeumorphicView>
					) : null}

					<Button
						label="Join convoy"
						onPress={() => joinWithCode(code)}
						loading={loading}
						disabled={!canSubmit}
						style={styles.joinBtn}
					/>

					<View style={styles.dividerRow}>
						<View style={styles.dividerLine} />
						<Text style={styles.dividerText}>or</Text>
						<View style={styles.dividerLine} />
					</View>

					<Button
						label="Scan QR code"
						onPress={handleOpenScanner}
						variant="ghost"
					/>
				</ScrollView>
			</FadeInView>

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
							style={[styles.cancelBtn, Shadow.md]}
							activeOpacity={0.85}
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
const CORNER_SIZE = 32;
const CORNER_THICKNESS = 4;

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
		letterSpacing: 1.4,
		marginBottom: Spacing.sm,
	},
	codeInputWrap: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.md,
		minHeight: 80,
		justifyContent: "center",
	},
	codeInput: {
		backgroundColor: "transparent",
		fontFamily: Mono,
		fontSize: 32,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		letterSpacing: 8,
		textAlign: "center",
	},
	inputError: { color: Colors.danger },
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

	joinBtn: { marginTop: Spacing.sm },

	dividerRow: {
		flexDirection: "row",
		alignItems: "center",
		marginVertical: Spacing.xl,
	},
	dividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderSubtle },
	dividerText: {
		marginHorizontal: Spacing.md,
		color: Colors.textMuted,
		fontSize: FontSize.sm,
		fontWeight: FontWeight.medium,
	},

	scannerRoot: { flex: 1, backgroundColor: "#000" },
	scannerFallback: {
		...StyleSheet.absoluteFillObject,
		alignItems: "center",
		justifyContent: "center",
	},
	scannerFallbackText: { color: "#fff", fontSize: FontSize.md },
	overlayTop: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: "22%",
		backgroundColor: "rgba(0,0,0,0.7)",
	},
	overlayMiddle: {
		position: "absolute",
		top: "22%",
		left: 0,
		right: 0,
		height: FRAME_SIZE,
		flexDirection: "row",
	},
	overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
	scanFrame: {
		width: FRAME_SIZE,
		height: FRAME_SIZE,
		position: "relative",
	},
	corner: {
		position: "absolute",
		width: CORNER_SIZE,
		height: CORNER_SIZE,
		borderColor: "#fff",
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
		top: "22%",
		marginTop: FRAME_SIZE,
		backgroundColor: "rgba(0,0,0,0.7)",
		alignItems: "center",
		paddingTop: Spacing.xl,
		paddingBottom: Spacing.xxl,
	},
	scanLabel: {
		color: "#fff",
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		marginBottom: Spacing.xl,
	},
	cancelBtn: {
		minHeight: 48,
		minWidth: 160,
		paddingHorizontal: Spacing.xl,
		paddingVertical: Spacing.md,
		borderRadius: Radius.full,
		backgroundColor: "#fff",
		alignItems: "center",
		justifyContent: "center",
	},
	cancelText: {
		color: Colors.textPrimary,
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
	},
});
