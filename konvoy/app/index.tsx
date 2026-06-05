import React, { useCallback, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	ScrollView,
	ActivityIndicator,
	Animated,
	Pressable,
	StatusBar,
} from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { ConvoiLogo } from "../src/components/ConvoiLogo";
import { FadeInView } from "../src/components/FadeInView";
import { SoftBackground } from "../src/components/SoftBackground";
import { StaggeredFadeIn } from "../src/components/StaggeredFadeIn";
import {
	Colors,
	FontSize,
	Radius,
	Spacing,
	Shadows,
} from "../src/constants/theme";
import type { ConvoyStatus, MemberRole } from "../src/types";
import { useUserStore } from "../src/store/userStore";

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
	preparation: "Preparing",
	driving: "Live",
	paused: "Paused",
	ended: "Ended",
};

const STATUS_COLOR: Record<ConvoyStatus, string> = {
	preparation: "#d97706",
	driving: Colors.primary,
	paused: "#d97706",
	ended: Colors.textMuted,
};

const ROLE_LABEL: Record<MemberRole, string> = {
	leader: "Leader",
	co_leader: "Co-leader",
	member: "Member",
};

// ─── Action tile ─────────────────────────────────────────────────────────────
function ActionTile({
	icon,
	label,
	sub,
	accent,
	onPress,
}: {
	icon: string;
	label: string;
	sub: string;
	accent?: boolean;
	onPress: () => void;
}) {
	const scale = useRef(new Animated.Value(1)).current;

	function pressIn() {
		Animated.spring(scale, {
			toValue: 0.95,
			useNativeDriver: true,
			speed: 28,
			bounciness: 0,
		}).start();
	}
	function pressOut() {
		Animated.spring(scale, {
			toValue: 1,
			useNativeDriver: true,
			speed: 28,
			bounciness: 0,
		}).start();
	}

	return (
		<Pressable
			onPress={onPress}
			onPressIn={pressIn}
			onPressOut={pressOut}
			style={{ flex: 1 }}
		>
			<Animated.View
				style={[
					tile.wrap,
					accent ? tile.accentWrap : tile.ghostWrap,
					{ transform: [{ scale }] },
				]}
			>
				<Text style={tile.icon}>{icon}</Text>
				<View style={tile.textBlock}>
					<Text style={[tile.label, accent && tile.labelAccent]}>{label}</Text>
					<Text style={tile.sub}>{sub}</Text>
				</View>
				<View style={[tile.arrow, accent && tile.arrowAccent]}>
					<Text style={[tile.arrowText, accent && tile.arrowTextAccent]}>
						→
					</Text>
				</View>
			</Animated.View>
		</Pressable>
	);
}

const tile = StyleSheet.create({
	wrap: {
		borderRadius: 20,
		padding: 18,
		gap: 14,
		borderWidth: 1,
		minHeight: 140,
		justifyContent: "space-between",
	},
	accentWrap: {
		backgroundColor: Colors.bgAccent,
		borderColor: Colors.borderAccent,
		shadowColor: Colors.primary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 12,
		elevation: 5,
	},
	ghostWrap: {
		backgroundColor: Colors.bgCard,
		borderColor: Colors.border,
	},
	icon: { fontSize: 26 },
	textBlock: { gap: 3 },
	label: {
		fontSize: 15,
		fontWeight: "700",
		color: Colors.textPrimary,
		letterSpacing: -0.3,
	},
	labelAccent: { color: Colors.primary },
	sub: {
		fontSize: 11,
		color: Colors.textMuted,
		fontWeight: "400",
	},
	arrow: {
		alignSelf: "flex-end",
		width: 28,
		height: 28,
		borderRadius: 14,
		backgroundColor: Colors.bgElevated,
		borderWidth: 1,
		borderColor: Colors.border,
		alignItems: "center",
		justifyContent: "center",
	},
	arrowAccent: {
		backgroundColor: Colors.primaryDim,
		borderColor: Colors.primaryBorder,
	},
	arrowText: { fontSize: 12, color: Colors.textMuted },
	arrowTextAccent: { color: Colors.primary },
});

// ─── Convoy card ──────────────────────────────────────────────────────────────
function ConvoyCard({
	convoy,
	index,
	onPress,
}: {
	convoy: ActiveConvoy;
	index: number;
	onPress: () => void;
}) {
	const scale = useRef(new Animated.Value(1)).current;
	const isDriving = convoy.status === "driving";
	const isPreparing = convoy.status === "preparation";

	function pressIn() {
		Animated.spring(scale, {
			toValue: 0.975,
			useNativeDriver: true,
			speed: 24,
			bounciness: 0,
		}).start();
	}
	function pressOut() {
		Animated.spring(scale, {
			toValue: 1,
			useNativeDriver: true,
			speed: 24,
			bounciness: 0,
		}).start();
	}

	return (
		<StaggeredFadeIn index={index}>
			<Animated.View style={{ transform: [{ scale }] }}>
				<Pressable
					onPress={onPress}
					onPressIn={pressIn}
					onPressOut={pressOut}
					hitSlop={4}
				>
					<View style={[card.wrap, isDriving && card.wrapDriving]}>
						{/* Status bar on top edge */}
						<View
							style={[
								card.statusBar,
								{ backgroundColor: STATUS_COLOR[convoy.status] },
							]}
						/>

						<View style={card.inner}>
							{/* Left: title + meta */}
							<View style={card.left}>
								<Text style={card.title} numberOfLines={1}>
									{convoy.title}
								</Text>
								<View style={card.metaRow}>
									<Text style={card.meta}>
										{convoy.member_count}{" "}
										{convoy.member_count === 1 ? "car" : "cars"}
									</Text>
									<Text style={card.dot}>·</Text>
									<View
										style={[
											card.roleTag,
											convoy.role === "leader" && card.roleTagLeader,
										]}
									>
										<Text
											style={[
												card.roleText,
												convoy.role === "leader" && card.roleTextLeader,
											]}
										>
											{ROLE_LABEL[convoy.role]}
										</Text>
									</View>
								</View>
							</View>

							{/* Right: status */}
							<View style={card.right}>
								<View
									style={[
										card.statusPill,
										{ borderColor: STATUS_COLOR[convoy.status] + "40" },
									]}
								>
									{isDriving && <View style={card.liveDot} />}
									<Text
										style={[
											card.statusText,
											{ color: STATUS_COLOR[convoy.status] },
										]}
									>
										{STATUS_LABEL[convoy.status]}
									</Text>
								</View>
								{convoy.starts_at && isPreparing ? (
									<Text style={card.dateText}>
										{new Date(convoy.starts_at).toLocaleDateString("en-GB", {
											day: "numeric",
											month: "short",
										})}
									</Text>
								) : null}
							</View>
						</View>
					</View>
				</Pressable>
			</Animated.View>
		</StaggeredFadeIn>
	);
}

const card = StyleSheet.create({
	wrap: {
		backgroundColor: Colors.bgCard,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: Colors.border,
		overflow: "hidden",
	},
	wrapDriving: {
		borderColor: Colors.primaryBorder,
		backgroundColor: Colors.bgAccent,
		shadowColor: Colors.primary,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 4,
	},
	statusBar: {
		height: 2,
		width: "100%",
	},
	inner: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 16,
		gap: 12,
	},
	left: { flex: 1, gap: 6 },
	title: {
		fontSize: 16,
		fontWeight: "600",
		color: Colors.textPrimary,
		letterSpacing: -0.3,
	},
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	meta: { fontSize: 12, color: Colors.textMuted, fontWeight: "500" },
	dot: { fontSize: 12, color: Colors.textMuted },
	roleTag: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 10,
		backgroundColor: Colors.bgElevated,
	},
	roleTagLeader: { backgroundColor: Colors.primaryDim },
	roleText: {
		fontSize: 10,
		fontWeight: "600",
		color: Colors.textSecondary,
		letterSpacing: 0.3,
	},
	roleTextLeader: { color: Colors.primary },
	right: { alignItems: "flex-end", gap: 5 },
	statusPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingHorizontal: 9,
		paddingVertical: 4,
		borderRadius: 10,
		backgroundColor: Colors.bgElevated,
		borderWidth: 1,
	},
	liveDot: {
		width: 5,
		height: 5,
		borderRadius: 3,
		backgroundColor: Colors.primary,
	},
	statusText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
	dateText: { fontSize: 11, color: Colors.textMuted, fontWeight: "400" },
});

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({
	onPlan,
	onJoin,
}: {
	onPlan: () => void;
	onJoin: () => void;
}) {
	return (
		<View style={empty.wrap}>
			<View style={empty.iconBox}>
				<Text style={empty.iconText}>🚗</Text>
			</View>
			<Text style={empty.title}>No convoys yet</Text>
			<Text style={empty.sub}>
				Start a trip or join a friend's convoy to see it here.
			</Text>
			<View style={empty.btnRow}>
				<Pressable onPress={onPlan} style={empty.btnPrimary}>
					<Text style={empty.btnPrimaryText}>Plan a trip</Text>
				</Pressable>
				<Pressable onPress={onJoin} style={empty.btnGhost}>
					<Text style={empty.btnGhostText}>Join one</Text>
				</Pressable>
			</View>
		</View>
	);
}

const empty = StyleSheet.create({
	wrap: {
		alignItems: "center",
		paddingVertical: 32,
		gap: 12,
	},
	iconBox: {
		width: 64,
		height: 64,
		borderRadius: 20,
		backgroundColor: Colors.bgElevated,
		borderWidth: 1,
		borderColor: Colors.border,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 4,
	},
	iconText: { fontSize: 28 },
	title: {
		fontSize: 16,
		fontWeight: "600",
		color: Colors.textPrimary,
	},
	sub: {
		fontSize: 13,
		color: Colors.textMuted,
		textAlign: "center",
		lineHeight: 20,
		fontWeight: "400",
		maxWidth: 220,
	},
	btnRow: {
		flexDirection: "row",
		gap: 10,
		marginTop: 8,
	},
	btnPrimary: {
		backgroundColor: Colors.primary,
		borderRadius: 12,
		paddingHorizontal: 20,
		paddingVertical: 10,
		shadowColor: Colors.primary,
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 4,
	},
	btnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
	btnGhost: {
		backgroundColor: Colors.bgCard,
		borderRadius: 12,
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	btnGhostText: {
		fontSize: 13,
		fontWeight: "600",
		color: Colors.textSecondary,
	},
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
	const router = useRouter();
	const userId = useUserStore((s) => s.userId);
	const isOnboarded = useUserStore((s) => s.isOnboarded);
	const displayName = useUserStore((s) => s.displayName);
	const avatarColor = useUserStore((s) => s.avatarColor);

	const [convoys, setConvoys] = useState<ActiveConvoy[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const firstName = displayName?.split(" ")[0] ?? "there";
	const initial = displayName?.[0]?.toUpperCase() ?? "?";

	const load = useCallback(async () => {
		if (!userId) return;
		setError("");
		try {
			const { data, error: e } = await supabase
				.from("convoy_members")
				.select(
					"role, convoy:convoy_id ( id, title, status, invite_code, starts_at, created_at )",
				)
				.eq("user_id", userId);
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
	}, [userId]);

	useFocusEffect(
		useCallback(() => {
			if (!userId) return;
			setLoading(true);
			load();
		}, [load, userId]),
	);

	function openConvoy(c: ActiveConvoy) {
		router.push(`/convoy/${c.id}/overview`);
	}

	if (!isOnboarded) {
		return <Redirect href="/onboarding" />;
	}

	const drivingConvoys = convoys.filter((c) => c.status === "driving");
	const otherConvoys = convoys.filter((c) => c.status !== "driving");

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
			<SoftBackground />
			<FadeInView style={styles.fade}>
				<ScrollView
					contentContainerStyle={styles.container}
					showsVerticalScrollIndicator={false}
				>
					{/* ── Header ── */}
					<View style={styles.header}>
						<ConvoiLogo height={24} />
						<View style={styles.headerRight}>
							<Pressable onPress={() => router.push("/settings")} hitSlop={10}>
								<View
									style={[
										styles.avatarBubble,
										{
											backgroundColor: avatarColor + "22",
											borderColor: avatarColor + "55",
										},
									]}
								>
									<Text style={[styles.avatarInitial, { color: avatarColor }]}>
										{initial}
									</Text>
								</View>
							</Pressable>
						</View>
					</View>

					{/* ── Hero ── */}
					<View style={styles.hero}>
						<Text style={styles.heroLabel}>Hey, {firstName} —</Text>
						<Text style={styles.heroLine1}>Where to</Text>
						<Text style={styles.heroLine2}>next?</Text>
						<View style={styles.heroRule} />
					</View>

					{/* ── Live alert (when driving) ── */}
					{drivingConvoys.length > 0 && (
						<Pressable
							onPress={() => openConvoy(drivingConvoys[0])}
							style={styles.liveAlert}
						>
							<View style={styles.livePulse} />
							<Text style={styles.liveAlertText}>
								{drivingConvoys[0].title} is live
							</Text>
							<Text style={styles.liveAlertArrow}>→</Text>
						</Pressable>
					)}

					{/* ── Action tiles ── */}
					<View style={styles.tiles}>
						<ActionTile
							icon="🗺"
							label="Plan a trip"
							sub="AI-powered route"
							accent
							onPress={() => router.push("/plan")}
						/>
						<ActionTile
							icon="🔗"
							label="Join convoy"
							sub="Enter invite code"
							onPress={() => router.push("/convoy/join")}
						/>
					</View>

					{/* ── Convoys section ── */}
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<Text style={styles.sectionTitle}>Your convoys</Text>
							{convoys.length > 0 && (
								<View style={styles.countBadge}>
									<Text style={styles.countText}>{convoys.length}</Text>
								</View>
							)}
						</View>

						{loading ? (
							<View style={styles.loadingBox}>
								<ActivityIndicator color={Colors.primary} size="small" />
							</View>
						) : error ? (
							<View style={styles.errorBox}>
								<Text style={styles.errorText}>{error}</Text>
							</View>
						) : convoys.length === 0 ? (
							<EmptyState
								onPlan={() => router.push("/plan")}
								onJoin={() => router.push("/convoy/join")}
							/>
						) : (
							<View style={styles.list}>
								{convoys.map((c, index) => (
									<ConvoyCard
										key={c.id}
										convoy={c}
										index={index}
										onPress={() => openConvoy(c)}
									/>
								))}
							</View>
						)}
					</View>

					<View style={{ height: 32 }} />
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	fade: { flex: 1 },
	container: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

	// Header
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 28,
	},
	headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
	avatarBubble: {
		width: 38,
		height: 38,
		borderRadius: 19,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarInitial: {
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: -0.3,
	},

	// Hero
	hero: {
		marginBottom: 28,
		paddingTop: 4,
	},
	heroLabel: {
		fontSize: 13,
		fontWeight: "400",
		color: Colors.textMuted,
		letterSpacing: 0.2,
		marginBottom: 8,
	},
	heroLine1: {
		fontSize: 52,
		fontWeight: "200",
		color: Colors.textPrimary,
		letterSpacing: -2,
		lineHeight: 54,
	},
	heroLine2: {
		fontSize: 52,
		fontWeight: "200",
		color: Colors.primary,
		letterSpacing: -2,
		lineHeight: 58,
	},
	heroRule: {
		width: 28,
		height: 2,
		backgroundColor: Colors.primary,
		borderRadius: 1,
		marginTop: 14,
		opacity: 0.6,
	},

	// Live alert
	liveAlert: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: Colors.bgAccent,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: Colors.borderAccent,
		paddingHorizontal: 14,
		paddingVertical: 11,
		marginBottom: 16,
	},
	livePulse: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: Colors.primary,
	},
	liveAlertText: {
		flex: 1,
		fontSize: 13,
		fontWeight: "600",
		color: Colors.textPrimary,
	},
	liveAlertArrow: {
		fontSize: 14,
		color: Colors.primary,
		fontWeight: "600",
	},

	// Tiles
	tiles: {
		flexDirection: "row",
		gap: 12,
		marginBottom: 28,
	},

	// Section
	section: {},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 12,
	},
	sectionTitle: {
		fontSize: 11,
		fontWeight: "600",
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1.2,
	},
	countBadge: {
		width: 18,
		height: 18,
		borderRadius: 9,
		backgroundColor: Colors.bgElevated,
		borderWidth: 1,
		borderColor: Colors.border,
		alignItems: "center",
		justifyContent: "center",
	},
	countText: {
		fontSize: 9,
		fontWeight: "700",
		color: Colors.textSecondary,
	},

	loadingBox: {
		paddingVertical: 36,
		alignItems: "center",
	},
	errorBox: {
		backgroundColor: Colors.bgAccent,
		borderRadius: 14,
		padding: 14,
		borderWidth: 1,
		borderColor: Colors.borderAccent,
	},
	errorText: { fontSize: 13, color: Colors.danger, fontWeight: "500" },

	list: { gap: 10 },
});
