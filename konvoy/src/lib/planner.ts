// ─── AI trip planner ──────────────────────────────────────────────────────────
// Wraps Gemini calls for the trip-planning wizard.
//
//   • getAiSuggestions  → Step 5: 6 must-see places along the route
//   • generateRoutes    → Results: 3 complete day-by-day routes
//
// Both functions throw on failure; callers surface the message to the user.
// ──────────────────────────────────────────────────────────────────────────────

import { askGemini, parseGeminiJson } from "./gemini";
import { haversineKm } from "./geo";
import { APPROX_PREFIX, findPlaceNear } from "./places";
import type {
	AiSuggestion,
	GeneratedRoute,
	PlannedStop,
	PlannerStopType,
	Place,
	SleepType,
} from "../store/planStore";

// ─── Step 5: must-see places ──────────────────────────────────────────────────

export async function getAiSuggestions(args: {
	origin: Place;
	destination: Place;
	tripDays: number;
	carCount: number;
	stopTypes: PlannerStopType[];
}): Promise<AiSuggestion[]> {
	const { origin, destination, tripDays, carCount, stopTypes } = args;
	const prompt = `The user is planning a road trip from ${origin.name} to ${destination.name} over ${tripDays} days with ${carCount} cars. They want ${stopTypes.join(", ")} stops.
Suggest 6 interesting must-see places, landmarks, or experiences along the way between these two cities.

CRITICAL: Each "name" must be a SPECIFIC real place that can be found on Google Maps — a named museum, monument, viewpoint, restaurant, beach, park, etc. Do NOT use city names alone (e.g. "Tours" or "Amsterdam"). Use the full proper name as it appears on Google Maps (e.g. "Rijksmuseum, Amsterdam" or "Cathédrale Saint-Gatien de Tours"). Include the city in the name so it's unambiguous.

For each place provide: name (specific establishment), reason (one short sentence), approximate lat/lng coordinates.

Respond in JSON only, as an object with a "places" array:
{"places": [{"name": "...", "reason": "...", "lat": 0, "lng": 0}]}`;

	const raw = await askGemini(prompt, { json: true });
	const parsed = parseGeminiJson<unknown>(raw);

	// Strict JSON mode forces the model to return an object (not a bare array),
	// so the prompt wraps the list in `{"places": [...]}`. Be permissive about
	// the wrapper key — accept any common synonym, and also accept a raw array
	// in case the model ignores the wrapper.
	const list: unknown[] = Array.isArray(parsed)
		? parsed
		: Array.isArray((parsed as any)?.places)
			? (parsed as any).places
			: Array.isArray((parsed as any)?.suggestions)
				? (parsed as any).suggestions
				: Array.isArray((parsed as any)?.results)
					? (parsed as any).results
					: [];

	if (list.length === 0) {
		throw new Error("AI returned no suggestions. Try again.");
	}

	const rough = list
		.map((row: any) => ({
			name: String(row?.name ?? "").trim(),
			reason: String(row?.reason ?? "").trim(),
			lat: Number(row?.lat) || 0,
			lng: Number(row?.lng) || 0,
		}))
		.filter((p) => p.name && (p.lat !== 0 || p.lng !== 0));

	// Resolve each suggestion to real Google Places coordinates, biased to
	// the AI's rough position. Failures fall back to the AI's value silently
	// — the must-see list isn't shown to convoy members directly, so a small
	// drift here is acceptable.
	const enriched = await Promise.all(
		rough.map(async (p) => {
			// Must-see items are always sightseeing-ish — bias accordingly.
			const hit = await findPlaceNear(
				p.name,
				{ lat: p.lat, lng: p.lng },
				"sightseeing",
			);
			return hit && hit.isEstablishment
				? { ...p, lat: hit.lat, lng: hit.lng }
				: p;
		}),
	);

	return enriched;
}

// ─── Results: 3 day-by-day routes ─────────────────────────────────────────────

export async function generateRoutes(args: {
	origin: Place;
	destination: Place;
	carCount: number;
	tripDays: number;
	departureDate: Date | null;
	stopsPerDay: number;
	stopTypes: PlannerStopType[];
	sleepType: SleepType;
	hotelBudget: number;
	hotelStars: number;
	mustSeePlaces: Place[];
}): Promise<GeneratedRoute[]> {
	const {
		origin,
		destination,
		carCount,
		tripDays,
		departureDate,
		stopsPerDay,
		stopTypes,
		sleepType,
		hotelBudget,
		hotelStars,
		mustSeePlaces,
	} = args;

	const departure = departureDate
		? departureDate.toISOString().slice(0, 10)
		: "not specified";

	const overnight =
		sleepType === "car"
			? "sleep in car"
			: `${sleepType} (hotel budget: ${hotelBudget}EUR/night, ${hotelStars} stars)`;

	const mustSee =
		mustSeePlaces.length > 0
			? mustSeePlaces.map((p) => p.name).join(", ")
			: "none specified";

	const prompt = `You are a convoy trip planner. Generate exactly 3 route options for a group road trip with the following details:

FROM: ${origin.name}
TO: ${destination.name}
CARS: ${carCount}
DAYS: ${tripDays}
DEPARTURE: ${departure}
STOPS PER DAY: ${stopsPerDay}
STOP TYPES WANTED: ${stopTypes.join(", ")}
OVERNIGHT: ${overnight}
MUST-SEE PLACES: ${mustSee}

FUEL PRICES ON LIKELY ROUTE (EUR/L petrol95):
Belgium: 1.72, Germany: 1.81, Austria: 1.65,
Hungary: 1.42, Romania: 1.38, Bulgaria: 1.29, Turkey: 1.18

Generate 3 routes:
1. FAST - highway focused, minimal stops, fastest travel time
2. BALANCED - mix of efficiency and comfort, good stop variety
3. SCENIC - more stops, interesting places, relaxed pace

For each route provide a complete day-by-day stop plan.

ROUTE PACING & GEOGRAPHY (very important — make the trip physically realistic):
1. FOLLOW THE REAL CORRIDOR. Stops must progress smoothly along the actual driving route from ${origin.name} to ${destination.name}, passing through the major cities/countries that genuinely lie between them. Do NOT skip a whole country that the route drives through. For a ${origin.name}→${destination.name} trip, include stops in the real intermediate hubs along the way (e.g. for Western Europe→Türkiye that means stopping around Austria/Vienna and Hungary/Budapest, not jumping straight from Germany to Serbia).
2. CAP EACH LEG. No two consecutive stops may be more than ~500 km apart. If a stretch between cities is longer than that, INSERT an intermediate stop (a city, rest area, or overnight) so the driving is broken up. Never produce a single day with one giant 800+ km leg and no stops in between.
3. END EACH DAY WITH AN OVERNIGHT. Every day EXCEPT the final arrival day must end with exactly one overnight stop (type "overnight", isOvernight true) in a real city that sits at a sensible point along the route, splitting the total drive into roughly equal daily distances (aim for similar progress each day rather than one huge day and one short day). ${
		sleepType === "car"
			? 'Since the group sleeps in the car, name a real motorway service area or rest area as the overnight spot (hotelName empty).'
			: 'Name a real hotel for each overnight (set hotelName and hotelStars).'
	} A day must NOT end on a fast-food restaurant or a random fuel station — it ends where the group sleeps. Overnight stops are REQUIRED and do NOT count toward the STOPS PER DAY number.
4. SPREAD FUEL EVENLY. Distribute fuel stops across the WHOLE route (including the later/eastern legs), not clustered near the start. Cheap-fuel border crossings are a good place to refuel.

CRITICAL RULE FOR STOP NAMES:
Each "name" must be a SPECIFIC real establishment that exists on Google Maps AND that genuinely lies on or near THIS route (${origin.name} → ${destination.name}). NEVER use a bare city name — always include the establishment type and the city. Follow this FORMAT per type (the <…> are placeholders, NOT text to output):
  • Fuel → "<fuel chain> <road or area>, <city>"   — a real station actually on this leg's motorway
  • Food → "<restaurant name>, <city>"             — a real restaurant
  • Rest → "<service area / aire name> <motorway>" — a real rest area on the CORRECT motorway for this leg
  • Sightseeing → "<landmark name>, <city>"        — a real attraction
  • Overnight → "<hotel name>, <city>"             — a real hotel
  • Shopping → "<mall or market name>, <city>"     — a real mall

DO NOT copy these placeholders or any example names literally — choose real places that fit the actual cities and roads of THIS route. The 3 routes must use genuinely DIFFERENT places from each other: do not reuse the same handful of landmarks, hotels, or stations across all 3 — vary them so each route feels distinct.

FUEL STOP DISCIPLINE (very important — do not over-add fuel stops):
A full tank lasts roughly 600 km. Add a fuel stop ONLY about once every 500-600 km of actual driving — NOT once per city and NOT more than once per day unless that day's driving exceeds ~600 km. Most cities should have ZERO fuel stops. A typical ${tripDays}-day international route needs only 2-4 fuel stops TOTAL. Never place two fuel stops within 400 km of each other. When you do add fuel, prefer putting it on a long highway leg between cities rather than inside a city already full of sightseeing/food/hotel stops.

Each stop needs: name (specific establishment per the rule above), type (one of: fuel, food, rest, sightseeing, overnight, shopping), lat, lng, duration_min, notes, isOvernight (boolean), hotelName (if overnight hotel), hotelStars (1-5 if hotel), estimatedCost (EUR, optional).

Also provide: totalKm, fuelCostEstimate (per car, based on 7L/100km average and the fuel prices above).

Respond in JSON only, no other text:
{
  "routes": [
    {
      "type": "fast",
      "title": "Express Route",
      "totalKm": 2100,
      "estimatedDays": ${tripDays},
      "fuelCostEstimate": 145,
      "stops": [
        {
          "day": 1,
          "order": 1,
          "name": "Stop name",
          "type": "food",
          "lat": 48.85,
          "lng": 2.35,
          "duration_min": 45,
          "notes": "Brief description",
          "isOvernight": false
        },
        {
          "day": 1,
          "order": 2,
          "name": "Hotel name, City",
          "type": "overnight",
          "lat": 48.2,
          "lng": 16.37,
          "duration_min": 600,
          "notes": "Overnight — end of day 1",
          "isOvernight": true,
          "hotelName": "Hotel name",
          "hotelStars": 4
        }
      ]
    }
  ]
}`;

	// Route generation can produce long JSON — bump tokens above the default.
	const raw = await askGemini(prompt, { json: true, maxOutputTokens: 16384 });
	const parsed = parseGeminiJson<{ routes?: any[] }>(raw);

	if (!parsed?.routes || !Array.isArray(parsed.routes)) {
		throw new Error("AI returned an unexpected shape for routes.");
	}

	const routes: GeneratedRoute[] = parsed.routes.map((r: any, idx: number) => ({
		id: `route-${idx}-${Date.now()}`,
		type: (r.type ?? "balanced") as GeneratedRoute["type"],
		title: String(r.title ?? "Route"),
		totalKm: Number(r.totalKm) || 0,
		estimatedDays: Number(r.estimatedDays) || tripDays,
		fuelCostEstimate: Number(r.fuelCostEstimate) || 0,
		stops: Array.isArray(r.stops) ? r.stops.map(normalizeStop) : [],
	}));

	// Safety net: the LLM still tends to over-add fuel stops (one per city). Thin
	// them down so consecutive fuel stops are realistically far apart, regardless
	// of what the model produced.
	for (const route of routes) {
		route.stops = thinFuelStops(route.stops);
	}

	// ── Geocode every AI-generated stop in parallel ──────────────────────────
	// Gemini's lat/lng are guesses — accurate to within a city, but rarely on
	// any actual establishment. We replace them with real Places coordinates
	// before the route is shown to the user. When a stop can't be resolved we
	// keep the AI's coordinates and prepend `[~] ` to its notes, which the
	// Stops UI uses to render an "approximate location" warning badge.
	// Wall-clock cap on the whole geocoding phase so a flaky Places network
	// can't strand the user on the "ConvoyAI is planning…" screen forever.
	// Anything still in flight when this fires is dropped — the stops keep
	// the AI's coordinates and get flagged approximate.
	const HARD_CAP_MS = 15_000;
	const enrichOne = async (stop: PlannedStop) => {
		const hasBias =
			Number.isFinite(stop.lat) &&
			Number.isFinite(stop.lng) &&
			!(stop.lat === 0 && stop.lng === 0);
		const bias = hasBias ? { lat: stop.lat, lng: stop.lng } : undefined;
		try {
			// Pass the stop's type as a category hint so "Amsterdam" + "overnight"
			// becomes a hotel search instead of a city-centre pin.
			const hit = await findPlaceNear(stop.name, bias, stop.type);
			if (hit && hit.isEstablishment) {
				stop.lat = hit.lat;
				stop.lng = hit.lng;
				return;
			}
			if (hit) {
				stop.lat = hit.lat;
				stop.lng = hit.lng;
			}
		} catch {
			// fall through to approximate-flag path
		}
		const existing = stop.notes ?? "";
		stop.notes = existing.startsWith(APPROX_PREFIX)
			? existing
			: `${APPROX_PREFIX}${existing || "AI-placed (approximate location)"}`;
	};

	await Promise.race([
		Promise.all(
			routes.flatMap((route) => route.stops.map((s) => enrichOne(s))),
		),
		new Promise((resolve) => setTimeout(resolve, HARD_CAP_MS)),
	]);

	return routes;
}

// Remove over-frequent fuel stops. Walking the route in (day, order) sequence
// we keep a fuel stop only when at least MIN_FUEL_GAP_KM of (straight-line)
// distance has accumulated since the last kept fuel stop. Haversine
// under-estimates road distance by ~20-30%, so a 350 km straight-line gap maps
// to roughly ~450 km of real driving — about one refuel per tank. Non-fuel
// stops are always kept and still count toward the running distance.
function thinFuelStops(stops: PlannedStop[]): PlannedStop[] {
	const MIN_FUEL_GAP_KM = 350;

	// Work on the intended travel sequence.
	const sequence = [...stops].sort((a, b) => {
		if (a.day !== b.day) return a.day - b.day;
		return (a.order ?? 0) - (b.order ?? 0);
	});

	const kept: PlannedStop[] = [];
	let cumKm = 0;
	let lastFuelKm = Number.NEGATIVE_INFINITY; // first fuel stop is always kept
	let prev: PlannedStop | null = null;

	for (const stop of sequence) {
		if (prev) {
			cumKm += haversineKm(
				{ lat: prev.lat, lng: prev.lng },
				{ lat: stop.lat, lng: stop.lng },
			);
		}
		prev = stop;

		if (stop.type === "fuel") {
			if (cumKm - lastFuelKm < MIN_FUEL_GAP_KM) {
				// Too soon since the last fuel stop — drop this one.
				continue;
			}
			lastFuelKm = cumKm;
		}
		kept.push(stop);
	}

	return kept;
}

function normalizeStop(s: any): PlannedStop {
	return {
		day: Number(s?.day) || 1,
		order: Number(s?.order) || 0,
		name: String(s?.name ?? "Stop"),
		type: (validStopType(s?.type) ?? "rest") as PlannerStopType,
		lat: Number(s?.lat) || 0,
		lng: Number(s?.lng) || 0,
		duration_min: Number(s?.duration_min) || 30,
		notes: String(s?.notes ?? ""),
		isOvernight: Boolean(s?.isOvernight),
		hotelName: s?.hotelName ? String(s.hotelName) : undefined,
		hotelStars: s?.hotelStars ? Number(s.hotelStars) : undefined,
		estimatedCost:
			s?.estimatedCost != null ? Number(s.estimatedCost) : undefined,
	};
}

function validStopType(t: unknown): PlannerStopType | null {
	const allowed: PlannerStopType[] = [
		"fuel",
		"food",
		"rest",
		"sightseeing",
		"overnight",
		"shopping",
	];
	return allowed.includes(t as PlannerStopType) ? (t as PlannerStopType) : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateInviteCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return Array.from({ length: 6 }, () =>
		chars.charAt(Math.floor(Math.random() * chars.length)),
	).join("");
}
