// ─── Driving distances via Google Directions ──────────────────────────────────
// Given an ordered list of stop coordinates, returns the real road distance of
// each leg (stop[i] → stop[i+1]) plus the total, using a single Directions API
// request (origin = first stop, destination = last stop, everything in between
// as waypoints in order).
//
// Cost control:
//   • Exactly ONE Directions request per distinct ordered coordinate set.
//   • The result is cached in AsyncStorage keyed by a hash of the rounded
//     coordinates, so revisiting the overview screen never re-calls the API.
//     Adding / removing / reordering a stop changes the hash → recompute.
//   • Falls back to `null` (caller uses haversine) when no key is set, the
//     route is too long for a single request, or the network/API fails.
// ──────────────────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LatLngLike } from "./geo";

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

// Standard Directions API allows origin + destination + 23 intermediate
// waypoints (25 points total) without the premium plan.
const MAX_POINTS = 25;

export interface DrivingLegs {
	/** Road distance of each leg in km — length === points.length - 1. */
	legKm: number[];
	/** Sum of all legs in km. */
	totalKm: number;
}

let requestCount = 0;

function roundCoord(n: number): number {
	// ~11 m precision — enough to detect a changed stop, stable across reloads.
	return Math.round(n * 1e4) / 1e4;
}

function cacheKey(points: LatLngLike[]): string {
	const sig = points
		.map((p) => `${roundCoord(p.lat)},${roundCoord(p.lng)}`)
		.join("|");
	// Tiny djb2 hash so the AsyncStorage key stays short.
	let h = 5381;
	for (let i = 0; i < sig.length; i++) {
		h = (h * 33) ^ sig.charCodeAt(i);
	}
	return `convoi_legs_${(h >>> 0).toString(36)}`;
}

export async function fetchDrivingLegs(
	points: LatLngLike[],
): Promise<DrivingLegs | null> {
	if (!MAPS_KEY) return null;
	if (points.length < 2) return null;
	if (points.length > MAX_POINTS) return null; // too many for one request

	const key = cacheKey(points);

	// 1. Cache hit?
	try {
		const cached = await AsyncStorage.getItem(key);
		if (cached) {
			const parsed = JSON.parse(cached) as DrivingLegs;
			if (
				Array.isArray(parsed.legKm) &&
				parsed.legKm.length === points.length - 1
			) {
				return parsed;
			}
		}
	} catch {
		// ignore cache read errors — fall through to network
	}

	// 2. Network fetch.
	try {
		requestCount += 1;
		if (__DEV__) {
			console.log(
				`[directions] Directions API calls this session: ${requestCount}`,
			);
		}

		const origin = points[0];
		const destination = points[points.length - 1];
		const waypoints = points.slice(1, -1);
		const waypointsParam =
			waypoints.length > 0
				? `&waypoints=${waypoints
						.map((p) => `${p.lat},${p.lng}`)
						.join("|")}`
				: "";

		const url =
			`https://maps.googleapis.com/maps/api/directions/json` +
			`?origin=${origin.lat},${origin.lng}` +
			`&destination=${destination.lat},${destination.lng}` +
			`${waypointsParam}` +
			`&mode=driving&key=${MAPS_KEY}`;

		const res = await fetch(url);
		const data = await res.json();
		if (
			data.status !== "OK" ||
			!Array.isArray(data.routes) ||
			data.routes.length === 0
		) {
			return null;
		}

		const legs = data.routes[0].legs;
		if (!Array.isArray(legs) || legs.length !== points.length - 1) {
			return null;
		}

		const legKm = legs.map(
			(l: any) => (l?.distance?.value ?? 0) / 1000,
		);
		const totalKm = legKm.reduce((a: number, b: number) => a + b, 0);
		const result: DrivingLegs = { legKm, totalKm };

		// 3. Persist for next time (fire-and-forget).
		AsyncStorage.setItem(key, JSON.stringify(result)).catch(() => {});

		return result;
	} catch {
		return null;
	}
}
