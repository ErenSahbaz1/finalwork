import React, { useCallback, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { Card } from "../src/components/Card";
import { Colors, Spacing, FontSize, Radius } from "../src/constants/theme";
import type { ConvoyStatus, MemberRole } from "../src/types";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

interface ActiveConvoy {
	id: string;
	title: string;
	status: ConvoyStatus;
	invite_code: string;
	starts_at: string | null;
	created_at: string;
	role: MemberRole;
	member_count: number;
}

const STATUS_LABEL: Record<ConvoyStatus, string> = {
	preparation: "Preparation",
	driving: "Driving",
	paused: "Paused",
	ended: "Ended",
};

const ROLE_LABEL: Record<MemberRole, string> = {
	leader: "Leader",
	co_leader: "Co-leader",
	member: "Member",
};

export default function HomeScreen() {
	const router = useRouter();
	const [convoys, setConvoys] = useState<ActiveConvoy[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setError("");
		try {
			const { data, error: e } = await supabase
				.from("convoy_members")
				.select(
					"role, convoy:convoy_id ( id, title, status, invite_code, starts_at, created_at )",
				)
				.eq("user_id", TEST_USER_ID);
			if (e) throw e;

			const rows = (data ?? [])
				.map((row: any) => {
					if (!row.convoy) return null;
					return {
						id: row.convoy.id,
						title: row.convoy.title,
						status: row.convoy.status as ConvoyStatus,
						invite_code: row.convoy.invite_code,
						starts_at: row.convoy.starts_at,
						created_at: row.convoy.created_at,
						role: row.role as MemberRole,
					};
				})
				.filter(
					(r): r is Omit<ActiveConvoy, "member_count"> =>
						!!r && r.status !== "ended",
				)
				.sort((a, b) => b.created_at.localeCompare(a.created_at));

			if (rows.length === 0) {
				setConvoys([]);
				return;
			}

			const ids = rows.map((r) => r.id);
			const { data: counts, error: ce } = await supabase
				.from("convoy_members")
				.select("convoy_id")
				.in("convoy_id", ids);
			if (ce) throw ce;

			const tally: Record<string, number> = {};
			for (const c of counts ?? []) {
				const cid = (c as any).convoy_id;
				tally[cid] = (tally[cid] ?? 0) + 1;
			}

			setConvoys(rows.map((r) => ({ ...r, member_count: tally[r.id] ?? 1 })));
		} catch (e: any) {
			setError(e?.message ?? "Couldn't load your convoys.");
			setConvoys([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			setLoading(true);
			load();
		}, [load]),
	);

	function openConvoy(c: ActiveConvoy) {
		if (c.status === "preparation") {
			router.push(`/convoy/${c.id}/lobby`);
		} else {
			router.push(`/convoy/${c.id}/map`);
		}
	}

	return (
		<SafeAreaView style={styles.safe}>
			<ScrollView contentContainerStyle={styles.container}>
				<View style={styles.header}>
					<Text style={styles.logo}>Konvoy</Text>
					<TouchableOpacity
						onPress={() => router.push("/settings")}
						hitSlop={12}
					>
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

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Your convoys</Text>

					{loading ? (
						<View style={styles.loadingBox}>
							<ActivityIndicator color={Colors.primary} />
						</View>
					) : error ? (
						<View style={styles.errorBox}>
							<Text style={styles.errorText}>⚠️ {error}</Text>
						</View>
					) : convoys.length === 0 ? (
						<View style={styles.emptyState}>
							<Text style={styles.emptyIcon}>🛣️</Text>
							<Text style={styles.emptyText}>
								No convoys yet.{"\n"}Start your first one!
							</Text>
						</View>
					) : (
						<View style={styles.list}>
							{convoys.map((c) => (
								<TouchableOpacity
									key={c.id}
									onPress={() => openConvoy(c)}
									activeOpacity={0.85}
								>
									<Card accent={c.status === "driving"} style={styles.convoyCard}>
										<View style={styles.cardTopRow}>
											<Text style={styles.convoyTitle} numberOfLines={1}>
												{c.title}
											</Text>
											<View
												style={[
													styles.statusChip,
													c.status === "preparation" && styles.statusPreparation,
													c.status === "driving" && styles.statusDriving,
													c.status === "paused" && styles.statusPaused,
												]}
											>
												<Text style={styles.statusChipText}>
													{STATUS_LABEL[c.status]}
												</Text>
											</View>
										</View>

										<View style={styles.cardBottomRow}>
											<Text style={styles.metaText}>
												👥 {c.member_count}{" "}
												{c.member_count === 1 ? "member" : "members"}
											</Text>
											<View
												style={[
													styles.roleChip,
													c.role === "leader" && styles.roleLeader,
													c.role === "co_leader" && styles.roleCoLeader,
													c.role === "member" && styles.roleMember,
												]}
											>
												<Text style={styles.roleChipText}>
													{ROLE_LABEL[c.role]}
												</Text>
											</View>
										</View>
									</Card>
								</TouchableOpacity>
							))}
						</View>
					)}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
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
		minHeight: 72,
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

	section: { marginTop: Spacing.sm },
	sectionTitle: {
		fontSize: FontSize.sm,
		fontWeight: "700",
		color: Colors.textSecondary,
		marginBottom: Spacing.md,
		textTransform: "uppercase",
		letterSpacing: 1,
	},

	loadingBox: {
		paddingVertical: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
	},
	errorBox: {
		backgroundColor: "rgba(226,75,74,0.1)",
		borderRadius: Radius.sm,
		borderWidth: 1,
		borderColor: Colors.danger,
		padding: Spacing.md,
	},
	errorText: { fontSize: FontSize.sm, color: Colors.danger },

	list: { gap: Spacing.md },
	convoyCard: { gap: Spacing.sm },
	cardTopRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.sm,
	},
	convoyTitle: {
		flex: 1,
		fontSize: FontSize.lg,
		fontWeight: "700",
		color: Colors.textPrimary,
	},
	cardBottomRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	metaText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: "600" },

	// Status chip
	statusChip: {
		paddingHorizontal: Spacing.sm,
		paddingVertical: 4,
		borderRadius: Radius.full,
		minHeight: 24,
		alignItems: "center",
		justifyContent: "center",
	},
	statusChipText: {
		color: "#fff",
		fontSize: FontSize.xs,
		fontWeight: "700",
		letterSpacing: 0.5,
		textTransform: "uppercase",
	},
	statusPreparation: { backgroundColor: Colors.bgElevated },
	statusDriving: { backgroundColor: Colors.primary },
	statusPaused: { backgroundColor: Colors.warning },

	// Role chip
	roleChip: {
		paddingHorizontal: Spacing.sm,
		paddingVertical: 3,
		borderRadius: Radius.sm,
	},
	roleChipText: {
		color: "#fff",
		fontSize: FontSize.xs,
		fontWeight: "700",
		letterSpacing: 0.5,
		textTransform: "uppercase",
	},
	roleLeader: { backgroundColor: Colors.primary },
	roleCoLeader: { backgroundColor: Colors.info },
	roleMember: { backgroundColor: Colors.bgElevated },

	emptyState: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Spacing.xl,
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
