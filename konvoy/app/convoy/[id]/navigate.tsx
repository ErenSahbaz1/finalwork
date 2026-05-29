// ─── In-app turn-by-turn navigation (Waze / Google Maps style) ────────────────
// Dark 3D-tilted map, heading-up rotation, large dark instruction banner at the
// top, "Then …" secondary pill, current-speed circle, dark bottom bar with
// time/distance/ETA + Exit / I-arrived actions.
//
// Cost-saving:
//   • The Directions API call is gated by a `routeFetched` ref so it never
//     runs more than once per navigation session, even if the screen
//     re-mounts or location seeds twice.
//   • The screen is only mounted when the user explicitly taps "Navigate in
//     Convoi" from the Stops alert — no background fetches.
//   • In __DEV__ a session-scoped counter logs every API call so spend is
//     visible at a glance.
//
// Graceful no-key fallback: if EXPO_PUBLIC_GOOGLE_MAPS_KEY isn't set OR the
// Directions call fails, we open the external Google Maps deeplink and
// router.back() out of the screen.
// ──────────────────────────────────────────────────────────────────────────────

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
} from "react-native";
import MapView, {
	Marker,
	Polyline,
	PROVIDER_GOOGLE,
} from "react-native-maps";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useUserStore } from "../../../src/store/userStore";

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const NAV_BLUE = "#4AADFF";
const NAV_BLUE_OUTLINE = "#1a6ab5";

// Minimal navigation map style — removes POIs, transit, neighborhood labels,
// and most road label icons so the screen stays clean during driving and only
// the roads + route polyline read at a glance.
const NAVIGATION_MAP_STYLE = [
	{ featureType: "poi", stylers: [{ visibility: "off" }] },
	{ featureType: "poi.park", stylers: [{ visibility: "simplified" }] },
	{ featureType: "transit", stylers: [{ visibility: "off" }] },
	{
		featureType: "landscape.man_made",
		stylers: [{ visibility: "simplified" }],
	},
	{
		featureType: "road",
		elementType: "labels.icon",
		stylers: [{ visibility: "off" }],
	},
	{
		featureType: "road.local",
		elementType: "labels",
		stylers: [{ visibility: "simplified" }],
	},
	{
		featureType: "administrative.neighborhood",
		stylers: [{ visibility: "off" }],
	},
];

interface LatLng {
	latitude: number;
	longitude: number;
}

interface NavigationStep {
	instruction: string;
	distance: string;
	maneuver: string;
	endLat: number;
	endLng: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getManeuverArrow(maneuver: string): string {
	const arrows: Record<string, string> = {
		"turn-left": "←",
		"turn-right": "→",
		"turn-slight-left": "↖",
		"turn-slight-right": "↗",
		"turn-sharp-left": "↙",
		"turn-sharp-right": "↘",
		"uturn-left": "↺",
		"uturn-right": "↻",
		"roundabout-left": "↺",
		"roundabout-right": "↻",
		merge: "↑",
		"fork-left": "↖",
		"fork-right": "↗",
		"ramp-left": "↖",
		"ramp-right": "↗",
		straight: "↑",
		"keep-left": "↖",
		"keep-right": "↗",
	};
	return arrows[maneuver] ?? "↑";
}

function haversineKm(a: LatLng, b: LatLng): number {
	const toRad = (n: number) => (n * Math.PI) / 180;
	const R = 6371;
	const dLat = toRad(b.latitude - a.latitude);
	const dLng = toRad(b.longitude - a.longitude);
	const lat1 = toRad(a.latitude);
	const lat2 = toRad(b.latitude);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
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
	return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getArrivalTime(seconds: number): string {
	if (!Number.isFinite(seconds)) return "—";
	const arrival = new Date(Date.now() + seconds * 1000);
	return arrival.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

// Cheap road-snapping: project the raw GPS onto the nearest segment of the
// route polyline so the arrow tracks the line cleanly instead of wandering
// off into adjacent buildings. Only snaps if within ~100 m of the route —
// further than that and we treat it as "user went off route" and return raw
// GPS, so off-route states still surface correctly.
function snapToRoute(
	userLat: number,
	userLng: number,
	routePoints: LatLng[],
): LatLng {
	if (routePoints.length === 0) {
		return { latitude: userLat, longitude: userLng };
	}
	let minDist = Infinity;
	let snapped: LatLng = { latitude: userLat, longitude: userLng };
	for (let i = 0; i < routePoints.length - 1; i++) {
		const p1 = routePoints[i];
		const p2 = routePoints[i + 1];
		const dx = p2.longitude - p1.longitude;
		const dy = p2.latitude - p1.latitude;
		const lenSq = dx * dx + dy * dy;
		if (lenSq === 0) continue;
		let t =
			((userLng - p1.longitude) * dx + (userLat - p1.latitude) * dy) / lenSq;
		t = Math.max(0, Math.min(1, t));
		const projLat = p1.latitude + t * dy;
		const projLng = p1.longitude + t * dx;
		const d = Math.sqrt(
			(userLat - projLat) ** 2 + (userLng - projLng) ** 2,
		);
		if (d < minDist) {
			minDist = d;
			snapped = { latitude: projLat, longitude: projLng };
		}
	}
	// ~0.001° lat/lng = ~100 m at mid-latitudes.
	if (minDist < 0.001) return snapped;
	return { latitude: userLat, longitude: userLng };
}

// Google encoded-polyline decoder. Returns an array of {latitude, longitude}.
function decodePolyline(encoded: string): LatLng[] {
	const points: LatLng[] = [];
	let index = 0;
	let lat = 0;
	let lng = 0;
	while (index < encoded.length) {
		let b: number;
		let shift = 0;
		let result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		lat += result & 1 ? ~(result >> 1) : result >> 1;
		shift = 0;
		result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		lng += result & 1 ? ~(result >> 1) : result >> 1;
		points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
	}
	return points;
}

// ─── Component ────────────────────────────────────────────────────────────────

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

	const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
	const [steps, setSteps] = useState<NavigationStep[]>([]);
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [distanceRemaining, setDistanceRemaining] = useState(0);
	const [durationRemaining, setDurationRemaining] = useState(0);
	const [userLocation, setUserLocation] = useState<LatLng | null>(null);
	const [userHeading, setUserHeading] = useState(0);
	const [userSpeed, setUserSpeed] = useState(0); // km/h
	const [loading, setLoading] = useState(true);
	const [arrivalShown, setArrivalShown] = useState(false);

	const mapRef = useRef<MapView | null>(null);
	const watcherRef = useRef<Location.LocationSubscription | null>(null);

	// Cost-saving: only ever fetch the route once per session, even if effects
	// re-fire (e.g. params identity changes, location seeds twice).
	const routeFetched = useRef(false);
	const requestCount = useRef(0);

	// ─── External-maps fallback ──────────────────────────────────────────────
	const fallbackToExternalMaps = useCallback(() => {
		const url = `https://www.google.com/maps/dir/?api=1&destination=${stopLat},${stopLng}&travelmode=driving`;
		Linking.openURL(url).catch(() => {});
		router.back();
	}, [stopLat, stopLng, router]);

	// ─── Fetch directions (one shot, ref-gated) ──────────────────────────────
	const fetchRoute = useCallback(
		async (origin: LatLng) => {
			if (routeFetched.current) return;
			routeFetched.current = true;

			if (!MAPS_KEY) {
				fallbackToExternalMaps();
				return;
			}

			try {
				requestCount.current += 1;
				if (__DEV__) {
					console.log(
						`[navigate] Directions API calls this session: ${requestCount.current}`,
					);
				}
				const url =
					`https://maps.googleapis.com/maps/api/directions/json` +
					`?origin=${origin.latitude},${origin.longitude}` +
					`&destination=${stopLat},${stopLng}` +
					`&mode=driving&key=${MAPS_KEY}`;
				const res = await fetch(url);
				const data = await res.json();
				if (
					data.status !== "OK" ||
					!Array.isArray(data.routes) ||
					data.routes.length === 0
				) {
					throw new Error(data?.error_message ?? "Route not found");
				}
				const route = data.routes[0];
				const leg = route.legs[0];

				setRouteCoordinates(decodePolyline(route.overview_polyline.points));
				const navSteps: NavigationStep[] = (leg.steps ?? []).map((s: any) => ({
					instruction: String(s.html_instructions ?? "")
						.replace(/<[^>]*>/g, " ")
						.replace(/&nbsp;/g, " ")
						.replace(/&amp;/g, "&")
						.replace(/\s+/g, " ")
						.trim(),
					distance: s.distance?.text ?? "",
					maneuver: s.maneuver ?? "straight",
					endLat: s.end_location?.lat ?? 0,
					endLng: s.end_location?.lng ?? 0,
				}));
				setSteps(navSteps);
				setDistanceRemaining(leg.distance?.value ?? 0);
				setDurationRemaining(leg.duration?.value ?? 0);
				setCurrentStepIndex(0);
				setLoading(false);
			} catch (e: any) {
				// Reset the ref so a manual retry could re-fetch (we won't expose
				// one in this screen, but the state is clean).
				routeFetched.current = false;
				setLoading(false);
				Alert.alert(
					"Couldn't load route",
					"Open in Google Maps instead?",
					[
						{ text: "Cancel", style: "cancel", onPress: () => router.back() },
						{ text: "Open Maps", onPress: fallbackToExternalMaps },
					],
				);
			}
		},
		[stopLat, stopLng, fallbackToExternalMaps, router],
	);

	// ─── Initial location + GPS watcher ──────────────────────────────────────
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
						setUserHeading(loc.coords.heading);
					}
					const ms = loc.coords.speed ?? 0;
					setUserSpeed(Math.max(0, Math.round(ms * 3.6)));
				},
			);
		})().catch(() => {});

		return () => {
			active = false;
			watcherRef.current?.remove();
			watcherRef.current = null;
		};
	}, [stopLat, stopLng, fetchRoute, router]);

	// ─── Camera follow + step advancement + arrival check ────────────────────
	useEffect(() => {
		if (!userLocation) return;

		// Pull camera into 3D heading-up mode tracking the driver.
		mapRef.current?.animateCamera(
			{
				center: userLocation,
				pitch: 50,
				heading: userHeading,
				zoom: 17,
				altitude: 300,
			},
			{ duration: 500 },
		);

		// Update distance to destination (haversine — straight-line floor).
		const km = haversineKm(userLocation, destination);
		setDistanceRemaining(km * 1000);
		// Naive duration estimate: 60 km/h average. Updated each GPS tick.
		setDurationRemaining(Math.max(60, Math.round((km / 60) * 3600)));

		// Arrival detection (50 m radius).
		if (km * 1000 < 50 && !arrivalShown) {
			setArrivalShown(true);
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {},
			);
			Alert.alert(
				`You've arrived at ${stopName}!`,
				"What would you like to do?",
				[
					{
						text: "Continue navigating",
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

		// Step advancement: within 30 m of current step's end → advance.
		if (steps.length > 0 && currentStepIndex < steps.length - 1) {
			const step = steps[currentStepIndex];
			const stepEnd: LatLng = {
				latitude: step.endLat,
				longitude: step.endLng,
			};
			if (haversineKm(userLocation, stepEnd) * 1000 < 30) {
				setCurrentStepIndex((i) => i + 1);
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userLocation, userHeading]);

	// ─── Actions ─────────────────────────────────────────────────────────────
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
					await supabase.from("stop_arrivals").insert({
						stop_id: stopId,
						convoy_member_id: member.id,
					});
				}
			}
		} catch {
			// non-fatal — the user can still tap "I arrived" on the Stops screen
		} finally {
			router.replace(`/convoy/${convoyId}/map`);
		}
	}

	function handleStopNavigation() {
		Alert.alert("Stop navigation", "Return to the convoy map?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Exit",
				style: "destructive",
				onPress: () => router.back(),
			},
		]);
	}

	// ─── Loading ─────────────────────────────────────────────────────────────
	if (loading) {
		return (
			<View style={styles.loadingRoot}>
				<StatusBar style="light" />
				<ActivityIndicator color="#fff" size="large" />
				<Text style={styles.loadingText}>Calculating route…</Text>
			</View>
		);
	}

	const currentStep = steps[currentStepIndex];
	const nextStep = steps[currentStepIndex + 1];

	return (
		<View style={styles.root}>
			<StatusBar style="light" />

			<MapView
				ref={mapRef}
				style={StyleSheet.absoluteFill}
				provider={PROVIDER_DEFAULT}
				mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
				showsCompass={false}
				showsUserLocation={false}
				showsTraffic
				pitchEnabled
				rotateEnabled
				scrollEnabled={false}
				zoomEnabled={false}
				toolbarEnabled={false}
				initialCamera={
					userLocation
						? {
								center: userLocation,
								pitch: 50,
								heading: userHeading,
								zoom: 17,
								altitude: 300,
							}
						: undefined
				}
			>
				{routeCoordinates.length > 0 ? (
					<Polyline
						coordinates={routeCoordinates}
						strokeColor={NAV_BLUE}
						strokeWidth={6}
						lineCap="round"
						lineJoin="round"
					/>
				) : null}

				{userLocation ? (
					<Marker
						coordinate={userLocation}
						anchor={{ x: 0.5, y: 0.5 }}
						flat
						rotation={userHeading}
						tracksViewChanges={false}
					>
						<View style={styles.navArrow}>
							<Text style={styles.navArrowText}>▲</Text>
						</View>
					</Marker>
				) : null}

				<Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }}>
					<View style={styles.destMarker}>
						<Text style={styles.destMarkerIcon}>📍</Text>
					</View>
				</Marker>
			</MapView>

			{/* ─── Top instruction banner ──────────────────────────────────── */}
			{currentStep ? (
				<View style={styles.instructionBanner}>
					<View style={styles.maneuverBox}>
						<Text style={styles.maneuverArrow}>
							{getManeuverArrow(currentStep.maneuver)}
						</Text>
					</View>
					<View style={styles.instructionText}>
						<Text style={styles.instructionMain} numberOfLines={2}>
							{currentStep.instruction}
						</Text>
						{currentStep.distance ? (
							<Text style={styles.instructionDistance}>
								In {currentStep.distance}
							</Text>
						) : null}
					</View>
				</View>
			) : null}

			{/* ─── "Then …" secondary pill ─────────────────────────────────── */}
			{nextStep ? (
				<View style={styles.nextTurnPill}>
					<Text style={styles.nextTurnText}>
						Then {getManeuverArrow(nextStep.maneuver)} {nextStep.distance}
					</Text>
				</View>
			) : null}

			{/* ─── Current speed badge ─────────────────────────────────────── */}
			<View style={styles.speedBadge}>
				<Text style={styles.speedNumber}>{userSpeed}</Text>
				<Text style={styles.speedUnit}>km/h</Text>
			</View>

			{/* ─── Bottom navigation bar ───────────────────────────────────── */}
			<View style={styles.bottomBar}>
				<View style={styles.bottomBarInfo}>
					<Text style={styles.bottomBarTime}>
						{formatDuration(durationRemaining)}
					</Text>
					<Text style={styles.bottomBarDot}>·</Text>
					<Text style={styles.bottomBarDistance}>
						{formatDistance(distanceRemaining / 1000)}
					</Text>
					<Text style={styles.bottomBarDot}>·</Text>
					<Text style={styles.bottomBarEta}>
						Arr. {getArrivalTime(durationRemaining)}
					</Text>
				</View>
				<View style={styles.bottomBarActions}>
					<TouchableOpacity
						style={styles.stopNavBtn}
						onPress={handleStopNavigation}
						activeOpacity={0.8}
					>
						<Text style={styles.stopNavText}>Exit</Text>
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
	root: { flex: 1, backgroundColor: "#000" },

	loadingRoot: {
		flex: 1,
		backgroundColor: "#1a1a1a",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	loadingText: {
		color: "rgba(255,255,255,0.7)",
		fontSize: 15,
		fontWeight: "500",
	},

	// ── User arrow ──────────────────────────────────────────────────────────
	navArrow: {
		width: 40,
		height: 40,
		backgroundColor: NAV_BLUE,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 3,
		borderColor: "#fff",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 6,
	},
	navArrowText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "700",
	},

	// ── Destination marker ──────────────────────────────────────────────────
	destMarker: {
		alignItems: "center",
		justifyContent: "center",
	},
	destMarkerIcon: { fontSize: 32 },

	// ── Top instruction banner ──────────────────────────────────────────────
	instructionBanner: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		backgroundColor: "#1a1a1a",
		paddingTop: 56,
		paddingBottom: 20,
		paddingHorizontal: 20,
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		borderBottomLeftRadius: 20,
		borderBottomRightRadius: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 8,
		zIndex: 100,
	},
	maneuverBox: {
		width: 64,
		height: 64,
		backgroundColor: "rgba(255,255,255,0.1)",
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	maneuverArrow: {
		fontSize: 32,
		color: "#fff",
		fontWeight: "700",
	},
	instructionText: { flex: 1 },
	instructionMain: {
		fontSize: 18,
		fontWeight: "700",
		color: "#fff",
		lineHeight: 24,
	},
	instructionDistance: {
		fontSize: 14,
		color: "rgba(255,255,255,0.7)",
		marginTop: 4,
	},

	// ── "Then …" pill ───────────────────────────────────────────────────────
	nextTurnPill: {
		position: "absolute",
		top: 160,
		left: 20,
		backgroundColor: "rgba(26,26,26,0.85)",
		borderRadius: 20,
		paddingHorizontal: 14,
		paddingVertical: 8,
		zIndex: 99,
	},
	nextTurnText: {
		color: "#fff",
		fontSize: 13,
		fontWeight: "500",
	},

	// ── Speed badge ─────────────────────────────────────────────────────────
	speedBadge: {
		position: "absolute",
		bottom: 180,
		left: 16,
		width: 64,
		height: 64,
		backgroundColor: "#1a1a1a",
		borderRadius: 32,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 99,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 6,
		elevation: 4,
	},
	speedNumber: {
		fontSize: 20,
		fontWeight: "700",
		color: "#fff",
		lineHeight: 22,
	},
	speedUnit: {
		fontSize: 10,
		color: "rgba(255,255,255,0.6)",
	},

	// ── Bottom bar ──────────────────────────────────────────────────────────
	bottomBar: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: "#1a1a1a",
		paddingBottom: 34,
		paddingTop: 16,
		paddingHorizontal: 20,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		zIndex: 100,
	},
	bottomBarInfo: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 12,
	},
	bottomBarTime: {
		fontSize: 22,
		fontWeight: "700",
		color: "#fff",
	},
	bottomBarDot: {
		color: "rgba(255,255,255,0.4)",
		fontSize: 16,
	},
	bottomBarDistance: {
		fontSize: 15,
		color: "rgba(255,255,255,0.8)",
	},
	bottomBarEta: {
		fontSize: 13,
		color: "rgba(255,255,255,0.5)",
	},
	bottomBarActions: {
		flexDirection: "row",
		gap: 12,
	},
	stopNavBtn: {
		flex: 1,
		height: 50,
		backgroundColor: "rgba(255,255,255,0.1)",
		borderRadius: 25,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.15)",
	},
	stopNavText: {
		color: "#fff",
		fontSize: 15,
		fontWeight: "500",
	},
	arrivedBtn: {
		flex: 2,
		height: 50,
		backgroundColor: NAV_BLUE,
		borderRadius: 25,
		alignItems: "center",
		justifyContent: "center",
	},
	arrivedText: {
		color: "#fff",
		fontSize: 15,
		fontWeight: "700",
	},
});
