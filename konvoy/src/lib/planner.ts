// ─── AI trip planner ──────────────────────────────────────────────────────────
// Wraps Gemini calls for the trip-planning wizard.
//
//   • getAiSuggestions  → Step 5: 6 must-see places along the route
//   • generateRoutes    → Results: 3 complete day-by-day routes
//
// Both functions throw on failure; callers surface the message to the user.
// ──────────────────────────────────────────────────────────────────────────────

import { askGemini, parseGeminiJson } from "./gemini";
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
For each place provide: name, brief reason (1 sentence), approximate lat/lng coordinates.
Respond in JSON only:
[{"name": "...", "reason": "...", "lat": 0, "lng": 0}]`;

	const raw = await askGemini(prompt, { json: true });
	const parsed = parseGeminiJson<unknown>(raw);

	if (!Array.isArray(parsed)) {
		throw new Error("Gemini returned an unexpected shape for suggestions.");
	}

	return parsed
		.map((row: any) => ({
			name: String(row?.name ?? "").trim(),
			reason: String(row?.reason ?? "").trim(),
			lat: Number(row?.lat) || 0,
			lng: Number(row?.lng) || 0,
		}))
		.filter((p) => p.name && (p.lat !== 0 || p.lng !== 0));
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
Each stop needs: name, type (one of: fuel, food, rest, sightseeing, overnight, shopping), lat, lng, duration_min, notes, isOvernight (boolean), hotelName (if overnight hotel), hotelStars (1-5 if hotel), estimatedCost (EUR, optional).

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
        }
      ]
    }
  ]
}`;

	// Route generation can produce long JSON — bump tokens above the default.
	const raw = await askGemini(prompt, { json: true, maxOutputTokens: 16384 });
	const parsed = parseGeminiJson<{ routes?: any[] }>(raw);

	if (!parsed?.routes || !Array.isArray(parsed.routes)) {
		throw new Error("Gemini returned an unexpected shape for routes.");
	}

	return parsed.routes.map((r: any, idx: number) => ({
		id: `route-${idx}-${Date.now()}`,
		type: (r.type ?? "balanced") as GeneratedRoute["type"],
		title: String(r.title ?? "Route"),
		totalKm: Number(r.totalKm) || 0,
		estimatedDays: Number(r.estimatedDays) || tripDays,
		fuelCostEstimate: Number(r.fuelCostEstimate) || 0,
		stops: Array.isArray(r.stops) ? r.stops.map(normalizeStop) : [],
	}));
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
