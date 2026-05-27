import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
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
	Alert,
	Linking,
	Platform,
	KeyboardAvoidingView,
	Animated,
} from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import DraggableFlatList, {
	type RenderItemParams,
	ScaleDecorator,
} from "react-native-draggable-flatlist";
import { supabase } from "../../../src/lib/supabase";
import { isApproximate, stripApprox } from "../../../src/lib/places";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import {
	Colors,
	Spacing,
	FontSize,
	FontWeight,
	Radius,
	Shadow,
} from "../../../src/constants/theme";
import type {
	Stop,
	StopType,
	StopStatus,
	VoteReaction,
	MemberRole,
} from "../../../src/types";
import { useUserStore } from "../../../src/store/userStore";

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
	proposed: Colors.bgElevated,
	confirmed: Colors.primary,
	passed: Colors.border,
	cancelled: Colors.danger,
};

const STATUS_TEXT_ON_DARK: Record<StopStatus, boolean> = {
	proposed: false,
	confirmed: true,
	passed: false,
	cancelled: true,
};

// Left-border accent that signals stop status at a glance on each card.
// Built outside the styles block so TS can resolve the lookup by key.
const STATUS_BORDER: Record<StopStatus, { borderLeftWidth: number; borderLeftColor: string }> = {
	proposed: { borderLeftWidth: 4, borderLeftColor: "#999999" },
	confirmed: { borderLeftWidth: 4, borderLeftColor: "#1a1a1a" },
	passed: { borderLeftWidth: 4, borderLeftColor: "#999999" },
	cancelled: { borderLeftWidth: 4, borderLeftColor: "#dc2626" },
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
	const userId = useUserStore((s) => s.userId);

	const [stops, setStops] = useState<Stop[]>([]);
	const [members, setMembers] = useState<MemberLite[]>([]);
	const [votes, setVotes] = useState<VoteRow[]>([]);
	const [arrivals, setArrivals] = useState<ArrivalRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [proposing, setProposing] = useState(false);
	const [proposeOpen, setProposeOpen] = useState(false);
	const [editingStop, setEditingStop] = useState<Stop | null>(null);
	const [detailStop, setDetailStop] = useState<Stop | null>(null);
	const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(
		null,
	);

	// One-shot fetch of the user's current location when a detail opens, so
	// we can compute and show the distance from the user to the stop.
	useEffect(() => {
		if (!detailStop) return;
		let cancelled = false;
		(async () => {
			try {
				const perm = await Location.getForegroundPermissionsAsync();
				if (perm.status !== "granted") return;
				const loc =
					(await Location.getLastKnownPositionAsync()) ??
					(await Location.getCurrentPositionAsync({
						accuracy: Location.Accuracy.Balanced,
					}));
				if (cancelled || !loc) return;
				setUserPos({
					lat: loc.coords.latitude,
					lng: loc.coords.longitude,
				});
			} catch {
				// best-effort — distance row will just say "Unknown"
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [detailStop]);
	const [savingEdit, setSavingEdit] = useState(false);

	// Local mirror of stop_ids the current user has already arrived at — used to
	// keep the "I arrived" button in the disabled "✓ Arrived" state across
	// navigations without waiting for the realtime push.
	const [arrivedStops, setArrivedStops] = useState<string[]>([]);

	// Toast (success / arrival feedback)
	const [toast, setToast] = useState<string | null>(null);
	useEffect(() => {
		if (!toast) return;
		const t = setTimeout(() => setToast(null), 2500);
		return () => clearTimeout(t);
	}, [toast]);
	function showToast(message: string) {
		setToast(message);
	}


	const myMember = useMemo(
		() => members.find((m) => m.user_id === userId) ?? null,
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
			.order("order_index", { ascending: true })
			.order("created_at", { ascending: true });
		if (e) throw e;
		setStops((data ?? []) as Stop[]);
	}, [id]);

	const loadMembers = useCallback(async () => {
		const { data, error: e } = await supabase
			.from("convoy_members")
			.select("id, user_id, role, users:user_id ( display_name, avatar_color )")
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
			.channel(`stops:${id}:${Math.random().toString(36).slice(2)}`)
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

	// ── Edit / delete / reorder / status menu ────────────────────────────────

	function canEditStop(stop: Stop): boolean {
		if (isLeader) return true;
		const myMemberId = myMemberIdRef.current;
		return (
			stop.proposed_by === myMemberId && stop.status === "proposed"
		);
	}

	async function handleEditSubmit(payload: {
		name: string;
		lat: number;
		lng: number;
		type: StopType;
		duration_min: number;
		note?: string;
	}) {
		if (!editingStop) return false;
		setSavingEdit(true);
		setError("");
		try {
			const lat = payload.lat || editingStop.lat;
			const lng = payload.lng || editingStop.lng;
			const { error: e } = await supabase
				.from("stops")
				.update({
					name: payload.name.trim(),
					type: payload.type,
					lat,
					lng,
					duration_min: payload.duration_min,
					notes: payload.note ?? null,
				})
				.eq("id", editingStop.id);
			if (e) throw e;
			await loadStops();
			return true;
		} catch (e: any) {
			setError(e?.message ?? "Couldn't update stop.");
			return false;
		} finally {
			setSavingEdit(false);
		}
	}

	function confirmDelete(stop: Stop) {
		Alert.alert(
			"Remove this stop?",
			`${stop.name} will be removed from the convoy plan.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: () => deleteStop(stop),
				},
			],
		);
	}

	async function deleteStop(stop: Stop) {
		setError("");
		try {
			// Explicit cascade — DB-level FK cascade would handle this but we
			// don't assume it's configured.
			await supabase.from("stop_votes").delete().eq("stop_id", stop.id);
			await supabase.from("stop_arrivals").delete().eq("stop_id", stop.id);
			const { error: e } = await supabase
				.from("stops")
				.delete()
				.eq("id", stop.id);
			if (e) throw e;
			await loadStops();
		} catch (e: any) {
			setError(e?.message ?? "Couldn't remove stop.");
		}
	}

	function openStatusMenu(stop: Stop) {
		// Tactile feedback even when there's no action sheet to show
		// (non-leaders) — the DraggableFlatList's ScaleDecorator handles the
		// visual scale-up while dragging.
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		if (!isLeader) return;
		const options: { label: string; status: StopStatus }[] = [
			{ label: "Confirm stop", status: "confirmed" },
			{ label: "Mark as passed", status: "passed" },
			{ label: "Cancel stop", status: "cancelled" },
		];
		if (stop.status === "cancelled" || stop.status === "passed") {
			options.push({ label: "Reopen", status: "proposed" });
		}
		// Filter out the current status — no-op
		const filtered = options.filter((o) => o.status !== stop.status);
		Alert.alert(
			stop.name,
			"Change stop status",
			[
				...filtered.map((o) => ({
					text: o.label,
					onPress: () => setStopStatus(stop.id, o.status),
				})),
				{ text: "Cancel", style: "cancel" as const },
			],
		);
	}

	async function markArrived(stopId: string) {
		const memberId = myMemberIdRef.current;
		if (!memberId) return;
		setError("");

		// Optimistic UI: flip the local "arrived" set immediately so the button
		// becomes "✓ Arrived" without waiting for realtime.
		setArrivedStops((prev) =>
			prev.includes(stopId) ? prev : [...prev, stopId],
		);

		try {
			const already = arrivals.find(
				(a) => a.stop_id === stopId && a.convoy_member_id === memberId,
			);
			if (!already) {
				const { error: e } = await supabase.from("stop_arrivals").insert({
					stop_id: stopId,
					convoy_member_id: memberId,
				});
				if (e) throw e;
			}

			// After our arrival lands, check whether everyone has now arrived.
			// If yes, flip the stop to "passed" so the map's next-stop indicator
			// advances to the next confirmed stop (the map screen subscribes to
			// the stops table via realtime — no extra wiring needed there).
			const [{ data: latestArrivals }, { data: convoyMembers }] =
				await Promise.all([
					supabase
						.from("stop_arrivals")
						.select("id, convoy_member_id")
						.eq("stop_id", stopId),
					supabase
						.from("convoy_members")
						.select("id")
						.eq("convoy_id", id),
				]);

			const arrivedCount = new Set(
				(latestArrivals ?? []).map((r: any) => r.convoy_member_id),
			).size;
			const totalMembers = convoyMembers?.length ?? 0;
			if (totalMembers > 0 && arrivedCount >= totalMembers) {
				await supabase
					.from("stops")
					.update({ status: "passed" })
					.eq("id", stopId);
			}

			await loadVotesAndArrivals();
			await loadStops();

			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			showToast("✓ Arrival confirmed!");
		} catch (e: any) {
			// Roll back the optimistic flip on failure.
			setArrivedStops((prev) => prev.filter((sId) => sId !== stopId));
			setError(e?.message ?? "Couldn't mark arrival.");
		}
	}

	// Keep arrivedStops in sync with whatever the server has for this user.
	// Runs whenever arrivals are reloaded so a return-trip to the screen lands
	// in the correct button state.
	useEffect(() => {
		const memberId = myMemberIdRef.current;
		if (!memberId) return;
		const mine = arrivals
			.filter((a) => a.convoy_member_id === memberId)
			.map((a) => a.stop_id);
		setArrivedStops((prev) => {
			const merged = new Set<string>([...prev, ...mine]);
			return Array.from(merged);
		});
	}, [arrivals]);

	function openNavigate(stop: Stop) {
		// Use the stop's coordinates as the destination, not the user's location.
		// Google's `dir/?api=1&destination=...&travelmode=driving` deep link
		// starts turn-by-turn directions from wherever the user currently is.
		const lat = stop.lat;
		const lng = stop.lng;
		const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
		const waze = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
		const openUrl = (url: string) => Linking.openURL(url).catch(() => {});

		Alert.alert("Navigate with", "Choose your navigation app", [
			{ text: "Google Maps", onPress: () => openUrl(gmaps) },
			{ text: "Waze", onPress: () => openUrl(waze) },
			{ text: "Cancel", style: "cancel" },
		]);
	}

	async function handlePropose(payload: {
		name: string;
		lat: number;
		lng: number;
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
			let lat = payload.lat;
			let lng = payload.lng;

			// Fallback when no Places API key is configured: use the proposer's
			// current location so the stop still has a usable coordinate pair.
			if (
				!Number.isFinite(lat) ||
				!Number.isFinite(lng) ||
				(lat === 0 && lng === 0)
			) {
				const { status } = await Location.getForegroundPermissionsAsync();
				if (status === "granted") {
					try {
						const loc =
							(await Location.getLastKnownPositionAsync()) ??
							(await Location.getCurrentPositionAsync({
								accuracy: Location.Accuracy.Balanced,
							}));
						if (loc) {
							lat = loc.coords.latitude;
							lng = loc.coords.longitude;
						}
					} catch {
						// best effort
					}
				}
			}

			// Append new stops to the end of the leader's ordered list.
			const nextOrder =
				stops.reduce((max, s) => Math.max(max, s.order_index ?? 0), -1) + 1;

			const { error: e } = await supabase.from("stops").insert({
				convoy_id: id,
				proposed_by: memberId,
				type: payload.type,
				name: payload.name.trim(),
				lat,
				lng,
				duration_min: payload.duration_min,
				status: "proposed",
				notes: payload.note ?? null,
				order_index: nextOrder,
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
		const memberIds = new Set(
			arrivals
				.filter((a) => a.stop_id === stopId)
				.map((a) => a.convoy_member_id),
		);
		const arrivedMembers = members.filter((m) => memberIds.has(m.member_id));
		const iArrived = memberIds.has(myMemberIdRef.current ?? "");
		return {
			arrivedMembers,
			iArrived,
			count: memberIds.size,
			total: members.length,
		};
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
				<DraggableFlatList
					data={stops}
					keyExtractor={(item) => item.id}
					contentContainerStyle={styles.list}
					activationDistance={isLeader ? 8 : 999}
					onDragBegin={() => {
						Haptics.impactAsync(
							Haptics.ImpactFeedbackStyle.Light,
						).catch(() => {});
					}}
					onDragEnd={({ data }) => {
						if (!isLeader) return;
						// Optimistic local reorder first so the UI doesn't snap back.
						setStops(data);
						// Persist new order_index for each stop. Fire-and-forget;
						// realtime will reconcile any drift.
						(async () => {
							try {
								await Promise.all(
									data.map((s, i) =>
										supabase
											.from("stops")
											.update({ order_index: i })
											.eq("id", s.id),
									),
								);
								Haptics.notificationAsync(
									Haptics.NotificationFeedbackType.Success,
								).catch(() => {});
							} catch (e: any) {
								setError(e?.message ?? "Couldn't save new order.");
								await loadStops();
							}
						})();
					}}
					renderItem={({
						item: stop,
						drag,
						isActive,
					}: RenderItemParams<Stop>) => {
						const counts = getVoteCounts(stop.id);
						const arr = getArrivals(stop.id);
						const editable = canEditStop(stop);
						const isPassed = stop.status === "passed";
						const isCancelled = stop.status === "cancelled";
						const nameStrike = isPassed || isCancelled;
						const iArrived =
							arr.iArrived || arrivedStops.includes(stop.id);
						return (
							<ScaleDecorator>
								<TouchableOpacity
									activeOpacity={1}
									delayLongPress={200}
									onLongPress={() => {
										if (isLeader) {
											Haptics.impactAsync(
												Haptics.ImpactFeedbackStyle.Medium,
											).catch(() => {});
											drag();
										} else {
											openStatusMenu(stop);
										}
									}}
								>
							<Card
								accent={stop.status === "confirmed"}
								style={[
									styles.stopCard,
									STATUS_BORDER[stop.status],
									isPassed && styles.stopCardPassed,
									isActive && styles.stopCardDragging,
								]}
							>
								{/* Title row — tap to open the detail sheet */}
								<TouchableOpacity
									style={styles.stopHeader}
									onPress={() => setDetailStop(stop)}
									activeOpacity={0.7}
								>
									<View style={styles.iconBox}>
										<Text style={styles.iconText}>{STOP_ICON[stop.type]}</Text>
									</View>
									<View style={{ flex: 1 }}>
										<Text
											style={[
												styles.stopName,
												nameStrike && styles.stopNameStrike,
											]}
											numberOfLines={1}
										>
											{stop.name}
										</Text>
										<Text style={styles.stopMeta}>
											{STOP_TYPE_LABEL[stop.type]} · {stop.duration_min} min
										</Text>
										{isApproximate(stop.notes) ? (
											<View style={styles.approxBadge}>
												<Text style={styles.approxBadgeText}>
													📍 approximate location
												</Text>
											</View>
										) : null}
										{stop.notes && stripApprox(stop.notes) ? (
											<Text style={styles.stopNote} numberOfLines={1}>
												{stripApprox(stop.notes)}
											</Text>
										) : null}
									</View>
									<View
										style={[
											styles.statusChip,
											{ backgroundColor: STATUS_COLOR[stop.status] },
										]}
									>
										<Text
											style={[
												styles.statusChipText,
												STATUS_TEXT_ON_DARK[stop.status]
													? styles.statusChipTextOnDark
													: styles.statusChipTextOnLight,
											]}
										>
											{STATUS_LABEL[stop.status]}
										</Text>
									</View>
								</TouchableOpacity>

								{/* Vote + arrival summary */}
								<View style={styles.summaryRow}>
									<View style={styles.summaryItem}>
										<Text style={styles.summaryStrong}>
											✅ {counts.approve}
										</Text>
									</View>
									<View style={styles.summaryItem}>
										<Text style={styles.summaryStrong}>
											❌ {counts.decline}
										</Text>
									</View>
									{counts.neutral > 0 ? (
										<View style={styles.summaryItem}>
											<Text style={styles.summaryMuted}>
												— {counts.neutral}
											</Text>
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
												style={[
													styles.arrivalDot,
													{ backgroundColor: m.avatar_color },
												]}
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
													style={{
														flex: 1,
														marginRight: Spacing.sm,
														minHeight: 44,
													}}
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
											style={styles.confirmedBtn}
										/>
										<Button
											label={iArrived ? "✓ Arrived" : "I arrived"}
											onPress={() => markArrived(stop.id)}
											disabled={iArrived}
											variant="ghost"
											style={styles.confirmedBtn}
										/>
									</View>
								) : null}

								{/* Management row — drag handle / edit / delete */}
								{isLeader || editable ? (
									<View style={styles.manageRow}>
										{isLeader ? (
											<TouchableOpacity
												style={styles.manageBtn}
												onLongPress={() => {
													Haptics.impactAsync(
														Haptics.ImpactFeedbackStyle.Medium,
													).catch(() => {});
													drag();
												}}
												delayLongPress={150}
												hitSlop={6}
											>
												<Text style={styles.manageIcon}>≡</Text>
											</TouchableOpacity>
										) : null}
										<View style={{ flex: 1 }} />
										{editable ? (
											<TouchableOpacity
												style={styles.manageBtn}
												onPress={() => setEditingStop(stop)}
												hitSlop={6}
											>
												<Text style={styles.manageIcon}>✏️</Text>
											</TouchableOpacity>
										) : null}
										{isLeader ? (
											<TouchableOpacity
												style={styles.manageBtn}
												onPress={() => confirmDelete(stop)}
												hitSlop={6}
											>
												<Text style={styles.manageIcon}>🗑️</Text>
											</TouchableOpacity>
										) : null}
									</View>
								) : null}
							</Card>
								</TouchableOpacity>
							</ScaleDecorator>
						);
					}}
				/>
			)}

			{/* Toast — floats above the list */}
			{toast ? (
				<View pointerEvents="none" style={styles.toast}>
					<Text style={styles.toastText}>{toast}</Text>
				</View>
			) : null}

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

			{/* Edit modal — reuses the same sheet, pre-filled from editingStop */}
			<ProposeStopSheet
				visible={editingStop !== null}
				mode="edit"
				initial={
					editingStop
						? {
								name: editingStop.name,
								lat: editingStop.lat,
								lng: editingStop.lng,
								type: editingStop.type,
								duration_min: editingStop.duration_min,
								note: editingStop.notes ?? "",
							}
						: undefined
				}
				onClose={() => setEditingStop(null)}
				onSubmit={async (payload) => {
					const ok = await handleEditSubmit(payload);
					if (ok) setEditingStop(null);
				}}
				submitting={savingEdit}
			/>

			{/* ─── Stop detail sheet ─────────────────────────────────────────── */}
			<Modal
				visible={detailStop !== null}
				animationType="slide"
				transparent
				onRequestClose={() => setDetailStop(null)}
			>
				<View style={styles.modalRoot}>
					<TouchableOpacity
						style={styles.modalBackdrop}
						activeOpacity={1}
						onPress={() => setDetailStop(null)}
					/>
					{detailStop ? (
						<View style={styles.sheet}>
							<View style={styles.sheetHandle} />
							<View style={styles.sheetHeader}>
								<Text style={styles.sheetTitle} numberOfLines={2}>
									{STOP_ICON[detailStop.type]}  {detailStop.name}
								</Text>
								<TouchableOpacity
									onPress={() => setDetailStop(null)}
									hitSlop={12}
								>
									<Text style={styles.sheetClose}>✕</Text>
								</TouchableOpacity>
							</View>

							<ScrollView contentContainerStyle={styles.sheetContent}>
								{/* Mini-map preview */}
								<View style={styles.detailMapWrap}>
									<MapView
										style={StyleSheet.absoluteFill}
										provider={PROVIDER_DEFAULT}
										initialRegion={{
											latitude: detailStop.lat,
											longitude: detailStop.lng,
											latitudeDelta: 0.05,
											longitudeDelta: 0.05,
										}}
										scrollEnabled={false}
										zoomEnabled={false}
										pitchEnabled={false}
										rotateEnabled={false}
									>
										<Marker
											coordinate={{
												latitude: detailStop.lat,
												longitude: detailStop.lng,
											}}
										/>
									</MapView>
								</View>

								{/* Meta rows */}
								<View style={styles.detailRow}>
									<Text style={styles.detailLabel}>Type</Text>
									<Text style={styles.detailValue}>
										{STOP_TYPE_LABEL[detailStop.type]}
									</Text>
								</View>
								<View style={styles.detailRow}>
									<Text style={styles.detailLabel}>Duration</Text>
									<Text style={styles.detailValue}>
										{detailStop.duration_min} min
									</Text>
								</View>
								<View style={styles.detailRow}>
									<Text style={styles.detailLabel}>Status</Text>
									<Text style={styles.detailValue}>
										{STATUS_LABEL[detailStop.status]}
									</Text>
								</View>
								<View style={styles.detailRow}>
									<Text style={styles.detailLabel}>Distance from you</Text>
									<Text style={styles.detailValue}>
										{userPos
											? formatDistance(
													haversineKm(
														{ lat: userPos.lat, lng: userPos.lng },
														{
															lat: detailStop.lat,
															lng: detailStop.lng,
														},
													),
												)
											: "—"}
									</Text>
								</View>
								<View style={styles.detailRow}>
									<Text style={styles.detailLabel}>Coordinates</Text>
									<Text style={styles.detailCoords}>
										{detailStop.lat.toFixed(5)}, {detailStop.lng.toFixed(5)}
									</Text>
								</View>

								{stripApprox(detailStop.notes) ? (
									<View style={styles.detailNoteBox}>
										<Text style={styles.detailLabel}>Notes</Text>
										<Text style={styles.detailNote}>
											{stripApprox(detailStop.notes)}
										</Text>
									</View>
								) : null}

								{/* Prominent warning for AI-placed stops we couldn't geocode */}
								{isApproximate(detailStop.notes) ? (
									<View style={styles.warningBox}>
										<Text style={styles.warningTitle}>
											📍 Approximate location
										</Text>
										<Text style={styles.warningBody}>
											We couldn't pin this stop to a real place. The coordinates
											are the AI's best guess and may be off by several kilometres.
											Tap "Edit / fix location" to search Google for the exact spot.
										</Text>
									</View>
								) : (
									<Text style={styles.detailHint}>
										Location looks off? Edit this stop and search the exact place
										via Google to fix the coordinates.
									</Text>
								)}

								{/* Actions */}
								<View style={styles.detailActions}>
									<Button
										label="🧭  Navigate"
										onPress={() => {
											const stop = detailStop;
											setDetailStop(null);
											openNavigate(stop);
										}}
									/>
									<Button
										label="✏️  Edit / fix location"
										variant="ghost"
										onPress={() => {
											const stop = detailStop;
											setDetailStop(null);
											setEditingStop(stop);
										}}
									/>
								</View>
							</ScrollView>
						</View>
					) : null}
				</View>
			</Modal>
		</SafeAreaView>
	);
}

// ─── Distance helpers ─────────────────────────────────────────────────────────
function haversineKm(
	a: { lat: number; lng: number },
	b: { lat: number; lng: number },
): number {
	const toRad = (n: number) => (n * Math.PI) / 180;
	const R = 6371;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(km: number): string {
	if (!Number.isFinite(km)) return "Unknown";
	if (km < 1) return `${Math.round(km * 1000)} m away`;
	if (km < 10) return `${km.toFixed(1)} km away`;
	return `${Math.round(km)} km away`;
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
			? Colors.primary
			: tone === "decline"
				? Colors.danger
				: Colors.bgElevated;
	const activeBorder =
		tone === "approve"
			? Colors.primary
			: tone === "decline"
				? Colors.danger
				: Colors.border;
	const activeText = tone === "neutral" ? Colors.textPrimary : "#fff";
	return (
		<TouchableOpacity
			style={[
				styles.voteBtn,
				active && { backgroundColor: activeBg, borderColor: activeBorder },
			]}
			onPress={onPress}
			activeOpacity={0.85}
		>
			<Text style={[styles.voteBtnText, active && { color: activeText }]}>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

// ── Propose stop sheet ──────────────────────────────────────────────────────
const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? "";

function ProposeStopSheet({
	visible,
	mode = "propose",
	initial,
	onClose,
	onSubmit,
	submitting,
}: {
	visible: boolean;
	mode?: "propose" | "edit";
	initial?: {
		name: string;
		lat: number;
		lng: number;
		type: StopType;
		duration_min: number;
		note?: string;
	};
	onClose: () => void;
	onSubmit: (payload: {
		name: string;
		lat: number;
		lng: number;
		type: StopType;
		duration_min: number;
		note?: string;
	}) => void;
	submitting: boolean;
}) {
	const [name, setName] = useState(initial?.name ?? "");
	const [lat, setLat] = useState(initial?.lat ?? 0);
	const [lng, setLng] = useState(initial?.lng ?? 0);
	const [type, setType] = useState<StopType>(initial?.type ?? "fuel");
	const [duration, setDuration] = useState(initial?.duration_min ?? 30);
	const [note, setNote] = useState(initial?.note ?? "");
	const [err, setErr] = useState("");

	// Reset / re-seed on open. In propose mode we clear; in edit mode we
	// preload the supplied initial values.
	useEffect(() => {
		if (!visible) return;
		setName(initial?.name ?? "");
		setLat(initial?.lat ?? 0);
		setLng(initial?.lng ?? 0);
		setType(initial?.type ?? "fuel");
		setDuration(initial?.duration_min ?? 30);
		setNote(initial?.note ?? "");
		setErr("");
	}, [visible, initial]);

	function handleSubmit() {
		if (!name.trim()) {
			setErr("Give the stop a name.");
			return;
		}
		setErr("");
		onSubmit({
			name: name.trim(),
			lat,
			lng,
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
						<Text style={styles.sheetTitle}>
							{mode === "edit" ? "Edit stop" : "Propose a stop"}
						</Text>
						<TouchableOpacity onPress={onClose} hitSlop={12}>
							<Text style={styles.sheetClose}>✕</Text>
						</TouchableOpacity>
					</View>

					<ScrollView
						contentContainerStyle={styles.sheetContent}
						keyboardShouldPersistTaps="handled"
						nestedScrollEnabled
					>
						<Text style={styles.label}>Name</Text>
						{PLACES_KEY ? (
							<GooglePlacesAutocomplete
								placeholder="Search for a place…"
								fetchDetails
								// Throttle requests + require at least 2 characters before
								// hitting the API — without these defaults the package fires
								// on every keystroke, often races itself, and looks broken.
								debounce={400}
								minLength={2}
								timeout={15000}
								keyboardShouldPersistTaps="handled"
								listViewDisplayed="auto"
								// Diagnostics: surface API problems instead of silently
								// rendering an empty dropdown.
								onFail={(e) => {
									console.warn("[Places] onFail:", e);
								}}
								onNotFound={() => {
									console.warn("[Places] onNotFound: no results");
								}}
								onTimeout={() => {
									console.warn("[Places] onTimeout — request took >15s");
								}}
								onPress={(data, details = null) => {
									// User picked a suggestion: use real Place coords.
									setName(data.description);
									setLat(details?.geometry?.location?.lat ?? 0);
									setLng(details?.geometry?.location?.lng ?? 0);
									if (err) setErr("");
								}}
								query={{
									key: PLACES_KEY,
									language: "en",
									types: "establishment|geocode",
								}}
								// Sync the typed value into our state so the "Propose stop"
								// button enables even when no suggestion is tapped (e.g.
								// Places returns nothing). Reset lat/lng on edit so
								// handlePropose() falls back to the user's current location.
								textInputProps={{
									placeholderTextColor: Colors.textMuted,
									onChangeText: (t: string) => {
										setName(t);
										setLat(0);
										setLng(0);
										if (err) setErr("");
									},
								}}
								enablePoweredByContainer={false}
								styles={{
									container: { flex: 0 },
									textInput: {
										backgroundColor: "#ffffff",
										borderRadius: 12,
										borderWidth: 1,
										borderColor: "#e8e8e8",
										fontSize: 15,
										color: "#1a1a1a",
										paddingHorizontal: 14,
										height: 48,
									},
									listView: {
										backgroundColor: "#ffffff",
										borderRadius: 12,
										marginTop: 4,
										shadowColor: "#000",
										shadowOffset: { width: 0, height: 4 },
										shadowOpacity: 0.08,
										shadowRadius: 12,
										elevation: 4,
									},
									row: { backgroundColor: "#ffffff", padding: 12 },
									description: { fontSize: 14, color: "#1a1a1a" },
								}}
							/>
						) : (
							<>
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
								<Text style={styles.placesHint}>
									Add an EXPO_PUBLIC_GOOGLE_PLACES_KEY to .env for place search.
								</Text>
							</>
						)}

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
							label={mode === "edit" ? "Save changes" : "Propose stop"}
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
	headerBtnText: {
		fontSize: FontSize.sm,
		color: Colors.textPrimary,
		fontWeight: FontWeight.medium,
	},
	title: {
		fontSize: FontSize.xxl,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		letterSpacing: -0.5,
	},
	addBtn: { alignItems: "flex-end" },
	addBtnText: {
		fontSize: 28,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
		lineHeight: 30,
	},

	// Error box (page-level)
	errorBox: {
		backgroundColor: "rgba(220,38,38,0.08)",
		borderRadius: Radius.md,
		padding: Spacing.md,
		marginHorizontal: Spacing.xl,
		marginBottom: Spacing.md,
	},
	errorText: {
		fontSize: FontSize.sm,
		color: Colors.danger,
		fontWeight: FontWeight.medium,
	},

	// Empty
	empty: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
	},
	emptyEmoji: { fontSize: 40, marginBottom: Spacing.md, opacity: 0.4 },
	emptyTitle: {
		fontSize: FontSize.xl,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		marginBottom: Spacing.sm,
		letterSpacing: -0.3,
	},
	emptySub: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		textAlign: "center",
		lineHeight: 22,
		marginBottom: Spacing.xl,
		maxWidth: 300,
		fontWeight: FontWeight.regular,
	},
	emptyBtn: { minWidth: 240, minHeight: 48 },

	// List
	list: { padding: Spacing.xl, paddingTop: 0, gap: Spacing.md },

	// Stop card
	stopCard: { gap: Spacing.md, ...Shadow.sm },
	stopHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
	iconBox: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: Colors.bgElevated,
		alignItems: "center",
		justifyContent: "center",
	},
	iconText: { fontSize: 20 },
	stopName: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		letterSpacing: -0.2,
	},
	stopMeta: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		marginTop: 4,
		fontWeight: FontWeight.regular,
	},
	statusChip: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	statusChipText: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.3,
	},
	statusChipTextOnDark: { color: "#fff" },
	statusChipTextOnLight: { color: Colors.textSecondary },

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
		fontWeight: FontWeight.semibold,
	},
	summaryMuted: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},

	// Arrival dots
	dotsRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		flexWrap: "wrap",
	},
	arrivalDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		borderWidth: 1,
		borderColor: "#fff",
	},
	dotsExtra: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginLeft: 4,
		fontWeight: FontWeight.medium,
	},

	// Vote row
	voteRow: { flexDirection: "row", gap: Spacing.sm },
	voteBtn: {
		flex: 1,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.sm,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: Colors.border,
		backgroundColor: Colors.bgCard,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 44,
	},
	voteBtnText: {
		color: Colors.textPrimary,
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
	},
	leaderRow: { flexDirection: "row" },
	placesHint: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginTop: 6,
		fontStyle: "italic",
		fontWeight: FontWeight.regular,
	},
	confirmedRow: {
		flexDirection: "row",
		gap: 8,
		marginTop: 12,
		alignItems: "stretch",
	},
	confirmedBtn: {
		flex: 1,
		height: 52,
	},

	// ── Status-based card treatment ──────────────────────────────────────────
	// (Left-border colour comes from STATUS_BORDER outside this StyleSheet.)
	stopCardPassed: { opacity: 0.5 },
	stopCardDragging: {
		// Slight elevation bump so the dragged card feels like it lifts off.
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.18,
		shadowRadius: 16,
		elevation: 10,
	},

	// Arrival / drag feedback toast
	toast: {
		position: "absolute",
		top: 80,
		left: 24,
		right: 24,
		backgroundColor: "#1a1a1a",
		borderRadius: 14,
		paddingVertical: 12,
		paddingHorizontal: 16,
		alignItems: "center",
		zIndex: 999,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 12,
		elevation: 8,
	},
	toastText: {
		color: "#fff",
		fontSize: 14,
		fontWeight: FontWeight.medium,
	},
	stopNameStrike: { textDecorationLine: "line-through" },
	stopNote: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginTop: 4,
		fontStyle: "italic",
		fontWeight: FontWeight.regular,
	},

	// ── Leader/proposer management row (reorder / edit / delete) ─────────────
	manageRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		marginTop: Spacing.md,
		paddingTop: Spacing.sm,
		borderTopWidth: 1,
		borderTopColor: Colors.borderSubtle,
	},
	manageBtn: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: Radius.full,
	},
	manageIcon: {
		fontSize: 18,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
	},
	manageIconDisabled: {
		color: Colors.textMuted,
		opacity: 0.4,
	},

	// Modal
	modalRoot: { flex: 1, justifyContent: "flex-end" },
	modalBackdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.4)",
	},
	sheet: {
		backgroundColor: Colors.bgCard,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		maxHeight: "90%",
		...Shadow.lg,
	},
	sheetHandle: {
		alignSelf: "center",
		width: 40,
		height: 4,
		borderRadius: 2,
		backgroundColor: Colors.border,
		marginTop: Spacing.md,
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
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		letterSpacing: -0.3,
	},
	sheetClose: {
		color: Colors.textMuted,
		fontSize: 22,
		fontWeight: FontWeight.regular,
		padding: 4,
	},
	sheetContent: {
		padding: Spacing.xl,
		paddingTop: 0,
		paddingBottom: Spacing.xxl,
	},

	// Stop detail sheet
	detailMapWrap: {
		height: 180,
		borderRadius: Radius.lg,
		overflow: "hidden",
		backgroundColor: Colors.bgCard,
		marginBottom: Spacing.lg,
	},
	detailRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: Spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Colors.borderSubtle,
		gap: Spacing.md,
	},
	detailLabel: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.medium,
	},
	detailValue: {
		flex: 1,
		textAlign: "right",
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},
	detailCoords: {
		flex: 1,
		textAlign: "right",
		fontSize: FontSize.sm,
		color: Colors.textSecondary,
		fontWeight: FontWeight.regular,
	},
	detailNoteBox: {
		marginTop: Spacing.md,
		padding: Spacing.md,
		borderRadius: Radius.md,
		backgroundColor: Colors.bgCard,
	},
	detailNote: {
		marginTop: 4,
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
		lineHeight: 22,
	},
	detailHint: {
		marginTop: Spacing.lg,
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		fontStyle: "italic",
		fontWeight: FontWeight.regular,
		lineHeight: 16,
		textAlign: "center",
	},

	// Inline "approximate location" badge under the stop title (list view)
	approxBadge: {
		alignSelf: "flex-start",
		marginTop: 4,
		backgroundColor: "rgba(217,119,6,0.12)",
		borderRadius: Radius.full,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	approxBadgeText: {
		fontSize: 10,
		fontWeight: FontWeight.semibold,
		color: Colors.warning,
		letterSpacing: 0.3,
	},

	// Prominent warning box inside the detail sheet
	warningBox: {
		marginTop: Spacing.lg,
		backgroundColor: "rgba(217,119,6,0.10)",
		borderLeftWidth: 3,
		borderLeftColor: Colors.warning,
		borderRadius: Radius.md,
		padding: Spacing.md,
	},
	warningTitle: {
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
		color: Colors.warning,
		marginBottom: 4,
	},
	warningBody: {
		fontSize: FontSize.sm,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
		lineHeight: 20,
	},
	detailActions: {
		marginTop: Spacing.lg,
		gap: Spacing.sm,
	},

	// Form fields
	label: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		marginBottom: Spacing.sm,
		marginTop: Spacing.lg,
	},
	input: {
		backgroundColor: Colors.bgCard,
		borderWidth: 1,
		borderColor: Colors.border,
		borderRadius: Radius.md,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
		minHeight: 48,
	},
	noteInput: { minHeight: 80, textAlignVertical: "top" },
	inputError: { borderColor: Colors.danger },
	charCount: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textAlign: "right",
		marginTop: 4,
		fontWeight: FontWeight.regular,
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
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.full,
		borderWidth: 1,
		borderColor: Colors.border,
		backgroundColor: Colors.bgCard,
		minHeight: 44,
	},
	typeChipActive: {
		backgroundColor: Colors.primary,
		borderColor: Colors.primary,
	},
	typeChipIcon: { fontSize: 16 },
	typeChipLabel: {
		color: Colors.textSecondary,
		fontSize: FontSize.sm,
		fontWeight: FontWeight.medium,
	},
	typeChipLabelActive: { color: "#fff", fontWeight: FontWeight.semibold },

	// Duration chip
	durationChip: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.full,
		borderWidth: 1,
		borderColor: Colors.border,
		backgroundColor: Colors.bgCard,
		minHeight: 44,
		justifyContent: "center",
	},
	durationChipActive: {
		backgroundColor: Colors.primary,
		borderColor: Colors.primary,
	},
	durationChipText: {
		color: Colors.textSecondary,
		fontSize: FontSize.sm,
		fontWeight: FontWeight.medium,
	},
	durationChipTextActive: { color: "#fff", fontWeight: FontWeight.semibold },

	submitBtn: { marginTop: Spacing.xl, minHeight: 52 },
});
