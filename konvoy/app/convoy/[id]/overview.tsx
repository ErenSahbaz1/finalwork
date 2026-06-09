import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	Animated,
	SafeAreaView,
	ScrollView,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
	ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { fetchDrivingLegs } from "../../../src/lib/directions";
import { Radius } from "../../../src/constants/theme";
import type {
	Convoy,
	ConvoyStatus,
	MemberRole,
	MemberStatus,
	Stop,
	StopType,
} from "../../../src/types";
import { useUserStore } from "../../../src/store/userStore";

// ─── Cinematic dark palette ────────────────────────────────────────────────────
const C = {
	bg: "#0c0b0a",
	bgCard: "#161412",
	bgElevated: "#1e1c19",
	accent: "#f59e0b",
	accentDim: "rgba(245,158,11,0.10)",
	accentBorder: "rgba(245,158,11,0.22)",
	textPrimary: "#f0ede8",
	textSecondary: "#9e9891",
	textMuted: "#544f49",
	border: "rgba(255,255,255,0.055)",
	online: "#34d399",
	offline: "#3a3632",
	weak: "#f59e0b",
	danger: "#f87171",
};

const STOP_ICON: Record<StopType, string> = {
	fuel: "⛽",
	food: "🍔",
	rest: "😴",
	overnight: "🏨",
	sightseeing: "📸",
	emergency: "🚨",
};

const CONVOY_STATUS_COLOR: Record<ConvoyStatus, string> = {
	preparation: C.accent,
	driving: C.online,
	paused: C.weak,
	ended: C.textMuted,
};

const CONVOY_STATUS_LABEL: Record<ConvoyStatus, string> = {
	preparation: "PREPARING",
	driving: "DRIVING",
	paused: "PAUSED",
	ended: "ENDED",
};

const STOP_STATUS_COLOR: Record<string, string> = {
	proposed: C.textSecondary,
	confirmed: C.accent,
	passed: C.textMuted,
	cancelled: C.danger,
};

function haversineKm(
	a: { lat: number; lng: number },
	b: { lat: number; lng: number },
): number {
	const toRad = (n: number) => (n * Math.PI) / 180;
	const R = 6371;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.sin(dLng / 2) ** 2 *
			Math.cos(toRad(a.lat)) *
			Math.cos(toRad(b.lat));
	return 2 * R * Math.asin(Math.sqrt(h));
}

function formatKm(km: number): string {
	if (km < 1) return `${Math.round(km * 1000)} m`;
	if (km < 10) return `${km.toFixed(1)} km`;
	return `${Math.round(km)} km`;
}

function formatDuration(min: number): string {
	if (min < 60) return `${min}m`;
	const h = Math.floor(min / 60);
	const m = min % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
}

interface MemberRow {
	id: string;
	user_id: string;
	role: MemberRole;
	status: MemberStatus;
	display_name: string;
	avatar_color: string;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function TripOverviewScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const userId = useUserStore((s) => s.userId);

	const [convoy, setConvoy] = useState<Convoy | null>(null);
	const [members, setMembers] = useState<MemberRow[]>([]);
	const [stops, setStops] = useState<Stop[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	// Real driving distances (km) per leg, from the Directions API. null until
	// loaded (or when unavailable) — in which case we show the straight-line
	// haversine estimate instead.
	const [legKm, setLegKm] = useState<number[] | null>(null);
	const [drivingTotalKm, setDrivingTotalKm] = useState<number | null>(null);

	const fadeAnim = useRef(new Animated.Value(0)).current;
	const slideAnim = useRef(new Animated.Value(20)).current;

	useEffect(() => {
		if (!id) return;
		let cancelled = false;

		(async () => {
			setLoading(true);
			setError("");
			try {
				const [
					{ data: cData, error: cErr },
					{ data: mData, error: mErr },
					{ data: sData, error: sErr },
				] = await Promise.all([
					supabase.from("convoys").select("*").eq("id", id).single(),
					supabase
						.from("convoy_members")
						.select(
							"id, user_id, role, status, users:user_id ( display_name, avatar_color )",
						)
						.eq("convoy_id", id),
					supabase
						.from("stops")
						.select("*")
						.eq("convoy_id", id)
						.order("order_index", { ascending: true })
						.order("created_at", { ascending: true }),
				]);
				if (cErr) throw cErr;
				if (mErr) throw mErr;
				if (sErr) throw sErr;
				if (cancelled) return;

				setConvoy(cData as Convoy);
				setMembers(
					(mData ?? []).map((r: any) => ({
						id: r.id,
						user_id: r.user_id,
						role: r.role,
						status: r.status,
						display_name: r.users?.display_name ?? "Unknown",
						avatar_color: r.users?.avatar_color ?? "#555555",
					})),
				);
				setStops((sData ?? []) as Stop[]);

				Animated.parallel([
					Animated.timing(fadeAnim, {
						toValue: 1,
						duration: 480,
						useNativeDriver: true,
					}),
					Animated.timing(slideAnim, {
						toValue: 0,
						duration: 480,
						useNativeDriver: true,
					}),
				]).start();
			} catch (e: any) {
				if (!cancelled) setError(e?.message ?? "Couldn't load trip.");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [id]);

	// ─── Derived data ────────────────────────────────────────────────────────

	const activeStops = useMemo(
		() =>
			stops
				.filter((s) => s.status !== "cancelled")
				.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
		[stops],
	);

	const nextStop = useMemo(
		() =>
			activeStops.find((s) => s.status === "confirmed") ??
			activeStops.find((s) => s.status === "proposed") ??
			null,
		[activeStops],
	);

	// Stable signature of the ordered stop coordinates — changes only when a stop
	// is added/removed/moved, so the Directions fetch (and its cache) keys off it.
	const stopsSignature = useMemo(
		() =>
			activeStops
				.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`)
				.join("|"),
		[activeStops],
	);

	// Fetch real driving distances once per coordinate set (cached in
	// AsyncStorage by the helper). Falls back silently to haversine on any miss.
	useEffect(() => {
		let cancelled = false;
		if (activeStops.length < 2) {
			setLegKm(null);
			setDrivingTotalKm(null);
			return;
		}
		(async () => {
			const result = await fetchDrivingLegs(
				activeStops.map((s) => ({ lat: s.lat, lng: s.lng })),
			);
			if (cancelled || !result) return;
			setLegKm(result.legKm);
			setDrivingTotalKm(result.totalKm);
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stopsSignature]);

	// Straight-line fallback total (used until/unless real driving total loads).
	const haversineTotalKm = useMemo(() => {
		if (activeStops.length < 2) return 0;
		let sum = 0;
		for (let i = 1; i < activeStops.length; i++) {
			sum += haversineKm(
				{ lat: activeStops[i - 1].lat, lng: activeStops[i - 1].lng },
				{ lat: activeStops[i].lat, lng: activeStops[i].lng },
			);
		}
		return sum;
	}, [activeStops]);

	// Prefer the real driving total when available.
	const totalKm = drivingTotalKm ?? haversineTotalKm;
	const isDrivingDistance = drivingTotalKm != null;

	const totalDriveMin = useMemo(() => {
		const driveMin = totalKm > 0 ? (totalKm / 90) * 60 : 0;
		const stopMin = activeStops.reduce(
			(acc, s) => acc + (s.duration_min ?? 0),
			0,
		);
		return Math.round(driveMin + stopMin);
	}, [totalKm, activeStops]);

	const onlineCount = members.filter((m) => m.status === "online").length;
	const convoyStatus = convoy?.status as ConvoyStatus;
	const statusColor = convoy ? CONVOY_STATUS_COLOR[convoyStatus] : C.textMuted;

	// ─── Loading / error states ──────────────────────────────────────────────

	if (loading) {
		return (
			<SafeAreaView style={styles.safe}>
				<StatusBar barStyle="light-content" backgroundColor={C.bg} />
				<View style={styles.center}>
					<ActivityIndicator color={C.accent} size="large" />
					<Text style={styles.loadingText}>Loading trip…</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (!convoy) {
		return (
			<SafeAreaView style={styles.safe}>
				<StatusBar barStyle="light-content" backgroundColor={C.bg} />
				<View style={styles.center}>
					<Text style={styles.errorText}>{error || "Trip not found."}</Text>
					<TouchableOpacity
						style={styles.backLink}
						onPress={() => router.back()}
					>
						<Text style={styles.backLinkText}>← Go back</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	// ─── Render ──────────────────────────────────────────────────────────────

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar barStyle="light-content" backgroundColor={C.bg} />
			<Animated.View
				style={[
					styles.flex,
					{
						opacity: fadeAnim,
						transform: [{ translateY: slideAnim }],
					},
				]}
			>
				{/* ── Top bar ──────────────────────────────────────────────────── */}
				<View style={styles.topBar}>
					<TouchableOpacity
						onPress={() => router.back()}
						hitSlop={12}
						style={styles.backBtn}
					>
						<Text style={styles.backArrow}>←</Text>
					</TouchableOpacity>

					<View
						style={[
							styles.statusPill,
							{
								backgroundColor: statusColor + "18",
								borderColor: statusColor + "35",
							},
						]}
					>
						<View
							style={[styles.statusDotSmall, { backgroundColor: statusColor }]}
						/>
						<Text style={[styles.statusPillText, { color: statusColor }]}>
							{CONVOY_STATUS_LABEL[convoyStatus]}
						</Text>
					</View>
				</View>

				<ScrollView
					contentContainerStyle={styles.scroll}
					showsVerticalScrollIndicator={false}
				>
					{/* ── Hero title ─────────────────────────────────────────────── */}
					<View style={styles.heroSection}>
						<Text style={styles.eyebrow}>TRIP OVERVIEW</Text>
						<Text style={styles.tripTitle} numberOfLines={3}>
							{convoy.title}
						</Text>
						{convoy.starts_at ? (
							<Text style={styles.dateText}>{formatDate(convoy.starts_at)}</Text>
						) : null}
					</View>

					{/* ── Stats strip ───────────────────────────────────────────── */}
					<View style={styles.statsStrip}>
						<StatBox
							label={isDrivingDistance ? "DISTANCE" : "DISTANCE ≈"}
							value={
								totalKm > 0
									? `${isDrivingDistance ? "" : "≈ "}${formatKm(totalKm)}`
									: "—"
							}
						/>
						<View style={styles.statsDivider} />
						<StatBox
							label="EST. TIME"
							value={totalDriveMin > 0 ? formatDuration(totalDriveMin) : "—"}
						/>
						<View style={styles.statsDivider} />
						<StatBox label="STOPS" value={String(activeStops.length)} />
						<View style={styles.statsDivider} />
						<StatBox label="CREW" value={String(members.length)} />
					</View>

					{/* ── Next stop callout ─────────────────────────────────────── */}
					{nextStop ? (
						<View style={styles.section}>
							<Text style={styles.sectionLabel}>NEXT STOP</Text>
							<TouchableOpacity
								style={styles.nextStopCard}
								onPress={() =>
									router.push({
										pathname: "/convoy/[id]/stops",
										params: { id },
									})
								}
								activeOpacity={0.78}
							>
								<View style={styles.nextStopIconBox}>
									<Text style={styles.nextStopEmoji}>
										{STOP_ICON[nextStop.type]}
									</Text>
								</View>
								<View style={styles.nextStopInfo}>
									<Text style={styles.nextStopName} numberOfLines={1}>
										{nextStop.name}
									</Text>
									<Text style={styles.nextStopMeta}>
										{nextStop.type.charAt(0).toUpperCase() +
											nextStop.type.slice(1)}{" "}
										· {nextStop.duration_min} min
									</Text>
								</View>
								<View style={styles.nextStopArrow}>
									<Text style={styles.nextStopArrowText}>›</Text>
								</View>
							</TouchableOpacity>
						</View>
					) : null}

					{/* ── Crew ──────────────────────────────────────────────────── */}
					{members.length > 0 ? (
						<View style={styles.section}>
							<View style={styles.sectionHeaderRow}>
								<Text style={styles.sectionLabel}>CREW</Text>
								{onlineCount > 0 ? (
									<View style={styles.onlinePill}>
										<View style={styles.onlineDot} />
										<Text style={styles.onlinePillText}>
											{onlineCount} online
										</Text>
									</View>
								) : null}
							</View>
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={styles.crewRow}
							>
								{members.map((m) => (
									<MemberAvatar
										key={m.id}
										member={m}
										isMe={m.user_id === userId}
									/>
								))}
							</ScrollView>
						</View>
					) : null}

					{/* ── Route timeline ────────────────────────────────────────── */}
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>ROUTE</Text>
						{activeStops.length > 0 ? (
							<View style={styles.timeline}>
								{activeStops.map((stop, idx) => {
									const isLast = idx === activeStops.length - 1;
									const nodeColor =
										STOP_STATUS_COLOR[stop.status] ?? C.textMuted;
									const segKm = isLast
										? null
										: (legKm?.[idx] ??
											haversineKm(
												{
													lat: stop.lat,
													lng: stop.lng,
												},
												{
													lat: activeStops[idx + 1].lat,
													lng: activeStops[idx + 1].lng,
												},
											));

									return (
										<View key={stop.id}>
											{/* Stop node + content */}
											<View style={styles.timelineStopRow}>
												<View style={styles.timelineLeft}>
													<View
														style={[
															styles.timelineNode,
															{
																borderColor: nodeColor + "55",
																backgroundColor:
																	stop.status === "confirmed"
																		? C.accentDim
																		: C.bg,
															},
														]}
													>
														<View
															style={[
																styles.timelineNodeDot,
																{ backgroundColor: nodeColor },
															]}
														/>
													</View>
												</View>
												<View style={styles.timelineContent}>
													<Text
														style={[
															styles.timelineStopName,
															stop.status === "passed" &&
																styles.timelineStopPassed,
															stop.status === "cancelled" &&
																styles.timelineStopCancelled,
														]}
														numberOfLines={1}
													>
														{STOP_ICON[stop.type]}{"  "}{stop.name}
													</Text>
													<View style={styles.timelineChips}>
														<View
															style={[
																styles.statusChip,
																{
																	backgroundColor: nodeColor + "18",
																	borderColor: nodeColor + "35",
																},
															]}
														>
															<Text
																style={[
																	styles.statusChipText,
																	{ color: nodeColor },
																]}
															>
																{stop.status.charAt(0).toUpperCase() +
																	stop.status.slice(1)}
															</Text>
														</View>
														<Text style={styles.stopDurationText}>
															{stop.duration_min} min
														</Text>
													</View>
												</View>
											</View>

											{/* Connector + distance label */}
											{!isLast ? (
												<View style={styles.timelineConnectorRow}>
													<View style={styles.timelineLeft}>
														<View style={styles.timelineConnector} />
													</View>
													<View style={styles.timelineConnectorContent}>
														{segKm !== null ? (
															<Text style={styles.segmentDistance}>
																{formatKm(segKm)}
															</Text>
														) : null}
													</View>
												</View>
											) : null}
										</View>
									);
								})}
							</View>
						) : (
							<View style={styles.emptyRoute}>
								<Text style={styles.emptyRouteText}>No stops planned yet</Text>
							</View>
						)}
					</View>

					{/* ── Actions ──────────────────────────────────────────────── */}
					<View style={styles.actions}>
						<TouchableOpacity
							style={styles.primaryBtn}
							onPress={() =>
								router.push({
									pathname: "/convoy/[id]/map",
									params: { id },
								})
							}
							activeOpacity={0.82}
						>
							<Text style={styles.primaryBtnText}>View Live Map</Text>
						</TouchableOpacity>
						<View style={styles.secondaryRow}>
							<TouchableOpacity
								style={styles.secondaryBtn}
								onPress={() =>
									router.push({
										pathname: "/convoy/[id]/stops",
										params: { id },
									})
								}
								activeOpacity={0.8}
							>
								<Text style={styles.secondaryBtnText}>Stops</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.secondaryBtn}
								onPress={() =>
									router.push({
										pathname: "/convoy/[id]/lobby",
										params: { id },
									})
								}
								activeOpacity={0.8}
							>
								<Text style={styles.secondaryBtnText}>Lobby</Text>
							</TouchableOpacity>
						</View>
					</View>

					{error ? (
						<View style={styles.errorBox}>
							<Text style={styles.errorBoxText}>⚠ {error}</Text>
						</View>
					) : null}
				</ScrollView>
			</Animated.View>
		</SafeAreaView>
	);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.statBox}>
			<Text style={styles.statValue}>{value}</Text>
			<Text style={styles.statLabel}>{label}</Text>
		</View>
	);
}

function MemberAvatar({
	member,
	isMe,
}: {
	member: MemberRow;
	isMe: boolean;
}) {
	const ringColor =
		member.status === "online"
			? C.online
			: member.status === "weak_signal"
				? C.weak
				: C.offline;

	return (
		<View style={styles.avatarWrap}>
			<View style={[styles.avatarRing, { borderColor: ringColor }]}>
				<View
					style={[styles.avatarCircle, { backgroundColor: member.avatar_color }]}
				>
					<Text style={styles.avatarInitial}>
						{member.display_name.charAt(0).toUpperCase()}
					</Text>
				</View>
			</View>
			{member.role === "leader" ? (
				<View style={styles.leaderBadge}>
					<Text style={styles.leaderEmoji}>👑</Text>
				</View>
			) : null}
			<Text
				style={[styles.avatarName, isMe && styles.avatarNameMe]}
				numberOfLines={1}
			>
				{isMe ? "You" : member.display_name.split(" ")[0]}
			</Text>
		</View>
	);
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: C.bg },
	flex: { flex: 1 },
	center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
	loadingText: { color: C.textMuted, fontSize: 13, fontWeight: "400" },
	errorText: { color: C.textMuted, fontSize: 14, textAlign: "center" },
	backLink: { marginTop: 4 },
	backLinkText: { color: C.accent, fontSize: 14, fontWeight: "500" },

	scroll: { paddingBottom: 64 },

	// ── Top bar
	topBar: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 24,
		paddingTop: 8,
		paddingBottom: 16,
	},
	backBtn: { minHeight: 44, justifyContent: "center" },
	backArrow: { color: C.textSecondary, fontSize: 22, fontWeight: "300" },
	statusPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 7,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1,
	},
	statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
	statusPillText: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },

	// ── Hero
	heroSection: {
		paddingHorizontal: 24,
		paddingBottom: 28,
		borderBottomWidth: 1,
		borderBottomColor: C.border,
	},
	eyebrow: {
		fontSize: 10,
		fontWeight: "700",
		color: C.accent,
		letterSpacing: 3,
		marginBottom: 14,
	},
	tripTitle: {
		fontSize: 36,
		fontWeight: "200",
		color: C.textPrimary,
		letterSpacing: -0.8,
		lineHeight: 42,
		marginBottom: 10,
	},
	dateText: {
		fontSize: 13,
		color: C.textMuted,
		fontWeight: "400",
		letterSpacing: 0.1,
	},

	// ── Stats strip
	statsStrip: {
		flexDirection: "row",
		backgroundColor: C.bgCard,
		marginHorizontal: 24,
		marginTop: 24,
		borderRadius: Radius.lg,
		borderWidth: 1,
		borderColor: C.border,
		overflow: "hidden",
	},
	statBox: {
		flex: 1,
		alignItems: "center",
		paddingVertical: 18,
		paddingHorizontal: 6,
	},
	statsDivider: {
		width: 1,
		backgroundColor: C.border,
		marginVertical: 12,
	},
	statValue: {
		fontSize: 17,
		fontWeight: "600",
		color: C.textPrimary,
		letterSpacing: -0.4,
		marginBottom: 4,
	},
	statLabel: {
		fontSize: 8,
		fontWeight: "700",
		color: C.textMuted,
		letterSpacing: 1.4,
	},

	// ── Sections
	section: { paddingHorizontal: 24, marginTop: 36 },
	sectionLabel: {
		fontSize: 10,
		fontWeight: "700",
		color: C.textMuted,
		letterSpacing: 2.2,
		marginBottom: 16,
	},
	sectionHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 16,
	},

	// ── Next stop
	nextStopCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: C.accentDim,
		borderWidth: 1,
		borderColor: C.accentBorder,
		borderRadius: Radius.lg,
		padding: 16,
		gap: 14,
	},
	nextStopIconBox: {
		width: 50,
		height: 50,
		borderRadius: 12,
		backgroundColor: C.bgElevated,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: C.border,
	},
	nextStopEmoji: { fontSize: 24 },
	nextStopInfo: { flex: 1 },
	nextStopName: {
		fontSize: 16,
		fontWeight: "600",
		color: C.textPrimary,
		letterSpacing: -0.3,
		marginBottom: 4,
	},
	nextStopMeta: { fontSize: 12, color: C.textMuted, fontWeight: "400" },
	nextStopArrow: {
		width: 28,
		height: 28,
		alignItems: "center",
		justifyContent: "center",
	},
	nextStopArrowText: { color: C.accent, fontSize: 24, fontWeight: "300" },

	// ── Crew
	onlinePill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		marginBottom: 16,
	},
	onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.online },
	onlinePillText: { fontSize: 11, color: C.online, fontWeight: "500" },
	crewRow: { gap: 18, paddingRight: 8 },
	avatarWrap: { alignItems: "center", width: 60 },
	avatarRing: {
		width: 54,
		height: 54,
		borderRadius: 27,
		borderWidth: 2,
		padding: 2.5,
		marginBottom: 7,
	},
	avatarCircle: {
		flex: 1,
		borderRadius: 999,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarInitial: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "600",
	},
	leaderBadge: { position: "absolute", top: -4, right: 4 },
	leaderEmoji: { fontSize: 11 },
	avatarName: {
		fontSize: 11,
		color: C.textSecondary,
		fontWeight: "400",
		textAlign: "center",
	},
	avatarNameMe: { color: C.accent, fontWeight: "600" },

	// ── Route timeline
	timeline: { gap: 0 },
	timelineStopRow: { flexDirection: "row", alignItems: "flex-start" },
	timelineLeft: { width: 28, alignItems: "center" },
	timelineNode: {
		width: 22,
		height: 22,
		borderRadius: 11,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	timelineNodeDot: { width: 8, height: 8, borderRadius: 4 },
	timelineContent: { flex: 1, paddingBottom: 6, paddingLeft: 12 },
	timelineStopName: {
		fontSize: 14,
		fontWeight: "500",
		color: C.textPrimary,
		letterSpacing: -0.1,
		marginBottom: 6,
	},
	timelineStopPassed: {
		color: C.textMuted,
		textDecorationLine: "line-through",
	},
	timelineStopCancelled: {
		color: C.danger + "70",
		textDecorationLine: "line-through",
	},
	timelineChips: { flexDirection: "row", alignItems: "center", gap: 8 },
	statusChip: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 6,
		borderWidth: 1,
	},
	statusChipText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
	stopDurationText: {
		fontSize: 11,
		color: C.textMuted,
		fontWeight: "400",
	},

	// Connector between stops
	timelineConnectorRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		minHeight: 32,
	},
	timelineConnector: {
		width: 1.5,
		flex: 1,
		backgroundColor: C.textMuted + "25",
		marginVertical: 2,
		minHeight: 28,
	},
	timelineConnectorContent: {
		flex: 1,
		paddingLeft: 12,
		justifyContent: "center",
		paddingVertical: 6,
	},
	segmentDistance: {
		fontSize: 10,
		color: C.textMuted,
		fontWeight: "500",
		letterSpacing: 0.3,
	},

	// Empty
	emptyRoute: { paddingVertical: 20, alignItems: "center" },
	emptyRouteText: { color: C.textMuted, fontSize: 13, fontWeight: "400" },

	// ── Actions
	actions: { paddingHorizontal: 24, marginTop: 44, gap: 12 },
	primaryBtn: {
		backgroundColor: C.accent,
		borderRadius: Radius.lg,
		paddingVertical: 17,
		alignItems: "center",
	},
	primaryBtnText: {
		color: "#0c0b0a",
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0.2,
	},
	secondaryRow: { flexDirection: "row", gap: 12 },
	secondaryBtn: {
		flex: 1,
		backgroundColor: C.bgCard,
		borderWidth: 1,
		borderColor: C.border,
		borderRadius: Radius.lg,
		paddingVertical: 14,
		alignItems: "center",
	},
	secondaryBtnText: {
		color: C.textSecondary,
		fontSize: 14,
		fontWeight: "600",
		letterSpacing: 0.2,
	},

	// Error
	errorBox: {
		marginHorizontal: 24,
		marginTop: 20,
		backgroundColor: "rgba(248,113,113,0.07)",
		borderRadius: Radius.md,
		padding: 14,
		borderWidth: 1,
		borderColor: "rgba(248,113,113,0.15)",
	},
	errorBoxText: {
		color: C.danger,
		fontSize: 13,
		fontWeight: "500",
	},
});
