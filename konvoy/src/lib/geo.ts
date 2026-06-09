// ─── Geographic helpers ───────────────────────────────────────────────────────
// Shared distance + route-ordering utilities used by the planner (to write a
// sensible order_index) and any screen that needs a quick straight-line
// fallback distance.
// ──────────────────────────────────────────────────────────────────────────────

export interface LatLngLike {
	lat: number;
	lng: number;
}

/** Great-circle distance in kilometres between two points. */
export function haversineKm(a: LatLngLike, b: LatLngLike): number {
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


export function orderStopsByProximity<T extends LatLngLike>(
	stops: T[],
	start?: LatLngLike,
): T[] {
	if (stops.length <= 2) return [...stops];

	const remaining = [...stops];
	const ordered: T[] = [];

	// Seed the chain.
	let current: LatLngLike;
	if (start) {
		current = start;
	} else {
		// No origin given — start from the first stop as-is.
		const first = remaining.shift();
		if (!first) return [];
		ordered.push(first);
		current = first;
	}

	while (remaining.length > 0) {
		let bestIdx = 0;
		let bestDist = Infinity;
		for (let i = 0; i < remaining.length; i++) {
			const d = haversineKm(current, remaining[i]);
			if (d < bestDist) {
				bestDist = d;
				bestIdx = i;
			}
		}
		const next = remaining.splice(bestIdx, 1)[0];
		ordered.push(next);
		current = next;
	}

	return ordered;
}
