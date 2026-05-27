// ─── Google Places — server-side geocoding helper ─────────────────────────────
// The AI planner produces stop names like "Petrol Ofisi near Edirne" with
// approximate lat/lng values that are usually 1–20 km off from any real
// establishment. Before we insert those stops into Supabase we run each one
// through Google Places' "Find Place from Text" endpoint, biased to the AI's
// approximate location, and replace the coordinates with the real ones.
//
// API: https://developers.google.com/maps/documentation/places/web-service/search-find-place
//   • Requires the legacy "Places API" enabled in Google Cloud Console
//     (the same one used by react-native-google-places-autocomplete).
//   • Uses EXPO_PUBLIC_GOOGLE_PLACES_KEY from .env.
//   • Free tier comfortably covers thesis-scale usage (one route generation
//     fires ~30 lookups).
// ──────────────────────────────────────────────────────────────────────────────

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? "";

// Stop-type → search keyword that nudges Places toward a real establishment
// rather than a city centroid. "Amsterdam" alone returns the city; "Amsterdam
// hotel" returns a real hotel. Same idea for fuel, food, etc.
export type StopCategory =
	| "fuel"
	| "food"
	| "rest"
	| "sightseeing"
	| "overnight"
	| "shopping";

const CATEGORY_KEYWORDS: Record<StopCategory, string> = {
	fuel: "gas station",
	food: "restaurant",
	rest: "rest area",
	sightseeing: "landmark",
	overnight: "hotel",
	shopping: "shopping center",
};

// Place result types that indicate a real-world establishment rather than a
// vague city / region / country pin. Anything that lacks one of these is
// considered city-level and we flag the stop as approximate.
const ESTABLISHMENT_TYPES = new Set([
	"establishment",
	"point_of_interest",
	"lodging",
	"restaurant",
	"food",
	"gas_station",
	"tourist_attraction",
	"museum",
	"church",
	"park",
	"shopping_mall",
	"store",
	"cafe",
	"bar",
	"night_club",
	"parking",
]);

export interface GeocodedPlace {
	name: string;
	lat: number;
	lng: number;
	formatted_address?: string;
	place_id?: string;
	/** True when the Places result is a real establishment (not just a city). */
	isEstablishment: boolean;
	types: string[];
}

/**
 * Resolve a free-text place name to a real-world coordinate.
 *
 * @param query     The stop's display name (e.g. "Petrol Ofisi, Edirne").
 * @param bias      Optional lat/lng to bias the search (the AI's guess).
 * @param category  Optional stop type — appended to the query as a keyword
 *                  ("hotel", "gas station", …) so city names resolve to
 *                  actual establishments instead of city centroids.
 * @returns         The Places match, or `null` if no key / no candidates / error.
 */
export async function findPlaceNear(
	query: string,
	bias?: { lat: number; lng: number },
	category?: StopCategory,
): Promise<GeocodedPlace | null> {
	if (!PLACES_KEY) return null;
	if (!query.trim()) return null;

	// Tack the category keyword onto the query unless the AI already used it.
	const keyword = category ? CATEGORY_KEYWORDS[category] : "";
	const enrichedQuery =
		keyword && !query.toLowerCase().includes(keyword.split(" ")[0])
			? `${query} ${keyword}`
			: query;

	const params = new URLSearchParams({
		input: enrichedQuery,
		inputtype: "textquery",
		fields: "name,geometry,formatted_address,place_id,types",
		key: PLACES_KEY,
	});
	if (
		bias &&
		Number.isFinite(bias.lat) &&
		Number.isFinite(bias.lng) &&
		!(bias.lat === 0 && bias.lng === 0)
	) {
		// Bias the search to within ~20 km of the AI's guess. This is what stops
		// "Petrol Ofisi" from matching a station 800 km away.
		params.set("locationbias", `circle:20000@${bias.lat},${bias.lng}`);
	}

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 6000);
		const res = await fetch(
			`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params.toString()}`,
			{ signal: controller.signal },
		);
		clearTimeout(timer);
		if (!res.ok) return null;
		const json = await res.json();
		if (json?.status !== "OK" || !Array.isArray(json.candidates)) {
			return null;
		}
		const c = json.candidates[0];
		const lat = c?.geometry?.location?.lat;
		const lng = c?.geometry?.location?.lng;
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
		const types: string[] = Array.isArray(c?.types) ? c.types : [];
		const isEstablishment = types.some((t) => ESTABLISHMENT_TYPES.has(t));
		return {
			name: c.name ?? query,
			lat,
			lng,
			formatted_address: c.formatted_address,
			place_id: c.place_id,
			isEstablishment,
			types,
		};
	} catch {
		// Network failure / abort / non-JSON response — treat as "no result".
		return null;
	}
}

/**
 * Marker prepended to a stop's `notes` when we couldn't geocode it and had to
 * keep the AI's approximate coordinates. The Stops UI checks for this prefix
 * to render the "approximate location" badge and the more prominent warning
 * in the detail sheet.
 */
export const APPROX_PREFIX = "[~] ";

export function isApproximate(notes: string | null | undefined): boolean {
	return typeof notes === "string" && notes.startsWith(APPROX_PREFIX);
}

export function stripApprox(notes: string | null | undefined): string {
	if (!notes) return "";
	return notes.startsWith(APPROX_PREFIX) ? notes.slice(APPROX_PREFIX.length) : notes;
}
