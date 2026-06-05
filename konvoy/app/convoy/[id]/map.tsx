import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	Linking,
	Platform,
	Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { supabase } from "../../../src/lib/supabase";
import { VehicleDot } from "../../../src/components/VehicleDot";
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from "../../../src/constants/theme";
import type {
	Convoy,
	ConvoyMember,
	MemberRole,
	MemberStatus,
	Stop,
	StatusEventType,
} from "../../../src/types";
import { useUserStore } from "../../../src/store/userStore";

const POSITION_UPDATE_MS = 3000;
const STALE_THRESHOLD_MS = 30 * 1000;

interface MemberInfo {
	member_id: string;
	user_id: string;
	role: MemberRole;
	status: MemberStatus;
	display_name: string;
	avatar_color: string;
}

interface Position {
	convoy_member_id: string;
	lat: number;
	lng: number;
	speed: number;
	heading: number;
	recorded_at: string;
}

const STOP_ICON: Record<string, string> = {
	fuel: "⛽",
	food: "🍔",
	rest: "☕",
	overnight: "🛏️",
	sightseeing: "📸",
	emergency: "🚨",
};

export default function ConvoyMapScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const userId = useUserStore((s) => s.userId);

	const mapRef = useRef<MapView | null>(null);
	const watcherRef = useRef<Location.LocationSubscription | null>(null);
	const lastUpsertRef = useRef<number>(0);
	const myMemberIdRef = useRef<string | null>(null);
	const followLeaderRef = useRef(false);

	const [convoy, setConvoy] = useState<Convoy | null>(null);
	const [members, setMembers] = useState<Record<string, MemberInfo>>({});
	const [positions, setPositions] = useState<Record<string, Position>>({});
	const [myPosition, setMyPosition] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [nextStop, setNextStop] = useState<Stop | null>(null);
	const [arrivedCount, setArrivedCount] = useState<{
		arrived: number;
		total: number;
	} | null>(null);

	const [loading, setLoading] = useState(true);
	const [permissionDenied, setPermissionDenied] = useState(false);
	const [now, setNow] = useState(Date.now());

	// Status quick-action UI state
	const [activeStatus, setActiveStatus] = useState<StatusEventType | null>(null);
	const [statusCooldown, setStatusCooldown] = useState(false);
	const [toast, setToast] = useState<{
		message: string;
		color: string;
	} | null>(null);
	const toastAnim = useRef(new Animated.Value(-100)).current;
	const toastHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const showToast = useCallback(
		(message: string, color: string = "#1a1a1a", durationMs = 3000) => {
			// Cancel a pending hide animation so back-to-back toasts don't fight.
			if (toastHideTimer.current) {
				clearTimeout(toastHideTimer.current);
				toastHideTimer.current = null;
			}
			setToast({ message, color });
			// Spring in from above the screen.
			Animated.spring(toastAnim, {
				toValue: 0,
				useNativeDriver: true,
				speed: 20,
				bounciness: 8,
			}).start();
			// Slide back out after `durationMs`, then clear the toast.
			toastHideTimer.current = setTimeout(() => {
				Animated.timing(toastAnim, {
					toValue: -100,
					duration: 300,
					useNativeDriver: true,
				}).start(() => setToast(null));
			}, durationMs);
		},
		[toastAnim],
	);

	// Tick to keep stale opacity fresh
	useEffect(() => {
		const t = setInterval(() => setNow(Date.now()), 5000);
		return () => clearInterval(t);
	}, []);

	// Mirror of `members` for use inside long-lived Supabase subscriptions
	// whose closures would otherwise capture a stale value.
	const currentMembersRef = useRef<Record<string, MemberInfo>>({});
	useEffect(() => {
		currentMembersRef.current = members;
	}, [members]);

	// ── Initial fetch + realtime subscription ─────────────────────────────────
	useEffect(() => {
		if (!id) return;
		let cancelled = false;

		async function loadConvoyAndMembers() {
			const { data: convoyData, error: convoyErr } = await supabase
				.from("convoys")
				.select("*")
				.eq("id", id)
				.single();
			if (convoyErr) throw convoyErr;
			if (cancelled) return;
			setConvoy(convoyData as Convoy);

			const { data: memData, error: memErr } = await supabase
				.from("convoy_members")
				.select(
					"id, user_id, role, status, users:user_id ( display_name, avatar_color )",
				)
				.eq("convoy_id", id);
			if (memErr) throw memErr;
			if (cancelled) return;

			const map: Record<string, MemberInfo> = {};
			let myId: string | null = null;
			for (const row of memData ?? []) {
				const r: any = row;
				map[r.id] = {
					member_id: r.id,
					user_id: r.user_id,
					role: r.role,
					status: r.status,
					display_name: r.users?.display_name ?? "Unknown",
					avatar_color: r.users?.avatar_color ?? Colors.primary,
				};
				if (r.user_id === userId) myId = r.id;
			}
			myMemberIdRef.current = myId;
			setMembers(map);
		}

		async function loadPositions() {
			const { data, error } = await supabase
				.from("live_positions")
				.select(
					"convoy_member_id, lat, lng, speed, heading, recorded_at, convoy_members!inner(convoy_id)",
				)
				.eq("convoy_members.convoy_id", id)
				.order("recorded_at", { ascending: false });
			if (error) return;
			if (cancelled) return;

			const latest: Record<string, Position> = {};
			for (const row of data ?? []) {
				const r: any = row;
				if (!latest[r.convoy_member_id]) {
					latest[r.convoy_member_id] = {
						convoy_member_id: r.convoy_member_id,
						lat: r.lat,
						lng: r.lng,
						speed: r.speed,
						heading: r.heading,
						recorded_at: r.recorded_at,
					};
				}
			}
			setPositions(latest);
		}

		async function loadNextStop() {
			// 1. Pull every still-relevant stop in this convoy, ordered manually
			//    by the leader (order_index). We include `proposed` too so the
			//    panel can flag the upcoming planned stop before it's confirmed.
			const { data: stopRows, error: stopsErr } = await supabase
				.from("stops")
				.select("*")
				.eq("convoy_id", id)
				.in("status", ["confirmed", "proposed"])
				.order("order_index", { ascending: true })
				.order("created_at", { ascending: true });
			if (stopsErr || cancelled) return;

			const stops = (stopRows ?? []) as Stop[];
			if (stops.length === 0) {
				if (!cancelled) {
					setNextStop(null);
					setArrivedCount(null);
				}
				return;
			}

			// Pick the first stop in route order that is still open. We intentionally
			// do NOT skip stops the current user has personally marked arrived —
			// the bottom panel must keep pointing at the current stop until the
			// whole group is there. Stops.tsx flips a stop to `passed` only once
			// every member has an arrival row, which is the signal we trust here.
			const next =
				stops.find(
					(s) => s.status !== "passed" && s.status !== "cancelled",
				) ?? null;

			if (cancelled) return;
			setNextStop(next);

			// 4. Refresh the "X / Y arrived" counter for that stop.
			if (next) {
				const [{ count: arrived }, { count: total }] = await Promise.all([
					supabase
						.from("stop_arrivals")
						.select("id", { count: "exact", head: true })
						.eq("stop_id", next.id),
					supabase
						.from("convoy_members")
						.select("id", { count: "exact", head: true })
						.eq("convoy_id", id),
				]);
				if (!cancelled) {
					setArrivedCount({
						arrived: arrived ?? 0,
						total: total ?? 0,
					});
				}
			} else if (!cancelled) {
				setArrivedCount(null);
			}
		}

		(async () => {
			try {
				await loadConvoyAndMembers();
				await Promise.all([loadPositions(), loadNextStop()]);
			} catch {
				// surface via permission-denied / empty states
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		const channel = supabase
			.channel(`convoy-map:${id}:${Math.random().toString(36).slice(2)}`)
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "live_positions" },
				(payload) => {
					const row: any = payload.new;
					if (!row || !members && !myMemberIdRef.current) return;
					setPositions((prev) => {
						const existing = prev[row.convoy_member_id];
						if (existing && existing.recorded_at >= row.recorded_at) return prev;
						return {
							...prev,
							[row.convoy_member_id]: {
								convoy_member_id: row.convoy_member_id,
								lat: row.lat,
								lng: row.lng,
								speed: row.speed ?? 0,
								heading: row.heading ?? 0,
								recorded_at: row.recorded_at,
							},
						};
					});
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
					const updated = payload.new as any;
					setConvoy((prev) => (prev ? { ...prev, ...updated } : prev));
					if (updated.status === "ended") {
						router.replace(`/convoy/${id}/summary`);
					}
				},
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "convoy_members",
					filter: `convoy_id=eq.${id}`,
				},
				() => {
					loadConvoyAndMembers().catch(() => {});
				},
			)
			// Status flips (passed / cancelled / confirmed) and reorders need to
			// re-resolve which stop is "next".
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "stops",
					filter: `convoy_id=eq.${id}`,
				},
				() => {
					loadNextStop().catch(() => {});
				},
			)
			// A fresh arrival from anyone may move the user past the current
			// next-stop (their own arrival certainly does; everyone else's may
			// flip the stop to `passed` via the stops listener above).
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "stop_arrivals" },
				() => {
					loadNextStop().catch(() => {});
				},
			)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "status_events",
				},
				(payload) => {
					const row: any = payload.new;
					if (!row) return;
					// Only react to OTHER members' events; my own taps already gave
					// me local feedback via showToast in handleStatusEvent.
					if (row.convoy_member_id === myMemberIdRef.current) return;

					// Resolve member's display name from the latest members snapshot.
					const name =
						currentMembersRef.current[row.convoy_member_id]?.display_name ??
						"A driver";

					// Emergency is prominent — full Alert.alert with View-on-map.
					// Everything else is the slide-down toast.
					switch (row.type as StatusEventType) {
						case "emergency_stop":
							showEmergencyAlert(name, row.note, row.lat, row.lng);
							break;
						case "running_late":
							showToast(`⏰ ${name} is running late`, "#d97706");
							break;
						case "fuel_stop":
							showToast(`⛽ ${name} needs a fuel stop`, "#2563eb");
							break;
						case "break_needed":
							showToast(`☕ ${name} needs a break`, "#1a1a1a");
							break;
						case "departed":
							showToast(`🚗 ${name} has departed`, "#16a34a");
							break;
						default:
							// technical_issue or any future event type
							showToast(`📢 ${name} sent a status update`, "#1a1a1a");
							break;
					}
				},
			)
			.subscribe();

		return () => {
			cancelled = true;
			supabase.removeChannel(channel);
		};
	}, [id]);

	// ── Filter positions to only this convoy's members ────────────────────────
	const visiblePositions = useMemo(() => {
		const out: Position[] = [];
		for (const memberId of Object.keys(members)) {
			const p = positions[memberId];
			if (p) out.push(p);
		}
		return out;
	}, [members, positions]);

	// ── Location watch ────────────────────────────────────────────────────────
	useEffect(() => {
		let active = true;

		async function startWatch() {
			const { status } = await Location.requestForegroundPermissionsAsync();
			if (!active) return;
			if (status !== "granted") {
				setPermissionDenied(true);
				return;
			}
			setPermissionDenied(false);

			watcherRef.current = await Location.watchPositionAsync(
				{
					accuracy: Location.Accuracy.High,
					timeInterval: POSITION_UPDATE_MS,
					distanceInterval: 5,
				},
				(loc) => {
					if (!active) return;
					const { latitude, longitude, speed, heading } = loc.coords;
					setMyPosition({ lat: latitude, lng: longitude });

					if (followLeaderRef.current === false && mapRef.current) {
						// no-op; we don't auto-pan to user
					}

					const nowMs = Date.now();
					if (nowMs - lastUpsertRef.current < POSITION_UPDATE_MS) return;
					lastUpsertRef.current = nowMs;

					const memberId = myMemberIdRef.current;
					if (!memberId) return;

					supabase
						.from("live_positions")
						.insert({
							convoy_member_id: memberId,
							lat: latitude,
							lng: longitude,
							speed: speed && speed > 0 ? speed * 3.6 : 0,
							heading: heading ?? 0,
							recorded_at: new Date(nowMs).toISOString(),
						})
						.then(() => {});
				},
			);
		}

		startWatch().catch(() => {});

		return () => {
			active = false;
			watcherRef.current?.remove();
			watcherRef.current = null;
		};
	}, [id]);

	// ── Initial fit-to-coordinates once positions arrive ──────────────────────
	const didInitialFitRef = useRef(false);
	useEffect(() => {
		if (didInitialFitRef.current) return;
		if (!mapRef.current) return;
		const coords = visiblePositions.map((p) => ({
			latitude: p.lat,
			longitude: p.lng,
		}));
		if (myPosition) {
			coords.push({ latitude: myPosition.lat, longitude: myPosition.lng });
		}
		if (coords.length === 0) return;
		didInitialFitRef.current = true;
		setTimeout(() => {
			mapRef.current?.fitToCoordinates(coords, {
				edgePadding: { top: 120, right: 60, bottom: 260, left: 60 },
				animated: true,
			});
		}, 300);
	}, [visiblePositions, myPosition]);

	// ── Follow leader ─────────────────────────────────────────────────────────
	const leaderPos = useMemo(() => {
		const leaderMember = Object.values(members).find((m) => m.role === "leader");
		if (!leaderMember) return null;
		return positions[leaderMember.member_id] ?? null;
	}, [members, positions]);

	useEffect(() => {
		if (!followLeaderRef.current || !leaderPos || !mapRef.current) return;
		mapRef.current.animateCamera(
			{ center: { latitude: leaderPos.lat, longitude: leaderPos.lng } },
			{ duration: 500 },
		);
	}, [leaderPos]);

	// ── Actions ───────────────────────────────────────────────────────────────
	const fitAll = useCallback(() => {
		followLeaderRef.current = false;
		const coords = visiblePositions.map((p) => ({
			latitude: p.lat,
			longitude: p.lng,
		}));
		if (myPosition) {
			coords.push({ latitude: myPosition.lat, longitude: myPosition.lng });
		}
		if (coords.length === 0 || !mapRef.current) return;
		mapRef.current.fitToCoordinates(coords, {
			edgePadding: { top: 120, right: 60, bottom: 260, left: 60 },
			animated: true,
		});
	}, [visiblePositions, myPosition]);

	const goToMe = useCallback(() => {
		followLeaderRef.current = false;
		if (!myPosition || !mapRef.current) return;
		mapRef.current.animateCamera(
			{
				center: { latitude: myPosition.lat, longitude: myPosition.lng },
				zoom: 15,
			},
			{ duration: 500 },
		);
	}, [myPosition]);

	const toggleFollowLeader = useCallback(() => {
		followLeaderRef.current = !followLeaderRef.current;
		if (followLeaderRef.current && leaderPos && mapRef.current) {
			mapRef.current.animateCamera(
				{
					center: { latitude: leaderPos.lat, longitude: leaderPos.lng },
					zoom: 15,
				},
				{ duration: 500 },
			);
		}
	}, [leaderPos]);

	async function insertStatusEvent(type: StatusEventType, note?: string) {
		// Re-fetch the user's membership in this convoy so we never insert with
		// a stale id (e.g. the user re-joined under a different member row).
		if (!userId || !id) {
			throw new Error("Missing convoy context.");
		}
		const { data: member, error: memberErr } = await supabase
			.from("convoy_members")
			.select("id")
			.eq("convoy_id", id)
			.eq("user_id", userId)
			.maybeSingle();
		if (memberErr) throw memberErr;
		if (!member) throw new Error("You're not a member of this convoy.");

		const memberId = member.id;
		myMemberIdRef.current = memberId;

		const { error: insertErr } = await supabase.from("status_events").insert({
			convoy_member_id: memberId,
			type,
			lat: myPosition?.lat ?? null,
			lng: myPosition?.lng ?? null,
			note: note ?? null,
		});
		if (insertErr) throw insertErr;

		// Mirror the event onto the member's status field so the lobby + member
		// list reflect what's happening without a separate subscription. We use
		// the existing MemberStatus values ('online' / 'weak_signal' / 'offline')
		// — emergencies flip to 'offline' so the dot shifts to red in the lobby.
		const memberStatusPatch =
			type === "emergency_stop" ? "offline" : "online";
		await supabase
			.from("convoy_members")
			.update({ status: memberStatusPatch })
			.eq("id", memberId)
			.then(() => {}, () => {});
	}

	function showEmergencyAlert(
		name: string,
		note: string | null,
		lat: number | null,
		lng: number | null,
	) {
		// Strong haptic on the receiving phone so it doesn't get missed.
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
			() => {},
		);
		Alert.alert(
			"🚨 Emergency Stop",
			`${name} has an emergency!${note ? `\n\n"${note}"` : ""}`,
			[
				{
					text: "View on map",
					onPress: () => {
						if (lat != null && lng != null && mapRef.current) {
							mapRef.current.animateToRegion(
								{
									latitude: lat,
									longitude: lng,
									latitudeDelta: 0.01,
									longitudeDelta: 0.01,
								},
								500,
							);
						}
					},
				},
				{ text: "OK", style: "cancel" },
			],
		);
	}

	async function handleStatusEvent(
		type: StatusEventType,
		label: string,
		note?: string,
		toastColor: string = "#1a1a1a",
	) {
		if (statusCooldown) return;

		setActiveStatus(type);
		setStatusCooldown(true);

		try {
			await insertStatusEvent(type, note);
			// Local tactile + visual confirmation. Other members get the same
			// signal via the realtime status_events subscription.
			Haptics.impactAsync(
				type === "emergency_stop"
					? Haptics.ImpactFeedbackStyle.Heavy
					: Haptics.ImpactFeedbackStyle.Medium,
			).catch(() => {});
			showToast(label, toastColor);
		} catch (e: any) {
			showToast(
				e?.message ?? "Couldn't send your status. Try again.",
				"#dc2626",
			);
		}

		// 10s cooldown to prevent spam-tapping
		setTimeout(() => {
			setStatusCooldown(false);
			setActiveStatus(null);
		}, 10000);
	}

	function handleSOS() {
		if (statusCooldown) return;
		Alert.prompt(
			"🚨 Emergency Stop",
			"Add a short note (optional)",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Send SOS",
					style: "destructive",
					onPress: (note?: string) =>
						handleStatusEvent(
							"emergency_stop",
							"🚨 SOS sent to your convoy",
							note?.slice(0, 120),
							"#dc2626",
						),
				},
			],
			"plain-text",
			"",
		);
	}

	// ── ETA (rough estimate, no routing engine) ───────────────────────────────
	function haversineKm(
		a: { lat: number; lng: number },
		b: { lat: number; lng: number },
	) {
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

	// Human-friendly distance: metres under 1 km, kilometres above.
	function formatDistance(km: number): string {
		if (!Number.isFinite(km)) return "Distance unknown";
		if (km < 1) return `${Math.round(km * 1000)} m away`;
		return `${km.toFixed(1)} km away`;
	}

	const etaByMember = useMemo(() => {
		const out: { member: MemberInfo; minutes: number | null }[] = [];
		const target = nextStop
			? { lat: nextStop.lat, lng: nextStop.lng }
			: leaderPos
				? { lat: leaderPos.lat, lng: leaderPos.lng }
				: null;
		if (!target) return out;
		for (const m of Object.values(members)) {
			const p = positions[m.member_id];
			if (!p) {
				out.push({ member: m, minutes: null });
				continue;
			}
			const km = haversineKm({ lat: p.lat, lng: p.lng }, target);
			const speed = p.speed > 5 ? p.speed : 60;
			const minutes = Math.max(1, Math.round((km / speed) * 60));
			out.push({ member: m, minutes });
		}
		return out
			.sort((a, b) => {
				if (a.minutes == null) return 1;
				if (b.minutes == null) return -1;
				return a.minutes - b.minutes;
			})
			.slice(0, 6);
	}, [members, positions, nextStop, leaderPos]);

	const myDistanceToStopKm = useMemo(() => {
		if (!nextStop || !myPosition) return null;
		return haversineKm(myPosition, { lat: nextStop.lat, lng: nextStop.lng });
	}, [nextStop, myPosition]);

	// ── Permission-denied screen ──────────────────────────────────────────────
	if (permissionDenied) {
		return (
			<SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
				<View style={styles.center}>
					<Text style={styles.permTitle}>Location permission needed</Text>
					<Text style={styles.permText}>
						We need your location to show your vehicle on the convoy map.
					</Text>
					<TouchableOpacity
						style={styles.permBtn}
						onPress={() => Linking.openSettings()}
					>
						<Text style={styles.permBtnText}>Open settings</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.permBackBtn}
						onPress={() => router.back()}
					>
						<Text style={styles.permBackText}>← Back</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	const memberCount = Object.keys(members).length;
	const initialRegion = myPosition
		? {
				latitude: myPosition.lat,
				longitude: myPosition.lng,
				latitudeDelta: 0.05,
				longitudeDelta: 0.05,
			}
		: {
				latitude: 50.85,
				longitude: 4.35,
				latitudeDelta: 0.1,
				longitudeDelta: 0.1,
			};

	return (
		<View style={styles.root}>
			<MapView
				ref={mapRef}
				style={StyleSheet.absoluteFill}
				provider={PROVIDER_DEFAULT}
				mapType="standard"
				showsUserLocation={false}
				showsCompass={false}
				showsMyLocationButton={false}
				toolbarEnabled={false}
				initialRegion={initialRegion}
			>
				{visiblePositions.map((p) => {
					const m = members[p.convoy_member_id];
					if (!m) return null;
					const stale = now - new Date(p.recorded_at).getTime() > STALE_THRESHOLD_MS;
					return (
						<Marker
							key={p.convoy_member_id}
							coordinate={{ latitude: p.lat, longitude: p.lng }}
							anchor={{ x: 0.5, y: 0.5 }}
							tracksViewChanges={false}
						>
							<View style={[{ opacity: stale ? 0.5 : 1 }, Shadow.md]}>
								<VehicleDot
									color={m.avatar_color}
									label={m.display_name}
									size={42}
									isLeader={m.role === "leader"}
									withRing
								/>
							</View>
						</Marker>
					);
				})}
				{nextStop ? (
					<Marker
						coordinate={{ latitude: nextStop.lat, longitude: nextStop.lng }}
						anchor={{ x: 0.5, y: 0.5 }}
						tracksViewChanges={false}
					>
						<View style={styles.stopMarker}>
							<Text style={styles.stopMarkerIcon}>
								{STOP_ICON[nextStop.type] ?? "📍"}
							</Text>
						</View>
					</Marker>
				) : null}
			</MapView>

			<SafeAreaView style={styles.overlay} edges={["top"]} pointerEvents="box-none">
				{/* HUD top-left */}
				<View style={styles.topRow} pointerEvents="box-none">
					<View style={[styles.hud, Shadow.md]}>
						<TouchableOpacity onPress={() => router.back()} hitSlop={8}>
							<Text style={styles.hudBack}>←</Text>
						</TouchableOpacity>
						<View style={{ flex: 1 }}>
							<Text style={styles.hudTitle} numberOfLines={1}>
								{convoy?.title ?? "Convoy"}
							</Text>
							<Text style={styles.hudSub}>
								{memberCount} member{memberCount === 1 ? "" : "s"}
							</Text>
						</View>
						<TouchableOpacity
							style={styles.overviewPill}
							onPress={() => router.push(`/convoy/${id}/overview`)}
							activeOpacity={0.8}
						>
							<Text style={styles.overviewPillText}>Overview</Text>
						</TouchableOpacity>
					</View>

					<View style={styles.mapButtons}>
						<TouchableOpacity
							style={[styles.mapBtn, Shadow.md]}
							onPress={goToMe}
							hitSlop={6}
						>
							<Text style={styles.mapBtnLabel}>Me</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.mapBtn, Shadow.md]}
							onPress={fitAll}
							hitSlop={6}
						>
							<Text style={styles.mapBtnLabel}>All</Text>
						</TouchableOpacity>
					</View>
				</View>
			</SafeAreaView>

			{loading ? (
				<View style={styles.loadingOverlay} pointerEvents="none">
					<ActivityIndicator color={Colors.primary} size="large" />
				</View>
			) : null}

			{/* Status toast — absolute, floats over the map, slides down from top */}
			{toast ? (
				<Animated.View
					pointerEvents="none"
					style={[
						styles.toast,
						{
							backgroundColor: toast.color,
							transform: [{ translateY: toastAnim }],
						},
					]}
				>
					<Text style={styles.toastText}>{toast.message}</Text>
				</Animated.View>
			) : null}

			{/* ── Bottom area ─────────────────────────────────────────────── */}
			<View style={styles.bottomArea} pointerEvents="box-none">
				{/* ETA bar */}
				<View style={[styles.etaBar, Shadow.lg]}>
					<View style={{ flex: 1 }}>
						<Text style={styles.etaLabel}>
							ETA to {nextStop ? nextStop.name : "leader"}
						</Text>
						<View style={styles.etaRow}>
							{etaByMember.length === 0 ? (
								<Text style={styles.etaEmpty}>Waiting for positions…</Text>
							) : (
								etaByMember.map(({ member, minutes }) => (
									<View key={member.member_id} style={styles.etaItem}>
										<View
											style={[
												styles.etaDot,
												{ backgroundColor: member.avatar_color },
											]}
										/>
										<Text style={styles.etaMin}>
											{minutes == null ? "—" : `${minutes}m`}
										</Text>
									</View>
								))
							)}
						</View>
					</View>
					<TouchableOpacity
						style={styles.followBtn}
						onPress={toggleFollowLeader}
					>
						<Text style={styles.followBtnText}>Follow leader</Text>
					</TouchableOpacity>
				</View>

				{/* Bottom panel */}
				<SafeAreaView edges={["bottom"]} style={styles.panel}>
					{nextStop ? (
						<TouchableOpacity
							style={styles.nextStopCard}
							onPress={() => router.push(`/convoy/${id}/stops`)}
							activeOpacity={0.85}
						>
							<View style={styles.stopIconBox}>
								<Text style={styles.stopIconText}>
									{STOP_ICON[nextStop.type] ?? "📍"}
								</Text>
							</View>
							<View style={{ flex: 1 }}>
								<Text style={styles.nextStopName} numberOfLines={1}>
									{nextStop.name}
								</Text>
								<Text style={styles.nextStopMeta}>
									{myDistanceToStopKm != null
										? formatDistance(myDistanceToStopKm)
										: "Distance unknown"}
									{arrivedCount
										? `  •  ${arrivedCount.arrived}/${arrivedCount.total} arrived`
										: ""}
								</Text>
							</View>
							<Text style={styles.nextStopChevron}>›</Text>
						</TouchableOpacity>
					) : null}

					{/* Quick status buttons */}
					<View style={styles.quickRow}>
						<QuickBtn
							label="I'm late"
							icon="🕒"
							active={activeStatus === "running_late"}
							disabled={statusCooldown}
							onPress={() =>
								handleStatusEvent(
									"running_late",
									"⏰ Your convoy knows you're late",
								)
							}
						/>
						<QuickBtn
							label="Tank"
							icon="⛽"
							active={activeStatus === "fuel_stop"}
							disabled={statusCooldown}
							onPress={() =>
								handleStatusEvent(
									"fuel_stop",
									"⛽ Tank stop shared with convoy",
								)
							}
						/>
						<QuickBtn
							label="Break"
							icon="☕"
							active={activeStatus === "break_needed"}
							disabled={statusCooldown}
							onPress={() =>
								handleStatusEvent("break_needed", "☕ Break request sent")
							}
						/>
						<QuickBtn
							label="SOS"
							icon="🚨"
							danger
							active={activeStatus === "emergency_stop"}
							disabled={statusCooldown}
							onPress={handleSOS}
						/>
					</View>

					{/* End convoy link — takes leader back to lobby */}
					<TouchableOpacity
						style={styles.endConvoyBtn}
						onPress={() => router.push(`/convoy/${id}/lobby`)}
					>
						<Text style={styles.endConvoyText}>End convoy</Text>
					</TouchableOpacity>

					{/* Tab bar */}
					<View style={styles.tabBar}>
						<TabItem label="Map" icon="🗺️" active />
						<TabItem
							label="Stops"
							icon="📍"
							onPress={() => router.push(`/convoy/${id}/stops`)}
						/>
						<TabItem
							label="Convoy"
							icon="👥"
							onPress={() => router.push(`/convoy/${id}/lobby`)}
						/>
						<TabItem
							label="Fuel"
							icon="⛽"
							onPress={() => router.push(`/convoy/fuel?convoy=${id}` as any)}
						/>
						<TabItem
							label="Settings"
							icon="⚙️"
							onPress={() => router.push("/settings")}
						/>
					</View>
				</SafeAreaView>
			</View>
		</View>
	);
}

// ── Quick button ────────────────────────────────────────────────────────────
function QuickBtn({
	label,
	icon,
	onPress,
	danger,
	active,
	disabled,
}: {
	label: string;
	icon: string;
	onPress: () => void;
	danger?: boolean;
	active?: boolean;
	disabled?: boolean;
}) {
	// During cooldown the *unselected* buttons fade; the active one stays bright
	// with a small check indicator so the user knows their status went through.
	const fade = disabled && !active;
	return (
		<TouchableOpacity
			style={[
				styles.quickBtn,
				danger && styles.quickBtnDanger,
				active && styles.quickBtnActive,
				active && danger && styles.quickBtnActiveDanger,
				fade && styles.quickBtnFaded,
			]}
			onPress={onPress}
			disabled={disabled}
			activeOpacity={0.8}
		>
			{active ? (
				<Text style={styles.quickBtnCheck}>✓</Text>
			) : (
				<Text style={styles.quickBtnIcon}>{icon}</Text>
			)}
			<Text
				style={[
					styles.quickBtnLabel,
					danger && styles.quickBtnLabelDanger,
					active && styles.quickBtnLabelActive,
				]}
			>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

// ── Tab item ────────────────────────────────────────────────────────────────
function TabItem({
	label,
	icon,
	active,
	onPress,
}: {
	label: string;
	icon: string;
	active?: boolean;
	onPress?: () => void;
}) {
	return (
		<TouchableOpacity
			style={styles.tabItem}
			onPress={onPress}
			disabled={active}
			activeOpacity={0.7}
		>
			<Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
			<Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: Colors.bg },
	safe: { flex: 1, backgroundColor: Colors.bg },
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
	},
	loadingOverlay: {
		...StyleSheet.absoluteFillObject,
		alignItems: "center",
		justifyContent: "center",
	},

	// Permission
	permTitle: {
		color: Colors.textPrimary,
		fontSize: FontSize.xl,
		fontWeight: FontWeight.semibold,
		marginBottom: Spacing.sm,
		textAlign: "center",
		letterSpacing: -0.3,
	},
	permText: {
		color: Colors.textMuted,
		fontSize: FontSize.md,
		textAlign: "center",
		lineHeight: 22,
		marginBottom: Spacing.xl,
		fontWeight: FontWeight.regular,
	},
	permBtn: {
		backgroundColor: Colors.primary,
		paddingHorizontal: Spacing.xl,
		paddingVertical: 14,
		borderRadius: 14,
		minHeight: 48,
		justifyContent: "center",
		...Shadow.sm,
	},
	permBtnText: { color: "#fff", fontWeight: FontWeight.semibold, fontSize: FontSize.md },
	permBackBtn: { marginTop: Spacing.lg, minHeight: 44, justifyContent: "center" },
	permBackText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.medium },

	// Overlay
	overlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
	},
	topRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		padding: Spacing.md,
	},

	// HUD
	hud: {
		flex: 1,
		marginRight: Spacing.sm,
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgba(10,10,10,0.92)",
		borderRadius: 16,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		gap: Spacing.sm,
		minHeight: 56,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.08)",
	},
	hudBack: {
		color: "#ffffff",
		fontSize: 22,
		fontWeight: FontWeight.semibold,
		paddingRight: Spacing.xs,
	},
	hudTitle: {
		color: "#ffffff",
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
	},
	hudSub: {
		color: Colors.textMuted,
		fontSize: FontSize.xs,
		marginTop: 2,
		fontWeight: FontWeight.regular,
	},
	overviewPill: {
		backgroundColor: "rgba(245,158,11,0.12)",
		borderWidth: 1,
		borderColor: "rgba(245,158,11,0.30)",
		borderRadius: 20,
		paddingHorizontal: 10,
		paddingVertical: 5,
	},
	overviewPillText: {
		fontSize: 11,
		fontWeight: FontWeight.semibold,
		color: "#f59e0b",
	},

	// Map buttons
	mapButtons: { gap: Spacing.sm },
	mapBtn: {
		width: 52,
		height: 52,
		borderRadius: 14,
		backgroundColor: "rgba(10,10,10,0.92)",
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.08)",
	},
	mapBtnLabel: {
		color: "#ffffff",
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
	},

	// Stop marker
	stopMarker: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: Colors.primary,
		borderWidth: 3,
		borderColor: "#fff",
		alignItems: "center",
		justifyContent: "center",
	},
	stopMarkerIcon: { fontSize: 16, color: "#fff" },

	// Bottom area
	bottomArea: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
	},

	// ETA
	etaBar: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgba(10,10,10,0.95)",
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		borderTopWidth: 1,
		borderTopColor: "rgba(255,255,255,0.06)",
		gap: Spacing.md,
	},
	etaLabel: {
		color: Colors.textMuted,
		fontSize: FontSize.xs,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		fontWeight: FontWeight.semibold,
		marginBottom: 8,
	},
	etaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
	etaEmpty: {
		color: Colors.textMuted,
		fontSize: FontSize.sm,
		fontWeight: FontWeight.regular,
	},
	etaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
	etaDot: { width: 10, height: 10, borderRadius: 5 },
	etaMin: {
		color: Colors.textPrimary,
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
	},
	followBtn: {
		backgroundColor: Colors.primary,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderRadius: 12,
		minHeight: 44,
		justifyContent: "center",
	},
	followBtnText: {
		color: "#fff",
		fontWeight: FontWeight.semibold,
		fontSize: FontSize.sm,
	},

	// Panel
	panel: {
		backgroundColor: "#0a0a0a",
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.md,
		borderTopWidth: 1,
		borderTopColor: "rgba(255,255,255,0.06)",
	},

	// Next stop card
	nextStopCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.bgCard,
		borderRadius: 14,
		padding: Spacing.md,
		marginBottom: Spacing.md,
		gap: Spacing.md,
		minHeight: 64,
		borderWidth: 1,
		borderColor: Colors.border,
		borderLeftWidth: 3,
		borderLeftColor: Colors.primary,
	},
	stopIconBox: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: Colors.bgElevated,
		alignItems: "center",
		justifyContent: "center",
	},
	stopIconText: { fontSize: 20 },
	nextStopName: {
		color: "#ffffff",
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
	},
	nextStopMeta: {
		color: Colors.primary,
		fontSize: FontSize.sm,
		marginTop: 2,
		fontWeight: FontWeight.semibold,
	},
	nextStopChevron: {
		color: Colors.textMuted,
		fontSize: 24,
		fontWeight: FontWeight.light,
	},

	// Quick buttons
	quickRow: {
		flexDirection: "row",
		gap: Spacing.sm,
		marginBottom: Spacing.md,
	},
	quickBtn: {
		flex: 1,
		backgroundColor: Colors.bgCard,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Spacing.md,
		minHeight: 60,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	quickBtnDanger: {
		backgroundColor: Colors.bgAccent,
		borderColor: Colors.borderAccent,
	},
	quickBtnIcon: { fontSize: 18, marginBottom: 4 },
	quickBtnLabel: {
		color: "#ffffff",
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.2,
	},
	quickBtnLabelDanger: { color: Colors.primary },

	// Active/disabled state for quick buttons after a status is sent
	quickBtnActive: {
		backgroundColor: Colors.primary,
		borderWidth: 0,
	},
	quickBtnActiveDanger: {
		backgroundColor: Colors.danger,
	},
	quickBtnLabelActive: { color: "#fff", fontWeight: FontWeight.semibold },
	quickBtnFaded: { opacity: 0.5 },
	quickBtnCheck: {
		fontSize: 18,
		color: "#fff",
		marginBottom: 4,
		fontWeight: FontWeight.semibold,
	},

	// Floating toast over the map
	toast: {
		position: "absolute",
		top: 100,
		left: 24,
		right: 24,
		backgroundColor: "#1a1a1a",
		borderRadius: 14,
		padding: 14,
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
		textAlign: "center",
	},

	// End convoy link
	endConvoyBtn: {
		alignItems: "center",
		padding: 10,
		marginTop: 4,
	},
	endConvoyText: {
		fontSize: 12,
		color: Colors.textMuted,
		textDecorationLine: "underline",
	},

	// Tab bar
	tabBar: {
		flexDirection: "row",
		borderTopWidth: 1,
		borderTopColor: "rgba(255,255,255,0.06)",
		paddingTop: Spacing.sm,
	},
	tabItem: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Spacing.sm,
		minHeight: 48,
	},
	tabIcon: { fontSize: 16, opacity: 0.35 },
	tabIconActive: { opacity: 1 },
	tabLabel: {
		color: Colors.textMuted,
		fontSize: FontSize.xs,
		fontWeight: FontWeight.medium,
		marginTop: 4,
	},
	tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
