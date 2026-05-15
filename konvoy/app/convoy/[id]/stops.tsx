import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Modal,
	ActivityIndicator,
	ActionSheetIOS,
	Alert,
	Linking,
	Platform,
	KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../../src/lib/supabase";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { Colors, Spacing, FontSize, Radius } from "../../../src/constants/theme";
import type {
	Stop,
	StopType,
	StopStatus,
	VoteReaction,
	MemberRole,
} from "../../../src/types";

// TODO: Replace with real user ID from auth
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

const STOP_ICON: Record<StopType, string> = {
	fuel: "⛽",
	food: "🍔",
	rest: "😴",
	overnight: "🏨",
	sightseeing: "📸",
	emergency: "🚨",
};

const STOP_TYPE_LABEL: Record<StopType, string> = {
	fuel: "Fuel",
	food: "Food",
	rest: "Rest",
	overnight: "Overnight",
	sightseeing: "Sightseeing",
	emergency: "Emergency",
};

const STATUS_LABEL: Record<StopStatus, string> = {
	proposed: "Proposed",
	confirmed: "Confirmed",
	passed: "Passed",
	cancelled: "Cancelled",
};

const STATUS_COLOR: Record<StopStatus, string> = {
	proposed: "#888",
	confirmed: Colors.primary,
	passed: "#444",
	cancelled: Colors.danger,
};

const DURATION_OPTIONS = [
	{ label: "15 min", value: 15 },
	{ label: "30 min", value: 30 },
	{ label: "45 min", value: 45 },
	{ label: "1 h", value: 60 },
	{ label: "2 h", value: 120 },
];

const TYPE_OPTIONS: StopType[] = [
	"fuel",
	"food",
	"rest",
	"overnight",
	"sightseeing",
	"emergency",
];

interface MemberLite {
	member_id: string;
	user_id: string;
	role: MemberRole;
	avatar_color: string;
	display_name: string;
}

interface VoteRow {
	id: string;
	stop_id: string;
	convoy_member_id: string;
	reaction: VoteReaction;
}

interface ArrivalRow {
	id: string;
	stop_id: string;
	convoy_member_id: string;
	arrived_at: string;
}

export default function StopsScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();

	const [stops, setStops] = useState<Stop[]>([]);
	const [members, setMembers] = useState<MemberLite[]>([]);
	const [votes, setVotes] = useState<VoteRow[]>([]);
	const [arrivals, setArrivals] = useState<ArrivalRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [proposing, setProposing] = useState(false);
	const [proposeOpen, setProposeOpen] = useState(false);

	const myMember = useMemo(
		() => members.find((m) => m.user_id === TEST_USER_ID) ?? null,
		[members],
	);
	const isLeader = myMember?.role === "leader";
	const myMemberIdRef = useRef<string | null>(null);
	myMemberIdRef.current = myMember?.member_id ?? null;

	// ── Data loaders ─────────────────────────────────────────────────────────
	const loadStops = useCallback(async () => {
		const { data, error: e } = await supabase
			.from("stops")
			.select("*")
			.eq("convoy_id", id)
			.order("created_at", { ascending: true });
		if (e) throw e;
		setStops((data ?? []) as Stop[]);
	}, [id]);

	const loadMembers = useCallback(async () => {
		const { data, error: e } = await supabase
			.from("convoy_members")
			.select(
				"id, user_id, role, users:user_id ( display_name, avatar_color )",
			)
			.eq("convoy_id", id);
		if (e) throw e;
		setMembers(
			(data ?? []).map((row: any) => ({
				member_id: row.id,
				user_id: row.user_id,
				role: row.role,
				display_name: row.users?.display_name ?? "Unknown",
				avatar_color: row.users?.avatar_color ?? Colors.primary,
			})),
		);
	}, [id]);

	const loadVotesAndArrivals = useCallback(async () => {
		const { data: vData, error: vErr } = await supabase
			.from("stop_votes")
			.select("id, stop_id, convoy_member_id, reaction, stops!inner(convoy_id)")
			.eq("stops.convoy_id", id);
		if (vErr) throw vErr;
		setVotes(
			(vData ?? []).map((r: any) => ({
				id: r.id,
				stop_id: r.stop_id,
				convoy_member_id: r.convoy_member_id,
				reaction: r.reaction,
			})),
		);

		const { data: aData, error: aErr } = await supabase
			.from("stop_arrivals")
			.select(
				"id, stop_id, convoy_member_id, arrived_at, stops!inner(convoy_id)",
			)
			.eq("stops.convoy_id", id);
		if (aErr) throw aErr;
		setArrivals(
			(aData ?? []).map((r: any) => ({
				id: r.id,
				stop_id: r.stop_id,
				convoy_member_id: r.convoy_member_id,
				arrived_at: r.arrived_at,
			})),
		);
	}, [id]);

	useEffect(() => {
		if (!id) return;
		let cancelled = false;

		(async () => {
			setLoading(true);
			setError("");
			try {
				await Promise.all([loadStops(), loadMembers(), loadVotesAndArrivals()]);
			} catch (e: any) {
				if (!cancelled) setError(e?.message ?? "Couldn't load stops.");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		const channel = supabase
			.channel(`stops:${id}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "stops",
					filter: `convoy_id=eq.${id}`,
				},
				() => {
					loadStops().catch(() => {});
				},
			)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "stop_votes" },
				() => {
					loadVotesAndArrivals().catch(() => {});
				},
			)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "stop_arrivals" },
				() => {
					loadVotesAndArrivals().catch(() => {});
				},
			)
			.subscribe();

		return () => {
			cancelled = true;
			supabase.removeChannel(channel);
		};
	}, [id, loadStops, loadMembers, loadVotesAndArrivals]);

	// ── Actions ──────────────────────────────────────────────────────────────
	async function castVote(stopId: string, reaction: VoteReaction) {
		const memberId = myMemberIdRef.current;
		if (!memberId) {
			setError("You must be a member of this convoy to vote.");
			return;
		}
		setError("");
		try {
			const existing = votes.find(
				(v) => v.stop_id === stopId && v.convoy_member_id === memberId,
			);
			if (existing) {
				const { error: e } = await supabase
					.from("stop_votes")
					.update({ reaction, voted_at: new Date().toISOString() })
					.eq("id", existing.id);
				if (e) throw e;
			} else {
				const { error: e } = await supabase.from("stop_votes").insert({
					stop_id: stopId,
					convoy_member_id: memberId,
					reaction,
				});
				if (e) throw e;
			}
			await loadVotesAndArrivals();
		} catch (e: any) {
			setError(e?.message ?? "Couldn't save your vote.");
		}
	}

	async function setStopStatus(stopId: string, status: StopStatus) {
		setError("");
		try {
			const patch: Partial<Stop> & { confirmed_at?: string } = { status };
			if (status === "confirmed") {
				patch.confirmed_at = new Date().toISOString();
			}
			const { error: e } = await supabase
				.from("stops")
				.update(patch)
				.eq("id", stopId);
			if (e) throw e;
			await loadStops();
		} catch (e: any) {
			setError(e?.message ?? "Couldn't update stop.");
		}
	}

	async function markArrived(stopId: string) {
		const memberId = myMemberIdRef.current;
		if (!memberId) return;
		setError("");
		try {
			const already = arrivals.find(
				(a) => a.stop_id === stopId && a.convoy_member_id === memberId,
			);
			if (already) return;
			const { error: e } = await supabase.from("stop_arrivals").insert({
				stop_id: stopId,
				convoy_member_id: memberId,
			});
			if (e) throw e;
			await loadVotesAndArrivals();
		} catch (e: any) {
			setError(e?.message ?? "Couldn't mark arrival.");
		}
	}

	function openNavigate(stop: Stop) {
		const gmaps = `https://maps.google.com/?q=${stop.lat},${stop.lng}`;
		const waze = `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
		const openUrl = (url: string) => Linking.openURL(url).catch(() => {});

		if (Platform.OS === "ios") {
			ActionSheetIOS.showActionSheetWithOptions(
				{
					title: `Navigate to ${stop.name}`,
					options: ["Cancel", "Google Maps", "Waze"],
					cancelButtonIndex: 0,
				},
				(index) => {
					if (index === 1) openUrl(gmaps);
					if (index === 2) openUrl(waze);
				},
			);
		} else {
			Alert.alert(`Navigate to ${stop.name}`, "Choose an app", [
				{ text: "Google Maps", onPress: () => openUrl(gmaps) },
				{ text: "Waze", onPress: () => openUrl(waze) },
				{ text: "Cancel", style: "cancel" },
			]);
		}
	}

	async function handlePropose(payload: {
		name: string;
		type: StopType;
		duration_min: number;
		note?: string;
	}) {
		const memberId = myMemberIdRef.current;
		if (!memberId) {
			setError("You must be a member of this convoy.");
			return false;
		}
		setProposing(true);
		setError("");
		try {
			const { status } = await Location.getForegroundPermissionsAsync();
			let lat = 0;
			let lng = 0;
			if (status === "granted") {
				try {
					const loc = await Location.getLastKnownPositionAsync();
					if (loc) {
						lat = loc.coords.latitude;
						lng = loc.coords.longitude;
					} else {
						const fresh = await Location.getCurrentPositionAsync({
							accuracy: Location.Accuracy.Balanced,
						});
						lat = fresh.coords.latitude;
						lng = fresh.coords.longitude;
					}
				} catch {
					// fall through with 0,0
				}
			}

			const { error: e } = await supabase.from("stops").insert({
				convoy_id: id,
				proposed_by: memberId,
				type: payload.type,
				name: payload.name.trim(),
				lat,
				lng,
				duration_min: payload.duration_min,
				status: "proposed",
			});
			if (e) throw e;
			await loadStops();
			return true;
		} catch (e: any) {
			setError(e?.message ?? "Couldn't propose stop.");
			return false;
		} finally {
			setProposing(false);
		}
	}

	// ── Derived helpers ──────────────────────────────────────────────────────
	function getVoteCounts(stopId: string) {
		let approve = 0;
		let decline = 0;
		let neutral = 0;
		let mine: VoteReaction | null = null;
		for (const v of votes) {
			if (v.stop_id !== stopId) continue;
			if (v.reaction === "approve") approve++;
			else if (v.reaction === "decline") decline++;
			else neutral++;
			if (v.convoy_member_id === myMemberIdRef.current) mine = v.reaction;
		}
		return { approve, decline, neutral, mine };
	}

	function getArrivals(stopId: string) {
		const memberIds = new Set(arrivals.filter((a) => a.stop_id === stopId).map((a) => a.convoy_member_id));
		const arrivedMembers = members.filter((m) => memberIds.has(m.member_id));
		const iArrived = memberIds.has(myMemberIdRef.current ?? "");
		return { arrivedMembers, iArrived, count: memberIds.size, total: members.length };
	}

	// ── Render ───────────────────────────────────────────────────────────────
	if (loading) {
		return (
			<SafeAreaView style={styles.safe}>
				<View style={styles.center}>
					<ActivityIndicator color={Colors.primary} size="large" />
					<Text style={styles.loadingText}>Loading stops…</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe}>
			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity
					onPress={() => router.back()}
					style={styles.headerBtn}
					hitSlop={12}
				>
					<Text style={styles.headerBtnText}>← Back</Text>
				</TouchableOpacity>
				<Text style={styles.title}>Stops</Text>
				<TouchableOpacity
					onPress={() => setProposeOpen(true)}
					style={[styles.headerBtn, styles.addBtn]}
					hitSlop={12}
				>
					<Text style={styles.addBtnText}>＋</Text>
				</TouchableOpacity>
			</View>

			{error ? (
				<View style={styles.errorBox}>
					<Text style={styles.errorText}>⚠️ {error}</Text>
				</View>
			) : null}

			{stops.length === 0 ? (
				<View style={styles.empty}>
					<Text style={styles.emptyEmoji}>🛣️</Text>
					<Text style={styles.emptyTitle}>No stops planned yet</Text>
					<Text style={styles.emptySub}>
						Suggest a fuel break, food spot, or rest area for your convoy.
					</Text>
					<Button
						label="＋  Propose the first stop"
						onPress={() => setProposeOpen(true)}
						style={styles.emptyBtn}
					/>
				</View>
			) : (
				<ScrollView contentContainerStyle={styles.list}>
					{stops.map((stop) => {
						const counts = getVoteCounts(stop.id);
						const arr = getArrivals(stop.id);
						return (
							<Card
								key={stop.id}
								accent={stop.status === "confirmed"}
								style={styles.stopCard}
							>
								{/* Title row */}
								<View style={styles.stopHeader}>
									<View style={styles.iconBox}>
										<Text style={styles.iconText}>{STOP_ICON[stop.type]}</Text>
									</View>
									<View style={{ flex: 1 }}>
										<Text style={styles.stopName} numberOfLines={1}>
											{stop.name}
										</Text>
										<Text style={styles.stopMeta}>
											{STOP_TYPE_LABEL[stop.type]} · {stop.duration_min} min
										</Text>
									</View>
									<View
										style={[
											styles.statusChip,
											{ backgroundColor: STATUS_COLOR[stop.status] },
										]}
									>
										<Text style={styles.statusChipText}>
											{STATUS_LABEL[stop.status]}
										</Text>
									</View>
								</View>

								{/* Vote + arrival summary */}
								<View style={styles.summaryRow}>
									<View style={styles.summaryItem}>
										<Text style={styles.summaryStrong}>✅ {counts.approve}</Text>
									</View>
									<View style={styles.summaryItem}>
										<Text style={styles.summaryStrong}>❌ {counts.decline}</Text>
									</View>
									{counts.neutral > 0 ? (
										<View style={styles.summaryItem}>
											<Text style={styles.summaryMuted}>— {counts.neutral}</Text>
										</View>
									) : null}
									<View style={[styles.summaryItem, { marginLeft: "auto" }]}>
										<Text style={styles.summaryMuted}>
											{arr.count}/{arr.total} arrived
										</Text>
									</View>
								</View>

								{/* Arrival dots */}
								{arr.arrivedMembers.length > 0 ? (
									<View style={styles.dotsRow}>
										{arr.arrivedMembers.slice(0, 10).map((m) => (
											<View
												key={m.member_id}
												style={[styles.arrivalDot, { backgroundColor: m.avatar_color }]}
											/>
										))}
										{arr.arrivedMembers.length > 10 ? (
											<Text style={styles.dotsExtra}>
												+{arr.arrivedMembers.length - 10}
											</Text>
										) : null}
									</View>
								) : null}

								{/* Proposed: vote buttons */}
								{stop.status === "proposed" ? (
									<>
										<View style={styles.voteRow}>
											<VoteButton
												label="✅ Approve"
												onPress={() => castVote(stop.id, "approve")}
												active={counts.mine === "approve"}
												tone="approve"
											/>
											<VoteButton
												label="— Neutral"
												onPress={() => castVote(stop.id, "neutral")}
												active={counts.mine === "neutral"}
												tone="neutral"
											/>
											<VoteButton
												label="❌ Decline"
												onPress={() => castVote(stop.id, "decline")}
												active={counts.mine === "decline"}
												tone="decline"
											/>
										</View>
										{isLeader ? (
											<View style={styles.leaderRow}>
												<Button
													label="Confirm"
													onPress={() => setStopStatus(stop.id, "confirmed")}
													style={{ flex: 1, marginRight: Spacing.sm, minHeight: 44 }}
												/>
												<Button
													label="Cancel"
													onPress={() => setStopStatus(stop.id, "cancelled")}
													variant="danger"
													style={{ flex: 1, minHeight: 44 }}
												/>
											</View>
										) : null}
									</>
								) : null}

								{/* Confirmed: navigate + arrived */}
								{stop.status === "confirmed" ? (
									<View style={styles.confirmedRow}>
										<Button
											label="🧭  Navigate"
											onPress={() => openNavigate(stop)}
											style={{ flex: 1, marginRight: Spacing.sm, minHeight: 44 }}
										/>
										<Button
											label={arr.iArrived ? "✓ Arrived" : "I arrived"}
											onPress={() => markArrived(stop.id)}
											disabled={arr.iArrived}
											variant={arr.iArrived ? "ghost" : "primary"}
											style={{ flex: 1, minHeight: 44 }}
										/>
									</View>
								) : null}
							</Card>
						);
					})}
				</ScrollView>
			)}

			{/* Propose modal */}
			<ProposeStopSheet
				visible={proposeOpen}
				onClose={() => setProposeOpen(false)}
				onSubmit={async (payload) => {
					const ok = await handlePropose(payload);
					if (ok) setProposeOpen(false);
				}}
				submitting={proposing}
			/>
		</SafeAreaView>
	);
}

// ── Vote button ─────────────────────────────────────────────────────────────
function VoteButton({
	label,
	onPress,
	active,
	tone,
}: {
	label: string;
	onPress: () => void;
	active: boolean;
	tone: "approve" | "decline" | "neutral";
}) {
	const activeBg =
		tone === "approve"
			? Colors.primaryDim
			: tone === "decline"
				? "rgba(226,75,74,0.15)"
				: Colors.bgElevated;
	const activeBorder =
		tone === "approve"
			? Colors.primary
			: tone === "decline"
				? Colors.danger
				: Colors.textMuted;
	return (
		<TouchableOpacity
			style={[
				styles.voteBtn,
				active && { backgroundColor: activeBg, borderColor: activeBorder },
			]}
			onPress={onPress}
			activeOpacity={0.75}
		>
			<Text style={styles.voteBtnText}>{label}</Text>
		</TouchableOpacity>
	);
}

// ── Propose stop sheet ──────────────────────────────────────────────────────
function ProposeStopSheet({
	visible,
	onClose,
	onSubmit,
	submitting,
}: {
	visible: boolean;
	onClose: () => void;
	onSubmit: (payload: {
		name: string;
		type: StopType;
		duration_min: number;
		note?: string;
	}) => void;
	submitting: boolean;
}) {
	const [name, setName] = useState("");
	const [type, setType] = useState<StopType>("fuel");
	const [duration, setDuration] = useState(30);
	const [note, setNote] = useState("");
	const [err, setErr] = useState("");

	useEffect(() => {
		if (!visible) {
			setName("");
			setType("fuel");
			setDuration(30);
			setNote("");
			setErr("");
		}
	}, [visible]);

	function handleSubmit() {
		if (!name.trim()) {
			setErr("Give the stop a name.");
			return;
		}
		setErr("");
		onSubmit({
			name: name.trim(),
			type,
			duration_min: duration,
			note: note.trim() || undefined,
		});
	}

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={styles.modalRoot}
			>
				<TouchableOpacity
					style={styles.modalBackdrop}
					activeOpacity={1}
					onPress={onClose}
				/>
				<View style={styles.sheet}>
					<View style={styles.sheetHandle} />
					<View style={styles.sheetHeader}>
						<Text style={styles.sheetTitle}>Propose a stop</Text>
						<TouchableOpacity onPress={onClose} hitSlop={12}>
							<Text style={styles.sheetClose}>✕</Text>
						</TouchableOpacity>
					</View>

					<ScrollView
						contentContainerStyle={styles.sheetContent}
						keyboardShouldPersistTaps="handled"
					>
						<Text style={styles.label}>Name</Text>
						<TextInput
							style={[styles.input, err ? styles.inputError : null]}
							value={name}
							onChangeText={(t) => {
								setName(t);
								if (err) setErr("");
							}}
							placeholder="e.g. Total petrol station"
							placeholderTextColor={Colors.textMuted}
							maxLength={60}
						/>

						<Text style={styles.label}>Type</Text>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.chipsRow}
						>
							{TYPE_OPTIONS.map((t) => (
								<TouchableOpacity
									key={t}
									style={[styles.typeChip, type === t && styles.typeChipActive]}
									onPress={() => setType(t)}
								>
									<Text style={styles.typeChipIcon}>{STOP_ICON[t]}</Text>
									<Text
										style={[
											styles.typeChipLabel,
											type === t && styles.typeChipLabelActive,
										]}
									>
										{STOP_TYPE_LABEL[t]}
									</Text>
								</TouchableOpacity>
							))}
						</ScrollView>

						<Text style={styles.label}>Duration</Text>
						<View style={styles.chipsRow}>
							{DURATION_OPTIONS.map((d) => (
								<TouchableOpacity
									key={d.value}
									style={[
										styles.durationChip,
										duration === d.value && styles.durationChipActive,
									]}
									onPress={() => setDuration(d.value)}
								>
									<Text
										style={[
											styles.durationChipText,
											duration === d.value && styles.durationChipTextActive,
										]}
									>
										{d.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						<Text style={styles.label}>Note (optional)</Text>
						<TextInput
							style={[styles.input, styles.noteInput]}
							value={note}
							onChangeText={setNote}
							placeholder="Anything the group should know?"
							placeholderTextColor={Colors.textMuted}
							maxLength={120}
							multiline
						/>
						<Text style={styles.charCount}>{note.length}/120</Text>

						{err ? (
							<View style={styles.errorBox}>
								<Text style={styles.errorText}>⚠️ {err}</Text>
							</View>
						) : null}

						<Button
							label="Propose stop"
							onPress={handleSubmit}
							loading={submitting}
							disabled={!name.trim() || submitting}
							style={styles.submitBtn}
						/>
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
	},
	loadingText: {
		color: Colors.textMuted,
		marginTop: Spacing.md,
		fontSize: FontSize.sm,
	},

	// Header
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.md,
		paddingBottom: Spacing.lg,
	},
	headerBtn: { minHeight: 44, minWidth: 60, justifyContent: "center" },
	headerBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
	title: {
		fontSize: FontSize.lg,
		fontWeight: "700",
		color: Colors.textPrimary,
	},
	addBtn: {
		alignItems: "flex-end",
	},
	addBtnText: {
		fontSize: 28,
		color: Colors.primary,
		fontWeight: "700",
		lineHeight: 32,
	},

	// Error box (page-level)
	errorBox: {
		backgroundColor: "rgba(226,75,74,0.1)",
		borderRadius: Radius.sm,
		borderWidth: 1,
		borderColor: Colors.danger,
		padding: Spacing.md,
		marginHorizontal: Spacing.xl,
		marginBottom: Spacing.md,
	},
	errorText: { fontSize: FontSize.sm, color: Colors.danger },

	// Empty
	empty: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
	},
	emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
	emptyTitle: {
		fontSize: FontSize.xl,
		fontWeight: "700",
		color: Colors.textPrimary,
		marginBottom: Spacing.sm,
	},
	emptySub: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		textAlign: "center",
		lineHeight: 20,
		marginBottom: Spacing.xl,
		maxWidth: 280,
	},
	emptyBtn: { minWidth: 240, minHeight: 48 },

	// List
	list: { padding: Spacing.xl, paddingTop: 0, gap: Spacing.md },

	// Stop card
	stopCard: { gap: Spacing.md },
	stopHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
	iconBox: {
		width: 44,
		height: 44,
		borderRadius: Radius.md,
		backgroundColor: Colors.primaryDim,
		alignItems: "center",
		justifyContent: "center",
	},
	iconText: { fontSize: 22 },
	stopName: {
		fontSize: FontSize.lg,
		fontWeight: "700",
		color: Colors.textPrimary,
	},
	stopMeta: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginTop: 2,
	},
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

	// Summary
	summaryRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
	},
	summaryItem: { flexDirection: "row", alignItems: "center" },
	summaryStrong: {
		fontSize: FontSize.sm,
		color: Colors.textPrimary,
		fontWeight: "700",
	},
	summaryMuted: { fontSize: FontSize.xs, color: Colors.textMuted },

	// Arrival dots
	dotsRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
	arrivalDot: { width: 10, height: 10, borderRadius: 5 },
	dotsExtra: { fontSize: FontSize.xs, color: Colors.textMuted, marginLeft: 4 },

	// Vote row
	voteRow: { flexDirection: "row", gap: Spacing.sm },
	voteBtn: {
		flex: 1,
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.sm,
		borderRadius: Radius.md,
		borderWidth: 1,
		borderColor: Colors.borderSubtle,
		backgroundColor: Colors.bgElevated,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 44,
	},
	voteBtnText: {
		color: Colors.textPrimary,
		fontSize: FontSize.xs,
		fontWeight: "700",
	},
	leaderRow: { flexDirection: "row" },
	confirmedRow: { flexDirection: "row" },

	// Modal
	modalRoot: { flex: 1, justifyContent: "flex-end" },
	modalBackdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.6)",
	},
	sheet: {
		backgroundColor: Colors.bg,
		borderTopLeftRadius: Radius.xl,
		borderTopRightRadius: Radius.xl,
		borderWidth: 1,
		borderColor: Colors.borderSubtle,
		maxHeight: "90%",
	},
	sheetHandle: {
		alignSelf: "center",
		width: 40,
		height: 4,
		borderRadius: 2,
		backgroundColor: Colors.textMuted,
		marginTop: Spacing.sm,
		marginBottom: Spacing.sm,
	},
	sheetHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.xl,
		paddingBottom: Spacing.md,
	},
	sheetTitle: {
		fontSize: FontSize.xl,
		fontWeight: "700",
		color: Colors.textPrimary,
	},
	sheetClose: {
		color: Colors.textMuted,
		fontSize: 22,
		fontWeight: "700",
		padding: 4,
	},
	sheetContent: { padding: Spacing.xl, paddingTop: 0, paddingBottom: Spacing.xxl },

	// Form fields
	label: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: Spacing.sm,
		marginTop: Spacing.md,
	},
	input: {
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.primaryBorder,
		borderRadius: Radius.md,
		padding: Spacing.md,
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: "600",
		minHeight: 48,
	},
	noteInput: { minHeight: 80, textAlignVertical: "top" },
	inputError: { borderColor: Colors.danger },
	charCount: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textAlign: "right",
		marginTop: 4,
	},
	chipsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
	},

	// Type chip
	typeChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.full,
		borderWidth: 1,
		borderColor: Colors.borderSubtle,
		backgroundColor: Colors.bgCard,
		minHeight: 44,
	},
	typeChipActive: {
		backgroundColor: Colors.primaryDim,
		borderColor: Colors.primary,
	},
	typeChipIcon: { fontSize: 16 },
	typeChipLabel: {
		color: Colors.textMuted,
		fontSize: FontSize.sm,
		fontWeight: "700",
	},
	typeChipLabelActive: { color: Colors.textPrimary },

	// Duration chip
	durationChip: {
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.full,
		borderWidth: 1,
		borderColor: Colors.borderSubtle,
		backgroundColor: Colors.bgCard,
		minHeight: 44,
		justifyContent: "center",
	},
	durationChipActive: {
		backgroundColor: Colors.primaryDim,
		borderColor: Colors.primary,
	},
	durationChipText: {
		color: Colors.textMuted,
		fontSize: FontSize.sm,
		fontWeight: "700",
	},
	durationChipTextActive: { color: Colors.textPrimary },

	submitBtn: { marginTop: Spacing.xl, minHeight: 52 },
});
