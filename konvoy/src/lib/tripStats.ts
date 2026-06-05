import { supabase } from "./supabase";

export interface TripStats {
  totalDistanceKm: number;
  totalDurationMin: number;
  stopsCompleted: number;
  stopsTotal: number;
  crewCount: number;
  fuelSavedEstimate: number;
  convoyTitle: string;
  startedAt: string | null;
  endedAt: string | null;
}

function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function computeTripStats(convoyId: string): Promise<TripStats> {
  const [
    { data: convoy },
    { data: stops },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("convoys")
      .select("title, starts_at, ended_at, status")
      .eq("id", convoyId)
      .single(),
    supabase
      .from("stops")
      .select("*")
      .eq("convoy_id", convoyId)
      .order("order_index", { ascending: true }),
    supabase
      .from("convoy_members")
      .select("id")
      .eq("convoy_id", convoyId),
  ]);

  let totalDistanceKm = 0;
  if (stops && stops.length > 1) {
    for (let i = 0; i < stops.length - 1; i++) {
      totalDistanceKm += haversine(
        stops[i].lat,
        stops[i].lng,
        stops[i + 1].lat,
        stops[i + 1].lng,
      );
    }
  }

  const stopsCompleted = stops?.filter((s) => s.status === "passed").length ?? 0;
  const stopsTotal = stops?.length ?? 0;

  const stopDurationMin =
    stops
      ?.filter((s) => s.status === "passed")
      .reduce((sum, s) => sum + (s.duration_min ?? 0), 0) ?? 0;

  const drivingTimeMin = Math.round((totalDistanceKm / 90) * 60);
  const totalDurationMin = drivingTimeMin + stopDurationMin;

  // Belgium avg €1.72/L vs Hungary avg €1.42/L, 7L/100km consumption
  const fuelUsed = (totalDistanceKm / 100) * 7;
  const fuelSavedEstimate = Math.round(fuelUsed * (1.72 - 1.42));

  return {
    totalDistanceKm: Math.round(totalDistanceKm),
    totalDurationMin,
    stopsCompleted,
    stopsTotal,
    crewCount: members?.length ?? 0,
    fuelSavedEstimate,
    convoyTitle: convoy?.title ?? "Convoy",
    startedAt: convoy?.starts_at ?? null,
    endedAt: convoy?.ended_at ?? null,
  };
}
