import React, { useEffect, useMemo, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { VehicleDot } from "../../../src/components/VehicleDot";
import { Colors, Spacing, FontSize, Radius } from "../../../src/constants/theme";
import type {
	Convoy,
	ConvoyStatus,
	MemberRole,
	MemberStatus,
} from "../../../src/types";

// TODO: Replace with real user ID from auth
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

interface MemberRow {
	id: string;
	convoy_id: string;
	user_id: string;
	role: MemberRole;
	status: MemberStatus;
	joined_at: string;
	display_name: string;
	avatar_color: string;
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

const ROLE_ORDER: Record<MemberRole, number> = {
	leader: 0,
	co_leader: 1,
	member: 2,
};

export default function ConvoyLobbyScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();

	const [convoy, setConvoy] = useState<Convoy | null>(null);
	const [members, setMembers] = useState<MemberRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [starting, setStarting] = useState(false);

	async function fetchMembers(convoyId: string) {
		const { data, error: memErr } = await supabase
			.from("convoy_members")
			.select(
				"id, convoy_id, user_id, role, status, joined_at, users:user_id ( display_name, avatar_color )",
			)
			.eq("convoy_id", convoyId)
			.order("joined_at", { ascending: true });
		if (memErr) throw memErr;

		const flat: MemberRow[] = (data ?? []).map((row: any) => ({
			id: row.id,
			convoy_id: row.convoy_id,
			user_id: row.user_id,
			role: row.role,
			status: row.status,
			joined_at: row.joined_at,
			display_name: row.users?.display_name ?? "Unknown",
			avatar_color: row.users?.avatar_color ?? Colors.primary,
		}));
		setMembers(flat);
	}

	useEffect(() => {
		if (!id) return;
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError("");
			try {
				const { data: convoyData, error: convoyErr } = await supabase
					.from("convoys")
					.select("*")
					.eq("id", id)
					.single();
				if (convoyErr) throw convoyErr;
				if (cancelled) return;
				setConvoy(convoyData as Convoy);

				await fetchMembers(id);
			} catch (e: any) {
				if (!cancelled) setError(e?.message ?? "Couldn't load convoy.");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		load();

		const channel = supabase
			.channel(`convoy-members:${id}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "convoy_members",
					filter: `convoy_id=eq.${id}`,
				},
				() => {
					fetchMembers(id).catch(() => {});
				},
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "convoys",
					filter: `id=eq.${id}`,
				},
				(payload) => {
					setConvoy((prev) =>
						prev ? { ...prev, ...(payload.new as Convoy) } : prev,
					);
				},
			)
			.subscribe();

		return () => {
			cancelled = true;
			supabase.removeChannel(channel);
		};
	}, [id]);

	const sortedMembers = useMemo(
		() =>
			[...members].sort((a, b) => {
				const r = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
				if (r !== 0) return r;
				return a.joined_at.localeCompare(b.joined_at);
			}),
		[members],
	);

	const currentMember = useMemo(
		() => members.find((m) => m.user_id === TEST_USER_ID) ?? null,
		[members],
	);
	const isLeader = currentMember?.role === "leader";

	async function handleShare() {
		if (!convoy) return;
		await Share.share({
			message: `Join my Konvoy! 🚗\nUse code: ${convoy.invite_code}\nOr open the app and enter the code manually.`,
		});
	}

	async function handleStart() {
		if (!convoy || starting) return;
		setStarting(true);
		setError("");
		try {
			const { error: updErr } = await supabase
				.from("convoys")
				.update({ status: "driving", starts_at: new Date().toISOString() })
				.eq("id", convoy.id);
			if (updErr) throw updErr;
			router.push(`/convoy/${convoy.id}/map`);
		} catch (e: any) {
			setError(e?.message ?? "Couldn't start the convoy.");
		} finally {
			setStarting(false);
		}
	}

	if (loading) {
		return (
			<SafeAreaView style={styles.safe}>
				<View style={styles.center}>
					<ActivityIndicator color={Colors.primary} size="large" />
					<Text style={styles.loadingText}>Loading convoy…</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error && !convoy) {
		return (
			<SafeAreaView style={styles.safe}>
				<View style={styles.header}>
					<TouchableOpacity
						onPress={() => router.back()}
						style={styles.backBtn}
						hitSlop={12}
					>
						<Text style={styles.backText}>← Back</Text>
					</TouchableOpacity>
					<View style={{ width: 60 }} />
					<View style={{ width: 60 }} />
				</View>
				<View style={styles.center}>
					<Text style={styles.errorTitle}>Couldn't load convoy</Text>
					<Text style={styles.errorText}>{error}</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (!convoy) return null;

	const statusChipStyle = [
		styles.statusChip,
		convoy.status === "preparation" && styles.statusPreparation,
		convoy.status === "driving" && styles.statusDriving,
		convoy.status === "paused" && styles.statusPaused,
		convoy.status === "ended" && styles.statusEnded,
	];

	return (
		<SafeAreaView style={styles.safe}>
			<ScrollView contentContainerStyle={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity
						onPress={() => router.back()}
						style={styles.backBtn}
						hitSlop={12}
					>
						<Text style={styles.backText}>← Back</Text>
					</TouchableOpacity>
					<Text style={styles.title} numberOfLines={1}>
						{convoy.title}
					</Text>
					<View style={statusChipStyle}>
						<Text style={styles.statusChipText}>
							{STATUS_LABEL[convoy.status]}
						</Text>
					</View>
				</View>

				{/* Invite section */}
				<Card accent style={styles.inviteCard}>
					<Text style={styles.inviteLabel}>Invite code</Text>
					<Text style={styles.inviteCode}>{convoy.invite_code}</Text>
					<Text style={styles.inviteExpiry}>Expires in 48h</Text>
					<Button
						label="📤  Share code"
						onPress={handleShare}
						style={styles.shareBtn}
					/>
				</Card>

				{/* Members */}
				<View style={styles.membersHeader}>
					<Text style={styles.membersTitle}>
						Members ({members.length})
					</Text>
				</View>

				<View style={styles.membersList}>
					{sortedMembers.map((m) => {
						const isMe = m.user_id === TEST_USER_ID;
						return (
							<View
								key={m.id}
								style={[styles.memberRow, isMe && styles.memberRowMe]}
							>
								<VehicleDot
									color={m.avatar_color}
									label={m.display_name}
									size={40}
									isLeader={m.role === "leader"}
									isWeak={m.status === "weak_signal"}
								/>
								<View style={styles.memberInfo}>
									<Text style={styles.memberName} numberOfLines={1}>
										{m.display_name}
										{isMe ? "  (you)" : ""}
									</Text>
									<View style={styles.memberMeta}>
										<View
											style={[
												styles.roleChip,
												m.role === "leader" && styles.roleLeader,
												m.role === "co_leader" && styles.roleCoLeader,
												m.role === "member" && styles.roleMember,
											]}
										>
											<Text style={styles.roleChipText}>
												{ROLE_LABEL[m.role]}
											</Text>
										</View>
										<View style={styles.statusDotWrap}>
											<View
												style={[
													styles.statusDot,
													m.status === "online" && styles.statusDotOnline,
													m.status === "offline" && styles.statusDotOffline,
													m.status === "weak_signal" &&
														styles.statusDotWeak,
												]}
											/>
											<Text style={styles.statusDotLabel}>
												{m.status === "online"
													? "Online"
													: m.status === "weak_signal"
														? "Weak signal"
														: "Offline"}
											</Text>
										</View>
									</View>
								</View>
							</View>
						);
					})}
				</View>

				{error ? (
					<View style={styles.errorBox}>
						<Text style={styles.errorBoxText}>⚠️ {error}</Text>
					</View>
				) : null}
			</ScrollView>

			{/* Leader-only start button */}
			{isLeader && convoy.status === "preparation" ? (
				<View style={styles.footer}>
					<Button
						label="Start convoy →"
						onPress={handleStart}
						loading={starting}
						disabled={members.length === 0}
						style={styles.startBtn}
					/>
				</View>
			) : null}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	container: { padding: Spacing.xl, paddingBottom: Spacing.xxl * 3 },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
	loadingText: {
		color: Colors.textMuted,
		marginTop: Spacing.md,
		fontSize: FontSize.sm,
	},
	errorTitle: {
		color: Colors.textPrimary,
		fontSize: FontSize.lg,
		fontWeight: "700",
		marginBottom: Spacing.sm,
	},
	errorText: {
		color: Colors.textMuted,
		fontSize: FontSize.sm,
		textAlign: "center",
	},

	// Header
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.xl,
	},
	backBtn: { padding: Spacing.xs, minHeight: 44, justifyContent: "center", minWidth: 60 },
	backText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
	title: {
		flex: 1,
		fontSize: FontSize.lg,
		fontWeight: "700",
		color: Colors.textPrimary,
		textAlign: "center",
		marginHorizontal: Spacing.sm,
	},

	// Status chip
	statusChip: {
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
		borderRadius: Radius.full,
		minHeight: 28,
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
	statusEnded: { backgroundColor: Colors.danger },

	// Invite
	inviteCard: { alignItems: "center", marginBottom: Spacing.xl },
	inviteLabel: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: Spacing.sm,
	},
	inviteCode: {
		fontSize: 38,
		fontWeight: "700",
		color: Colors.primary,
		letterSpacing: 8,
	},
	inviteExpiry: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginTop: Spacing.xs,
		marginBottom: Spacing.md,
	},
	shareBtn: { alignSelf: "stretch", backgroundColor: Colors.bgElevated, minHeight: 44 },

	// Members
	membersHeader: { marginBottom: Spacing.md },
	membersTitle: {
		fontSize: FontSize.lg,
		fontWeight: "700",
		color: Colors.textPrimary,
	},
	membersList: { gap: Spacing.sm },
	memberRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.md,
		borderWidth: 1,
		borderColor: Colors.borderSubtle,
		padding: Spacing.md,
		minHeight: 64,
	},
	memberRowMe: {
		borderColor: Colors.primaryBorder,
		backgroundColor: Colors.primaryDim,
	},
	memberInfo: { flex: 1, marginLeft: Spacing.md },
	memberName: {
		fontSize: FontSize.md,
		fontWeight: "700",
		color: Colors.textPrimary,
		marginBottom: 4,
	},
	memberMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },

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

	// Status dot
	statusDotWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
	statusDot: { width: 8, height: 8, borderRadius: 4 },
	statusDotOnline: { backgroundColor: Colors.primary },
	statusDotOffline: { backgroundColor: Colors.textMuted },
	statusDotWeak: { backgroundColor: Colors.warning },
	statusDotLabel: { fontSize: FontSize.xs, color: Colors.textMuted },

	// Inline error (after load)
	errorBox: {
		backgroundColor: "rgba(226,75,74,0.1)",
		borderRadius: Radius.sm,
		borderWidth: 1,
		borderColor: Colors.danger,
		padding: Spacing.md,
		marginTop: Spacing.lg,
	},
	errorBoxText: { fontSize: FontSize.sm, color: Colors.danger },

	// Footer
	footer: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		padding: Spacing.xl,
		backgroundColor: Colors.bg,
		borderTopWidth: 1,
		borderTopColor: Colors.borderSubtle,
	},
	startBtn: { minHeight: 52 },
});
