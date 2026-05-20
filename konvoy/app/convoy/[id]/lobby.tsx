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
import { FadeInView } from "../../../src/components/FadeInView";
import { NeumorphicView } from "../../../src/components/NeumorphicView";
import { SoftBackground } from "../../../src/components/SoftBackground";
import { StaggeredFadeIn } from "../../../src/components/StaggeredFadeIn";
import { VehicleDot } from "../../../src/components/VehicleDot";
import {
	Colors,
	Spacing,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Mono,
} from "../../../src/constants/theme";
import type {
	Convoy,
	ConvoyStatus,
	MemberRole,
	MemberStatus,
} from "../../../src/types";
import { useUserStore } from "../../../src/store/userStore";

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
	const userId = useUserStore((s) => s.userId);

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
			.channel(`convoy-members:${id}:${Math.random().toString(36).slice(2)}`)
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
		() => members.find((m) => m.user_id === userId) ?? null,
		[members, userId],
	);
	const isLeader = currentMember?.role === "leader";

	async function handleShare() {
		if (!convoy) return;
		await Share.share({
			message: `Join my Convoi. Use code: ${convoy.invite_code}`,
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
				<SoftBackground />
				<View style={styles.center}>
					<ActivityIndicator color={Colors.primary} size="large" />
				</View>
			</SafeAreaView>
		);
	}

	if (error && !convoy) {
		return (
			<SafeAreaView style={styles.safe}>
				<SoftBackground />
				<View style={styles.header}>
					<TouchableOpacity
						onPress={() => router.back()}
						style={styles.backBtn}
						hitSlop={12}
					>
						<Text style={styles.backText}>Back</Text>
					</TouchableOpacity>
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

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView contentContainerStyle={styles.container}>
					<View style={styles.header}>
						<TouchableOpacity
							onPress={() => router.back()}
							style={styles.backBtn}
							hitSlop={12}
						>
							<Text style={styles.backText}>Back</Text>
						</TouchableOpacity>
						<NeumorphicView
							pressed
							style={[
								styles.statusChip,
								convoy.status === "preparation" && styles.statusPreparation,
								convoy.status === "driving" && styles.statusDriving,
								convoy.status === "paused" && styles.statusPaused,
								convoy.status === "ended" && styles.statusEnded,
							]}
						>
							<Text
								style={[
									styles.statusChipText,
									(convoy.status === "driving" ||
										convoy.status === "ended") &&
										styles.statusChipTextOnDark,
								]}
							>
								{STATUS_LABEL[convoy.status]}
							</Text>
						</NeumorphicView>
					</View>

					<Text style={styles.title} numberOfLines={2}>
						{convoy.title}
					</Text>

					<NeumorphicView style={styles.inviteCard}>
						<Text style={styles.inviteLabel}>Invite code</Text>
						<Text style={styles.inviteCode}>{convoy.invite_code}</Text>
						<Text style={styles.inviteExpiry}>Expires in 48h</Text>
						<Button
							label="Share code"
							onPress={handleShare}
							variant="ghost"
							style={styles.shareBtn}
						/>
					</NeumorphicView>

					<Text style={styles.sectionTitle}>
						Members ({members.length})
					</Text>

					<View style={styles.membersList}>
						{sortedMembers.map((m, idx) => {
							const isMe = m.user_id === userId;
							return (
								<StaggeredFadeIn key={m.id} index={idx}>
									<NeumorphicView
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
												<NeumorphicView
													pressed
													style={[
														styles.roleChip,
														m.role === "leader" && styles.roleLeader,
														m.role === "co_leader" && styles.roleCoLeader,
														m.role === "member" && styles.roleMember,
													]}
												>
													<Text
														style={[
															styles.roleChipText,
															(m.role === "leader" ||
																m.role === "co_leader") &&
																styles.roleChipTextOnDark,
														]}
													>
														{ROLE_LABEL[m.role]}
													</Text>
												</NeumorphicView>
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
									</NeumorphicView>
								</StaggeredFadeIn>
							);
						})}
					</View>

					{error ? (
						<NeumorphicView style={styles.errorBox}>
							<Text style={styles.errorBoxText}>{error}</Text>
						</NeumorphicView>
					) : null}
				</ScrollView>

				{isLeader && convoy.status === "preparation" ? (
					<View style={styles.footer}>
						<Button
							label="Start convoy"
							onPress={handleStart}
							loading={starting}
							disabled={members.length === 0}
						/>
					</View>
				) : null}
			</FadeInView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: { padding: Spacing.xl, paddingBottom: 140 },
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
	},
	errorTitle: {
		color: Colors.textPrimary,
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		marginBottom: Spacing.sm,
	},
	errorText: {
		color: Colors.textMuted,
		fontSize: FontSize.sm,
		textAlign: "center",
		fontWeight: FontWeight.regular,
	},

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
		letterSpacing: -0.5,
		marginBottom: Spacing.xl,
	},

	statusChip: {
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
		borderRadius: Radius.full,
	},
	statusChipText: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.6,
		color: Colors.textSecondary,
	},
	statusChipTextOnDark: { color: Colors.bgElevated },
	statusPreparation: { backgroundColor: Colors.bgElevated },
	statusDriving: { backgroundColor: Colors.primary },
	statusPaused: { backgroundColor: Colors.primaryDim },
	statusEnded: { backgroundColor: Colors.danger },

	inviteCard: {
		alignItems: "center",
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.xl,
		padding: Spacing.xl,
		marginBottom: Spacing.xl,
	},
	inviteLabel: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1.4,
		marginBottom: Spacing.sm,
	},
	inviteCode: {
		fontFamily: Mono,
		fontSize: 38,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		letterSpacing: 6,
	},
	inviteExpiry: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: Spacing.xs,
		marginBottom: Spacing.lg,
		fontWeight: FontWeight.regular,
	},
	shareBtn: { alignSelf: "stretch" },

	sectionTitle: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1.4,
		marginBottom: Spacing.md,
	},

	membersList: { gap: Spacing.md },
	memberRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		padding: Spacing.lg,
		minHeight: 72,
		gap: Spacing.md,
	},
	memberRowMe: {
		backgroundColor: Colors.bgElevated,
	},
	memberInfo: { flex: 1 },
	memberName: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		marginBottom: 6,
	},
	memberMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },

	roleChip: {
		paddingHorizontal: Spacing.sm,
		paddingVertical: 4,
		borderRadius: Radius.full,
	},
	roleChipText: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.6,
		color: Colors.textSecondary,
	},
	roleChipTextOnDark: { color: Colors.bgElevated },
	roleLeader: { backgroundColor: Colors.primary },
	roleCoLeader: { backgroundColor: Colors.primaryDim },
	roleMember: { backgroundColor: Colors.bgElevated },

	statusDotWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
	statusDot: { width: 8, height: 8, borderRadius: 4 },
	statusDotOnline: { backgroundColor: Colors.online },
	statusDotOffline: { backgroundColor: Colors.textMuted },
	statusDotWeak: { backgroundColor: Colors.warning },
	statusDotLabel: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},

	errorBox: {
		backgroundColor: "rgba(220,38,38,0.08)",
		borderRadius: Radius.md,
		padding: Spacing.md,
		marginTop: Spacing.lg,
	},
	errorBoxText: {
		fontSize: FontSize.sm,
		color: Colors.danger,
		fontWeight: FontWeight.medium,
	},

	footer: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		padding: Spacing.xl,
		backgroundColor: Colors.overlay,
	},
});
