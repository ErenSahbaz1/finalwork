// ─── In-app turn-by-turn navigation — TomTom powered ──────────────────────────
//
// APIs used:
//   • Routing API v1          — route geometry + turn-by-turn instructions
//                               (traffic=true gives real-time delay in summary)
//   • Map Display API         — night raster tiles via UrlTile (mapType="none")
//   • Traffic Flow API v4     — relative-flow tile overlay (green→red)
//
// Cost notes:
//   • routeFetched ref ensures one Routing call per session regardless of
//     re-mounts or double-seeded location effects.
//   • Snap-to-road is done locally against the route polyline — calling the
//     TomTom Snap to Roads API on every GPS tick would be too expensive.
//   • Map/traffic tiles are browser-cached by the OS WebView layer.
// ──────────────────────────────────────────────────────────────────────────────

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
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	Linking,
} from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useUserStore } from "../../../src/store/userStore";

const TOMTOM_KEY = process.env.EXPO_PUBLIC_TOMTOM_KEY ?? "";

// TomTom Map Display API — night style
// https://developer.tomtom.com/map-display-api/documentation/raster/tile
const TILE_URL = `https://api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&language=en-GB`;

// TomTom Traffic Flow API — relative flow (green free-flow → red congested)
// https://developer.tomtom.com/traffic-api/documentation/traffic-flow/raster-flow-tiles
const TRAFFIC_TILE_URL = `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`;

const NAV_RED = "#dc2626";
const NAV_RED_OUTLINE = "#7f1d1d";

interface LatLng {
	latitude: number;
	longitude: number;
}

interface NavInstruction {
	message: string;
	maneuver: string;
	point: LatLng;
	routeOffsetInMeters: number;
}

// ─── TomTom maneuver → arrow ─────────────────────────────────────────────────

function getManeuverArrow(maneuver: string): string {
	const map: Record<string, string> = {
		DEPART: "↑",
		ARRIVE: "⬤",
		STRAIGHT: "↑",
		FOLLOW: "↑",
		KEEP_RIGHT: "↗",
		KEEP_LEFT: "↖",
		BEAR_RIGHT: "↗",
		BEAR_LEFT: "↖",
		TURN_RIGHT: "→",
		TURN_LEFT: "←",
		SHARP_RIGHT: "↘",
		SHARP_LEFT: "↙",
		UTURN_RIGHT: "↻",
		UTURN_LEFT: "↺",
		MOTORWAY_ENTER_LEFT: "↖",
		MOTORWAY_ENTER_RIGHT: "↗",
		MOTORWAY_EXIT_LEFT: "↙",
		MOTORWAY_EXIT_RIGHT: "↘",
		ROUNDABOUT_LEFT: "↺",
		ROUNDABOUT_RIGHT: "↻",
		TAKE_FERRY: "⛴",
	};
	return map[maneuver] ?? "↑";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineKm(a: LatLng, b: LatLng): number {
	const toRad = (n: number) => (n * Math.PI) / 180;
	const R = 6371;
	const dLat = toRad(b.latitude - a.latitude);
	const dLng = toRad(b.longitude - a.longitude);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.sin(dLng / 2) ** 2 *
			Math.cos(toRad(a.latitude)) *
			Math.cos(toRad(b.latitude));
	return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(km: number): string {
	if (!Number.isFinite(km)) return "—";
	if (km < 1) return `${Math.round(km * 1000)} m`;
	if (km < 10) return `${km.toFixed(1)} km`;
	return `${Math.round(km)} km`;
}

function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds)) return "—";
	const mins = Math.round(seconds / 60);
	if (mins < 60) return `${mins} min`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getArrivalTime(seconds: number): string {
	if (!Number.isFinite(seconds)) return "—";
	return new Date(Date.now() + seconds * 1000).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

// Local snap-to-route: project GPS onto nearest polyline segment.
// Only snaps within ~100 m of the route to avoid masking off-route states.
function snapToRoute(lat: number, lng: number, route: LatLng[]): LatLng {
	if (route.length === 0) return { latitude: lat, longitude: lng };
	let minDist = Infinity;
	let snapped: LatLng = { latitude: lat, longitude: lng };
	for (let i = 0; i < route.length - 1; i++) {
		const p1 = route[i];
		const p2 = route[i + 1];
		const dx = p2.longitude - p1.longitude;
		const dy = p2.latitude - p1.latitude;
		const lenSq = dx * dx + dy * dy;
		if (lenSq === 0) continue;
		let t = ((lng - p1.longitude) * dx + (lat - p1.latitude) * dy) / lenSq;
		t = Math.max(0, Math.min(1, t));
		const pLat = p1.latitude + t * dy;
		const pLng = p1.longitude + t * dx;
		const d = Math.sqrt((lat - pLat) ** 2 + (lng - pLng) ** 2);
		if (d < minDist) {
			minDist = d;
			snapped = { latitude: pLat, longitude: pLng };
		}
	}
	return minDist < 0.001 ? snapped : { latitude: lat, longitude: lng };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NavigateScreen() {
	const router = useRouter();
	const userId = useUserStore((s) => s.userId);

	const params = useLocalSearchParams<{
		id: string;
		stopId?: string;
		stopName?: string;
		stopLat?: string;
		stopLng?: string;
	}>();
	const convoyId = params.id;
	const stopId = params.stopId ?? "";
	const stopName = params.stopName ?? "Destination";
	const stopLat = Number(params.stopLat);
	const stopLng = Number(params.stopLng);

	const destination: LatLng = useMemo(
		() => ({ latitude: stopLat, longitude: stopLng }),
		[stopLat, stopLng],
	);

	const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
	const [instructions, setInstructions] = useState<NavInstruction[]>([]);
	const [currentInstIdx, setCurrentInstIdx] = useState(0);
	const [distanceRemaining, setDistanceRemaining] = useState(0);
	const [durationRemaining, setDurationRemaining] = useState(0);
	const [trafficDelaySec, setTrafficDelaySec] = useState(0);
	const [userLocation, setUserLocation] = useState<LatLng | null>(null);
	const [userHeading, setUserHeading] = useState(0);
	const [userSpeed, setUserSpeed] = useState(0);
	const [loading, setLoading] = useState(true);
	const [arrivalShown, setArrivalShown] = useState(false);

	const mapRef = useRef<MapView | null>(null);
	const watcherRef = useRef<Location.LocationSubscription | null>(null);
	const routeFetched = useRef(false);

	// Circular-mean heading smoother — prevents 359°→0° wraparound jitter.
	const headingHistory = useRef<number[]>([]);
	const smoothHeading = useCallback((h: number): number => {
		const hist = headingHistory.current;
		hist.push(h);
		if (hist.length > 5) hist.shift();
		let sinS = 0, cosS = 0;
		for (const deg of hist) {
			const r = (deg * Math.PI) / 180;
			sinS += Math.sin(r);
			cosS += Math.cos(r);
		}
		return ((Math.atan2(sinS, cosS) * 180) / Math.PI + 360) % 360;
	}, []);

	// ─── Fallback: open in external maps ────────────────────────────────────
	const fallbackToExternalMaps = useCallback(() => {
		const url = `https://maps.google.com/?daddr=${stopLat},${stopLng}&directionsmode=driving`;
		Linking.openURL(url).catch(() => {});
		router.back();
	}, [stopLat, stopLng, router]);

	// ─── TomTom Routing API (one call per session) ───────────────────────────
	const fetchRoute = useCallback(
		async (origin: LatLng) => {
			if (routeFetched.current) return;
			routeFetched.current = true;

			if (!TOMTOM_KEY) {
				fallbackToExternalMaps();
				return;
			}

			try {
				// Routing API v1 — fastest car route with traffic + text instructions
				// https://developer.tomtom.com/routing-api/documentation/routing/calculate-route
				const url =
					`https://api.tomtom.com/routing/1/calculateRoute/` +
					`${origin.latitude},${origin.longitude}:${stopLat},${stopLng}/json` +
					`?key=${TOMTOM_KEY}` +
					`&traffic=true` +
					`&instructionsType=text` +
					`&language=en-GB` +
					`&travelMode=car` +
					`&routeType=fastest`;

				const res = await fetch(url);
				let data: any = {};
				try {
					data = await res.json();
				} catch {
					throw new Error(`HTTP ${res.status} — non-JSON response`);
				}

				if (__DEV__) {
					if (!res.ok) console.warn("[navigate] TomTom error:", JSON.stringify(data));
					else console.log("[navigate] TomTom route ok, legs:", data.routes?.[0]?.legs?.length);
				}

				if (!res.ok || !data.routes || data.routes.length === 0) {
					const msg =
						data?.detailedError?.message ??
						data?.error?.description ??
						(res.ok ? "No routes in response" : `HTTP ${res.status}`);
					throw new Error(msg);
				}

				const route = data.routes[0];

				// Flatten all leg points into one continuous polyline
				const points: LatLng[] = (route.legs ?? []).flatMap((leg: any) =>
					(leg.points ?? []).map((p: any) => ({
						latitude: p.latitude,
						longitude: p.longitude,
					})),
				);
				setRouteCoords(points);

				// Turn-by-turn instructions from guidance section
				const insts: NavInstruction[] = (
					route.guidance?.instructions ?? []
				).map((inst: any) => ({
					message: inst.message ?? inst.combinedMessage ?? "",
					maneuver: inst.maneuver ?? "STRAIGHT",
					point: {
						latitude: inst.point?.latitude ?? 0,
						longitude: inst.point?.longitude ?? 0,
					},
					routeOffsetInMeters: inst.routeOffsetInMeters ?? 0,
				}));
				setInstructions(insts);

				setDistanceRemaining(route.summary?.lengthInMeters ?? 0);
				setDurationRemaining(route.summary?.travelTimeInSeconds ?? 0);
				setTrafficDelaySec(route.summary?.trafficDelayInSeconds ?? 0);
				setCurrentInstIdx(0);
				setLoading(false);
			} catch (e: any) {
				routeFetched.current = false;
				setLoading(false);
				const detail = e?.message ? `\n\n${e.message}` : "";
				Alert.alert(
					"Route unavailable",
					`Couldn't calculate the route.${detail}\n\nOpen in Maps instead?`,
					[
						{ text: "Cancel", style: "cancel", onPress: () => router.back() },
						{ text: "Open Maps", onPress: fallbackToExternalMaps },
					],
				);
			}
		},
		[stopLat, stopLng, fallbackToExternalMaps, router],
	);

	// ─── GPS subscription ────────────────────────────────────────────────────
	useEffect(() => {
		let active = true;
		(async () => {
			if (!Number.isFinite(stopLat) || !Number.isFinite(stopLng)) {
				setLoading(false);
				Alert.alert("Missing destination", "Going back.", [
					{ text: "OK", onPress: () => router.back() },
				]);
				return;
			}
			const perm = await Location.requestForegroundPermissionsAsync();
			if (perm.status !== "granted") {
				setLoading(false);
				Alert.alert(
					"Location permission needed",
					"Convoi needs your GPS to navigate.",
					[{ text: "OK", onPress: () => router.back() }],
				);
				return;
			}

			const seed =
				(await Location.getLastKnownPositionAsync()) ??
				(await Location.getCurrentPositionAsync({
					accuracy: Location.Accuracy.Balanced,
				}));
			if (!active || !seed) return;

			const seedLoc: LatLng = {
				latitude: seed.coords.latitude,
				longitude: seed.coords.longitude,
			};
			setUserLocation(seedLoc);
			fetchRoute(seedLoc);

			watcherRef.current = await Location.watchPositionAsync(
				{
					accuracy: Location.Accuracy.BestForNavigation,
					timeInterval: 1000,
					distanceInterval: 5,
				},
				(loc) => {
					if (!active) return;
					setUserLocation({
						latitude: loc.coords.latitude,
						longitude: loc.coords.longitude,
					});
					if (loc.coords.heading != null && loc.coords.heading >= 0) {
						setUserHeading(smoothHeading(loc.coords.heading));
					}
					setUserSpeed(Math.max(0, Math.round((loc.coords.speed ?? 0) * 3.6)));
				},
			);
		})().catch(() => {});

		return () => {
			active = false;
			watcherRef.current?.remove();
			watcherRef.current = null;
		};
	}, [stopLat, stopLng, fetchRoute, router, smoothHeading]);

	// Road-snapped position used for the user arrow marker
	const snappedLocation = useMemo<LatLng | null>(() => {
		if (!userLocation) return null;
		if (routeCoords.length === 0) return userLocation;
		return snapToRoute(
			userLocation.latitude,
			userLocation.longitude,
			routeCoords,
		);
	}, [userLocation, routeCoords]);

	// Lookahead point: camera targets ~300 m ahead of the car in the direction
	// of travel, so the driver sits in the lower third of the screen with the
	// road ahead filling the upper two-thirds.
	const cameraTarget = useMemo<LatLng | null>(() => {
		const base = snappedLocation ?? userLocation;
		if (!base) return null;
		const rad = (userHeading * Math.PI) / 180;
		const dist = 0.0028; // ~280 m in degrees (latitude-independent approximation)
		return {
			latitude: base.latitude + Math.cos(rad) * dist,
			longitude: base.longitude + Math.sin(rad) * dist,
		};
	}, [snappedLocation, userLocation, userHeading]);

	// ─── Camera follow, step advance, arrival ────────────────────────────────
	useEffect(() => {
		if (!userLocation) return;

		mapRef.current?.animateCamera(
			{
				center: cameraTarget ?? snappedLocation ?? userLocation,
				pitch: 62,
				heading: userHeading,
				zoom: 17,
				altitude: 280,
			},
			{ duration: 350 },
		);

		const km = haversineKm(userLocation, destination);
		setDistanceRemaining(km * 1000);
		setDurationRemaining(Math.max(60, Math.round((km / 60) * 3600)));

		// Arrival: 50 m radius
		if (km * 1000 < 50 && !arrivalShown) {
			setArrivalShown(true);
			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			Alert.alert(
				`Arrived at ${stopName}`,
				"What would you like to do?",
				[
					{
						text: "Keep navigating",
						onPress: () => setArrivalShown(false),
					},
					{
						text: "Mark as arrived",
						style: "default",
						onPress: handleArrived,
					},
				],
				{ cancelable: false },
			);
			return;
		}

		// Instruction advance: within 30 m of instruction point → next
		if (instructions.length > 0 && currentInstIdx < instructions.length - 1) {
			const inst = instructions[currentInstIdx];
			if (haversineKm(userLocation, inst.point) * 1000 < 30) {
				setCurrentInstIdx((i) => i + 1);
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userLocation, userHeading, snappedLocation]);

	// ─── Arrival action ──────────────────────────────────────────────────────
	async function handleArrived() {
		try {
			if (userId && stopId && convoyId) {
				const { data: member } = await supabase
					.from("convoy_members")
					.select("id")
					.eq("convoy_id", convoyId)
					.eq("user_id", userId)
					.maybeSingle();
				if (member) {
					await supabase
						.from("stop_arrivals")
						.insert({ stop_id: stopId, convoy_member_id: member.id });
				}
			}
		} catch {
			// non-fatal
		} finally {
			router.replace(`/convoy/${convoyId}/map`);
		}
	}

	function handleExit() {
		Alert.alert("Exit navigation", "Return to the convoy map?", [
			{ text: "Cancel", style: "cancel" },
			{ text: "Exit", style: "destructive", onPress: () => router.back() },
		]);
	}

	// ─── Loading screen ──────────────────────────────────────────────────────
	if (loading) {
		return (
			<View style={styles.loadingRoot}>
				<StatusBar style="light" />
				<ActivityIndicator color={NAV_RED} size="large" />
				<Text style={styles.loadingTitle}>Calculating route…</Text>
				<Text style={styles.loadingTo} numberOfLines={1}>
					→ {stopName}
				</Text>
			</View>
		);
	}

	const currentInst = instructions[currentInstIdx];
	const nextInst = instructions[currentInstIdx + 1];
	const hasTrafficDelay = trafficDelaySec > 60;

	return (
		<View style={styles.root}>
			<StatusBar style="light" />

			{/* ── Map with TomTom tiles ───────────────────────────────────────── */}
			<MapView
				ref={mapRef}
				style={StyleSheet.absoluteFill}
				mapType="standard"
				showsBuildings={false}
				showsPointsOfInterest={false}
				showsCompass={false}
				showsMyLocationButton={false}
				showsUserLocation={false}
				mapPadding={{ top: 0, right: 0, bottom: 240, left: 0 }}
				pitchEnabled
				rotateEnabled
				scrollEnabled={false}
				zoomEnabled={false}
				toolbarEnabled={false}
				initialCamera={
					userLocation
						? {
								center: cameraTarget ?? userLocation,
								pitch: 62,
								heading: userHeading,
								zoom: 17,
								altitude: 280,
							}
						: undefined
				}
			>
				{/* TomTom Traffic Flow tiles — rendered above the base map */}
				{TOMTOM_KEY ? (
					<UrlTile
						urlTemplate={TRAFFIC_TILE_URL}
						maximumZ={22}
						flipY={false}
						opacity={0.55}
						zIndex={0}
					/>
				) : null}

				{/* Route: dark casing + bright line */}
				{routeCoords.length > 0 ? (
					<>
						<Polyline
							coordinates={routeCoords}
							strokeColor={NAV_RED_OUTLINE}
							strokeWidth={14}
							lineCap="round"
							lineJoin="round"
							zIndex={5}
						/>
						<Polyline
							coordinates={routeCoords}
							strokeColor={NAV_RED}
							strokeWidth={8}
							lineCap="round"
							lineJoin="round"
							zIndex={6}
						/>
					</>
				) : null}

				{/* User position arrow */}
				{snappedLocation ? (
					<Marker
						coordinate={snappedLocation}
						anchor={{ x: 0.5, y: 0.5 }}
						flat
						rotation={userHeading}
						zIndex={10}
						tracksViewChanges={false}
					>
						<View style={styles.navArrow}>
							<Text style={styles.navArrowText}>▲</Text>
						</View>
					</Marker>
				) : null}

				{/* Destination pin */}
				<Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }} zIndex={5}>
					<View style={styles.destPin}>
						<View style={styles.destPinDot} />
					</View>
				</Marker>
			</MapView>

			{/* ── Top instruction banner ─────────────────────────────────────── */}
			{currentInst ? (
				<View style={styles.banner}>
					<View style={styles.maneuverBox}>
						<Text style={styles.maneuverArrow}>
							{getManeuverArrow(currentInst.maneuver)}
						</Text>
					</View>
					<View style={styles.instructionBlock}>
						<Text style={styles.instructionText} numberOfLines={2}>
							{currentInst.message}
						</Text>
						<Text style={styles.instructionSub}>
							{formatDistance(distanceRemaining / 1000)} remaining
						</Text>
					</View>
				</View>
			) : null}

			{/* ── "Then …" pill ──────────────────────────────────────────────── */}
			{nextInst ? (
				<View style={styles.nextPill}>
					<Text style={styles.nextPillText}>
						Then {getManeuverArrow(nextInst.maneuver)}{"  "}{nextInst.message.split(" ").slice(0, 4).join(" ")}…
					</Text>
				</View>
			) : null}

			{/* ── Speed badge ────────────────────────────────────────────────── */}
			<View style={styles.speedBadge}>
				<Text style={styles.speedNum}>{userSpeed}</Text>
				<Text style={styles.speedUnit}>km/h</Text>
			</View>

			{/* ── Traffic delay badge (shows when delay > 1 min) ─────────────── */}
			{hasTrafficDelay ? (
				<View style={styles.delayBadge}>
					<Text style={styles.delayText}>
						+{formatDuration(trafficDelaySec)} delay
					</Text>
				</View>
			) : null}

			{/* ── Bottom bar ─────────────────────────────────────────────────── */}
			<View style={styles.bottomBar}>
				<View style={styles.bottomInfo}>
					<Text style={styles.bottomTime}>
						{formatDuration(durationRemaining)}
					</Text>
					<Text style={styles.bottomDot}>·</Text>
					<Text style={styles.bottomDist}>
						{formatDistance(distanceRemaining / 1000)}
					</Text>
					<Text style={styles.bottomDot}>·</Text>
					<Text style={styles.bottomEta}>
						arr. {getArrivalTime(durationRemaining)}
					</Text>
				</View>
				<View style={styles.bottomActions}>
					<TouchableOpacity
						style={styles.exitBtn}
						onPress={handleExit}
						activeOpacity={0.8}
					>
						<Text style={styles.exitText}>Exit</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.arrivedBtn}
						onPress={handleArrived}
						activeOpacity={0.85}
					>
						<Text style={styles.arrivedText}>I arrived</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: "#0a0a0a" },

	// Loading
	loadingRoot: {
		flex: 1,
		backgroundColor: "#0a0a0a",
		alignItems: "center",
		justifyContent: "center",
		gap: 14,
	},
	loadingTitle: {
		color: "#ffffff",
		fontSize: 17,
		fontWeight: "500",
		letterSpacing: -0.3,
	},
	loadingTo: {
		color: "rgba(255,255,255,0.4)",
		fontSize: 13,
		fontWeight: "400",
	},

	// User arrow
	navArrow: {
		width: 38,
		height: 38,
		backgroundColor: NAV_RED,
		borderRadius: 19,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 3,
		borderColor: "#fff",
	},
	navArrowText: {
		color: "#fff",
		fontSize: 16,
		lineHeight: 18,
		fontWeight: "700",
	},

	// Destination pin
	destPin: {
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: "rgba(220,38,38,0.3)",
		borderWidth: 2,
		borderColor: NAV_RED,
		alignItems: "center",
		justifyContent: "center",
	},
	destPinDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: NAV_RED,
	},

	// Instruction banner
	banner: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		backgroundColor: "rgba(10,10,10,0.96)",
		paddingTop: 56,
		paddingBottom: 20,
		paddingHorizontal: 20,
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
		borderBottomWidth: 1,
		borderColor: "rgba(255,255,255,0.06)",
		zIndex: 100,
	},
	maneuverBox: {
		width: 60,
		height: 60,
		backgroundColor: NAV_RED,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	maneuverArrow: {
		fontSize: 28,
		color: "#fff",
		fontWeight: "700",
	},
	instructionBlock: { flex: 1 },
	instructionText: {
		fontSize: 17,
		fontWeight: "700",
		color: "#ffffff",
		lineHeight: 23,
		letterSpacing: -0.3,
	},
	instructionSub: {
		fontSize: 12,
		color: "rgba(255,255,255,0.45)",
		marginTop: 4,
		fontWeight: "400",
	},

	// "Then …" pill
	nextPill: {
		position: "absolute",
		top: 160,
		left: 20,
		backgroundColor: "rgba(10,10,10,0.88)",
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.08)",
		paddingHorizontal: 14,
		paddingVertical: 8,
		zIndex: 99,
	},
	nextPillText: {
		color: "rgba(255,255,255,0.7)",
		fontSize: 12,
		fontWeight: "500",
	},

	// Speed badge
	speedBadge: {
		position: "absolute",
		bottom: 200,
		left: 16,
		width: 62,
		height: 62,
		backgroundColor: "rgba(10,10,10,0.92)",
		borderRadius: 31,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.1)",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 99,
	},
	speedNum: {
		fontSize: 20,
		fontWeight: "700",
		color: "#fff",
		lineHeight: 22,
	},
	speedUnit: {
		fontSize: 9,
		color: "rgba(255,255,255,0.5)",
		letterSpacing: 0.5,
	},

	// Traffic delay badge
	delayBadge: {
		position: "absolute",
		bottom: 200,
		right: 16,
		backgroundColor: "rgba(220,38,38,0.15)",
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "rgba(220,38,38,0.35)",
		paddingHorizontal: 12,
		paddingVertical: 8,
		zIndex: 99,
	},
	delayText: {
		color: NAV_RED,
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0.2,
	},

	// Bottom bar
	bottomBar: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: "rgba(10,10,10,0.97)",
		paddingBottom: 36,
		paddingTop: 18,
		paddingHorizontal: 20,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		borderTopWidth: 1,
		borderColor: "rgba(255,255,255,0.06)",
		zIndex: 100,
	},
	bottomInfo: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 14,
	},
	bottomTime: {
		fontSize: 24,
		fontWeight: "700",
		color: "#fff",
		letterSpacing: -0.5,
	},
	bottomDot: { color: "rgba(255,255,255,0.3)", fontSize: 16 },
	bottomDist: {
		fontSize: 15,
		color: "rgba(255,255,255,0.75)",
		fontWeight: "500",
	},
	bottomEta: {
		fontSize: 13,
		color: "rgba(255,255,255,0.4)",
		fontWeight: "400",
	},
	bottomActions: {
		flexDirection: "row",
		gap: 12,
	},
	exitBtn: {
		flex: 1,
		height: 52,
		backgroundColor: "rgba(255,255,255,0.06)",
		borderRadius: 26,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.1)",
	},
	exitText: {
		color: "rgba(255,255,255,0.7)",
		fontSize: 15,
		fontWeight: "500",
	},
	arrivedBtn: {
		flex: 2,
		height: 52,
		backgroundColor: NAV_RED,
		borderRadius: 26,
		alignItems: "center",
		justifyContent: "center",
	},
	arrivedText: {
		color: "#fff",
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0.2,
	},
});
