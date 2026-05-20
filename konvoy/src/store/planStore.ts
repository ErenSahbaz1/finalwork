import { create } from "zustand";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface Place {
	name: string;
	lat: number;
	lng: number;
}

export interface AiSuggestion extends Place {
	reason: string;
}

export type PlannerStopType =
	| "fuel"
	| "food"
	| "rest"
	| "sightseeing"
	| "overnight"
	| "shopping";

export type SleepType = "car" | "hotel" | "both";

export interface PlannedStop {
	day: number;
	order: number;
	name: string;
	type: PlannerStopType;
	lat: number;
	lng: number;
	duration_min: number;
	notes: string;
	isOvernight: boolean;
	hotelName?: string;
	hotelStars?: number;
	estimatedCost?: number;
}

export interface GeneratedRoute {
	id: string;
	type: "fast" | "balanced" | "scenic";
	title: string;
	totalKm: number;
	estimatedDays: number;
	fuelCostEstimate: number; // EUR per car
	stops: PlannedStop[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface PlanStore {
	// Step 1
	origin: Place | null;
	destination: Place | null;

	// Step 2
	carCount: number;
	departureDate: Date | null;
	tripDays: number;

	// Step 3
	stopsPerDay: number;
	stopTypes: PlannerStopType[];

	// Step 4
	sleepType: SleepType;
	hotelBudget: number;
	hotelStars: number;

	// Step 5
	aiSuggestedPlaces: AiSuggestion[];
	selectedAiPlaces: AiSuggestion[];
	manualPlaces: Place[];

	// Results
	generatedRoutes: GeneratedRoute[] | null;
	selectedRoute: GeneratedRoute | null;

	// Actions
	setOrigin: (p: Place | null) => void;
	setDestination: (p: Place | null) => void;
	setCarCount: (n: number) => void;
	setDepartureDate: (d: Date | null) => void;
	setTripDays: (n: number) => void;
	setStopsPerDay: (n: number) => void;
	setStopTypes: (t: PlannerStopType[]) => void;
	toggleStopType: (t: PlannerStopType) => void;
	setSleepType: (t: SleepType) => void;
	setHotelBudget: (b: number) => void;
	setHotelStars: (s: number) => void;
	setAiSuggestedPlaces: (places: AiSuggestion[]) => void;
	toggleAiPlace: (p: AiSuggestion) => void;
	addManualPlace: (p: Place) => void;
	removeManualPlace: (name: string) => void;
	setGeneratedRoutes: (r: GeneratedRoute[] | null) => void;
	setSelectedRoute: (r: GeneratedRoute | null) => void;
	reset: () => void;
}

const initial = {
	origin: null,
	destination: null,
	carCount: 3,
	departureDate: null,
	tripDays: 4,
	stopsPerDay: 3,
	stopTypes: ["fuel"] as PlannerStopType[],
	sleepType: "both" as SleepType,
	hotelBudget: 100,
	hotelStars: 3,
	aiSuggestedPlaces: [],
	selectedAiPlaces: [],
	manualPlaces: [],
	generatedRoutes: null,
	selectedRoute: null,
};

export const usePlanStore = create<PlanStore>((set) => ({
	...initial,

	setOrigin: (p) => set({ origin: p }),
	setDestination: (p) => set({ destination: p }),
	setCarCount: (n) => set({ carCount: Math.max(1, Math.min(20, n)) }),
	setDepartureDate: (d) => set({ departureDate: d }),
	setTripDays: (n) => set({ tripDays: Math.max(1, Math.min(30, n)) }),
	setStopsPerDay: (n) => set({ stopsPerDay: Math.max(1, Math.min(8, n)) }),
	setStopTypes: (t) => set({ stopTypes: t }),
	toggleStopType: (t) =>
		set((s) => ({
			stopTypes: s.stopTypes.includes(t)
				? s.stopTypes.filter((x) => x !== t)
				: [...s.stopTypes, t],
		})),
	setSleepType: (t) => set({ sleepType: t }),
	setHotelBudget: (b) => set({ hotelBudget: b }),
	setHotelStars: (s) => set({ hotelStars: Math.max(1, Math.min(5, s)) }),
	setAiSuggestedPlaces: (places) => set({ aiSuggestedPlaces: places }),
	toggleAiPlace: (p) =>
		set((s) => {
			const exists = s.selectedAiPlaces.some((x) => x.name === p.name);
			return {
				selectedAiPlaces: exists
					? s.selectedAiPlaces.filter((x) => x.name !== p.name)
					: [...s.selectedAiPlaces, p],
			};
		}),
	addManualPlace: (p) =>
		set((s) => ({
			manualPlaces: s.manualPlaces.some((x) => x.name === p.name)
				? s.manualPlaces
				: [...s.manualPlaces, p],
		})),
	removeManualPlace: (name) =>
		set((s) => ({
			manualPlaces: s.manualPlaces.filter((x) => x.name !== name),
		})),
	setGeneratedRoutes: (r) => set({ generatedRoutes: r }),
	setSelectedRoute: (r) => set({ selectedRoute: r }),
	reset: () => set({ ...initial }),
}));
