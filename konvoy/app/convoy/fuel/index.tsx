// ─── Fuel price overlay ───────────────────────────────────────────────────────
// Cross-country fuel price comparison and smart recommendation. This is the
// thesis differentiator: surface where on the convoy's route fuel is cheapest
// and quantify the savings for the driver's specific vehicle.
//
// Data sources (all free, no key required for the demo):
//   • EU Weekly Oil Bulletin (country-level prices)
//   • Tankerkönig (German stations, demo key)
//   • France data.economie.gouv.fr (French stations)
// All API calls degrade silently to FALLBACK_PRICES on failure.
// ──────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Modal,
	TextInput,
	RefreshControl,
	Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "../../../src/components/Button";
import { FadeInView } from "../../../src/components/FadeInView";
import { NeumorphicView } from "../../../src/components/NeumorphicView";
import { SoftBackground } from "../../../src/components/SoftBackground";
import { StaggeredFadeIn } from "../../../src/components/StaggeredFadeIn";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Spacing,
} from "../../../src/constants/theme";
import { supabase } from "../../../src/lib/supabase";
import { useUserStore } from "../../../src/store/userStore";
import type { FuelType, Stop } from "../../../src/types";

// ─── Constants ────────────────────────────────────────────────────────────────

type CountryCode =
	| "BE"
	| "DE"
	| "FR"
	| "NL"
	| "AT"
	| "HU"
	| "RO"
	| "BG"
	| "TR"
	| "HR"
	| "SI"
	| "RS";

interface CountryPrice {
	petrol95: number;
	petrol98?: number;
	diesel: number;
	lpg?: number;
	currency: "EUR";
}

const FALLBACK_PRICES: Record<CountryCode, CountryPrice> = {
	BE: { petrol95: 1.72, petrol98: 1.81, diesel: 1.58, lpg: 0.92, currency: "EUR" },
	DE: { petrol95: 1.81, petrol98: 1.92, diesel: 1.72, lpg: 0.95, currency: "EUR" },
	FR: { petrol95: 1.75, petrol98: 1.84, diesel: 1.63, lpg: 0.99, currency: "EUR" },
	NL: { petrol95: 2.05, petrol98: 2.17, diesel: 1.68, lpg: 0.89, currency: "EUR" },
	AT: { petrol95: 1.65, petrol98: 1.78, diesel: 1.55, lpg: 0.87, currency: "EUR" },
	HU: { petrol95: 1.42, petrol98: 1.55, diesel: 1.38, lpg: 0.78, currency: "EUR" },
	RO: { petrol95: 1.38, petrol98: 1.48, diesel: 1.31, lpg: 0.72, currency: "EUR" },
	BG: { petrol95: 1.29, petrol98: 1.41, diesel: 1.22, lpg: 0.69, currency: "EUR" },
	TR: { petrol95: 1.18, petrol98: 1.28, diesel: 1.09, lpg: 0.64, currency: "EUR" },
	HR: { petrol95: 1.48, petrol98: 1.58, diesel: 1.35, lpg: 0.74, currency: "EUR" },
	SI: { petrol95: 1.55, petrol98: 1.65, diesel: 1.42, lpg: 0.81, currency: "EUR" },
	RS: { petrol95: 1.35, petrol98: 1.45, diesel: 1.28, lpg: 0.71, currency: "EUR" },
};

const COUNTRY_CENTERS: Record<
	CountryCode,
	{ lat: number; lng: number; flag: string; name: string }
> = {
	BE: { lat: 50.85, lng: 4.35, flag: "🇧🇪", name: "Belgium" },
	DE: { lat: 51.16, lng: 10.45, flag: "🇩🇪", name: "Germany" },
	FR: { lat: 46.23, lng: 2.21, flag: "🇫🇷", name: "France" },
	NL: { lat: 52.13, lng: 5.29, flag: "🇳🇱", name: "Netherlands" },
	AT: { lat: 47.52, lng: 14.55, flag: "🇦🇹", name: "Austria" },
	HU: { lat: 47.16, lng: 19.5, flag: "🇭🇺", name: "Hungary" },
	RO: { lat: 45.94, lng: 24.97, flag: "🇷🇴", name: "Romania" },
	BG: { lat: 42.73, lng: 25.49, flag: "🇧🇬", name: "Bulgaria" },
	TR: { lat: 38.96, lng: 35.24, flag: "🇹🇷", name: "Turkey" },
	HR: { lat: 45.1, lng: 15.2, flag: "🇭🇷", name: "Croatia" },
	SI: { lat: 46.15, lng: 14.99, flag: "🇸🇮", name: "Slovenia" },
	RS: { lat: 44.02, lng: 21.01, flag: "🇷🇸", name: "Serbia" },
};

// Typical Konvoy thesis route — BE → TR overland
const DEFAULT_ROUTE: CountryCode[] = ["BE", "DE", "AT", "HU", "RO", "BG", "TR"];

// Rough country->km distances along the default route (BE start)
const ROUTE_KM: Record<CountryCode, number> = {
	BE: 0,
	DE: 320,
	AT: 870,
	HU: 1180,
	RO: 1640,
	BG: 2010,
	TR: 2380,
	// Off-route countries (still listed but no route km)
	FR: -1,
	NL: -1,
	HR: -1,
	SI: -1,
	RS: -1,
};

const FUEL_LABEL: Record<FuelType, string> = {
	petrol_95: "95",
	petrol_98: "98",
	diesel: "Diesel",
	lpg: "LPG",
	electric: "Electric",
};

const FUEL_TABS: FuelType[] = ["petrol_95", "petrol_98", "diesel", "lpg"];

// User-home country for the savings comparison baseline
const HOME_COUNTRY: CountryCode = "BE";

const EU_BULLETIN_URL =
	"https://ec.europa.eu/energy/observatory/reports/latest_prices.json";
const TANKERKOENIG_KEY = "00000000-0000-0000-0000-000000000002";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceFor(country: CountryPrice, fuel: FuelType): number {
	switch (fuel) {
		case "petrol_95":
			return country.petrol95;
		case "petrol_98":
			return country.petrol98 ?? country.petrol95;
		case "diesel":
			return country.diesel;
		case "lpg":
			return country.lpg ?? country.petrol95;
		case "electric":
			return country.petrol95; // EV pricing not modelled here
	}
}

function formatPrice(eur: number) {
	return `€${eur.toFixed(2)}`;
}

function inGermany(lat: number, lng: number) {
	return lat >= 47 && lat <= 55 && lng >= 6 && lng <= 15;
}

function inFrance(lat: number, lng: number) {
	return lat >= 42 && lat <= 51 && lng >= -5 && lng <= 8;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NearbyStation {
	id: string;
	name: string;
	brand?: string;
	lat: number;
	lng: number;
	petrol95?: number;
	diesel?: number;
}

type ViewTab = "map" | "list";

export default function FuelScreen() {
	const router = useRouter();
	const { convoy } = useLocalSearchParams<{ convoy?: string }>();
	const userId = useUserStore((s) => s.userId);

	const [prices, setPrices] = useState<Record<CountryCode, CountryPrice>>(
		FALLBACK_PRICES,
	);
	const [usingFallback, setUsingFallback] = useState(true);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [fuel, setFuel] = useState<FuelType>("petrol_95");
	const [tab, setTab] = useState<ViewTab>("map");

	const [tankSize, setTankSize] = useState<number>(50);
	const [consumption, setConsumption] = useState<number>(7.0);

	const [routeCountries, setRouteCountries] = useState<CountryCode[]>(DEFAULT_ROUTE);
	const [stops, setStops] = useState<Stop[]>([]);

	const [selected, setSelected] = useState<CountryCode | null>(null);
	const [calcOpen, setCalcOpen] = useState(false);
	const [calcFillups, setCalcFillups] = useState(3);

	const [nearby, setNearby] = useState<NearbyStation[]>([]);
	const mapRef = useRef<MapView | null>(null);

	// ─── Load vehicle profile (tank, consumption, fuel type pref) ────────────
	useEffect(() => {
		if (!userId) return;
		let cancelled = false;
		(async () => {
			try {
				const { data } = await supabase
					.from("vehicles")
					.select("tank_size, consumption, fuel_type")
					.eq("user_id", userId)
					.order("created_at", { ascending: true })
					.limit(1)
					.maybeSingle();
				if (cancelled || !data) return;
				if (typeof data.tank_size === "number" && data.tank_size > 0) {
					setTankSize(data.tank_size);
				}
				if (typeof data.consumption === "number" && data.consumption > 0) {
					setConsumption(data.consumption);
				}
				if (data.fuel_type) {
					setFuel(data.fuel_type as FuelType);
				}
			} catch {
				// best effort
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [userId]);

	// ─── Load convoy stops, derive countries on the route ────────────────────
	useEffect(() => {
		if (!convoy) return;
		let cancelled = false;
		(async () => {
			try {
				const { data } = await supabase
					.from("stops")
					.select("*")
					.eq("convoy_id", convoy)
					.eq("status", "confirmed")
					.order("created_at", { ascending: true });
				if (cancelled) return;
				const rows = (data ?? []) as Stop[];
				setStops(rows);
				// Crude reverse-geocode by nearest country center
				const route: CountryCode[] = [];
				for (const s of rows) {
					const c = nearestCountry(s.lat, s.lng);
					if (c && !route.includes(c)) route.push(c);
				}
				if (route.length >= 2) setRouteCountries(route);
			} catch {
				// optional
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [convoy]);

	// ─── Fetch live prices, fallback silently on failure ─────────────────────
	const fetchPrices = useCallback(async () => {
		try {
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), 8000);
			const res = await fetch(EU_BULLETIN_URL, { signal: ctrl.signal });
			clearTimeout(timer);
			if (!res.ok) throw new Error("Bulletin HTTP " + res.status);
			const json = await res.json();
			const parsed = parseBulletin(json);
			if (parsed) {
				setPrices(parsed);
				setUsingFallback(false);
				setLastUpdated(new Date());
				return;
			}
			throw new Error("Bulletin shape unknown");
		} catch {
			// Fallback to cached / hardcoded
			setPrices(FALLBACK_PRICES);
			setUsingFallback(true);
			setLastUpdated(new Date());
		}
	}, []);

	useEffect(() => {
		fetchPrices();
	}, [fetchPrices]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await fetchPrices();
		setRefreshing(false);
	}, [fetchPrices]);

	// ─── Optional: nearby stations when the user is in DE or FR ──────────────
	const fetchNearby = useCallback(async (lat: number, lng: number) => {
		try {
			if (inGermany(lat, lng)) {
				const url = `https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lng}&rad=10&type=all&apikey=${TANKERKOENIG_KEY}`;
				const res = await fetch(url);
				const json = await res.json();
				const rows: NearbyStation[] = (json?.stations ?? [])
					.slice(0, 20)
					.map((s: any) => ({
						id: String(s.id),
						name: s.name,
						brand: s.brand,
						lat: s.lat,
						lng: s.lng,
						petrol95: s.e5 ?? s.e10,
						diesel: s.diesel,
					}));
				setNearby(rows);
				return;
			}
			if (inFrance(lat, lng)) {
				const url =
					`https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?limit=20&where=` +
					encodeURIComponent(
						`distance(geo_point, geom'POINT(${lng} ${lat})', 10000)`,
					);
				const res = await fetch(url);
				const json = await res.json();
				const rows: NearbyStation[] = (json?.results ?? []).map((r: any) => ({
					id: String(r.id ?? r.cp ?? Math.random()),
					name: r.adresse ?? "Station",
					brand: r.marque,
					lat: r.geo_point?.lat ?? r.geom?.coordinates?.[1] ?? 0,
					lng: r.geo_point?.lon ?? r.geom?.coordinates?.[0] ?? 0,
					petrol95: r.prix_sp95 ?? r.prix_sp95_e10,
					diesel: r.prix_gazole,
				}));
				setNearby(rows);
				return;
			}
			setNearby([]);
		} catch {
			setNearby([]);
		}
	}, []);

	// ─── Derived: sorted list, route countries, recommendation ───────────────
	const allCountries = useMemo(
		() => (Object.keys(prices) as CountryCode[]),
		[prices],
	);

	const sortedCountries = useMemo(() => {
		return [...allCountries].sort(
			(a, b) => priceFor(prices[a], fuel) - priceFor(prices[b], fuel),
		);
	}, [allCountries, prices, fuel]);

	const cheapest = sortedCountries[0];
	const mostExpensive = sortedCountries[sortedCountries.length - 1];

	const homePrice = priceFor(prices[HOME_COUNTRY], fuel);
	const cheapestPrice = priceFor(prices[cheapest], fuel);
	const savingsPerTank = (homePrice - cheapestPrice) * tankSize;

	// Cheapest country actually on the convoy route
	const cheapestOnRoute = useMemo(() => {
		const onRoute = routeCountries
			.filter((c) => prices[c])
			.sort((a, b) => priceFor(prices[a], fuel) - priceFor(prices[b], fuel));
		return onRoute[0] ?? cheapest;
	}, [routeCountries, prices, fuel, cheapest]);

	const cheapestOnRouteKm = ROUTE_KM[cheapestOnRoute] ?? 0;
	const routeSavingsPerTank =
		(homePrice - priceFor(prices[cheapestOnRoute], fuel)) * tankSize;

	const calcTotalSavings = routeSavingsPerTank * calcFillups;

	// ─── Render ──────────────────────────────────────────────────────────────
	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity
						onPress={() => router.back()}
						hitSlop={12}
						style={styles.backBtn}
					>
						<Text style={styles.backText}>Back</Text>
					</TouchableOpacity>
					<Text style={styles.title}>Fuel</Text>
					<View style={{ width: 50 }} />
				</View>

				{/* Last updated / fallback banner */}
				<View style={styles.updatedRow}>
					<Text style={styles.updatedText}>
						{lastUpdated
							? `Last updated: ${formatRelative(lastUpdated)}`
							: "Loading prices…"}
					</Text>
					{usingFallback ? (
						<View style={styles.offlineBadge}>
							<Text style={styles.offlineBadgeText}>Offline prices</Text>
						</View>
					) : null}
				</View>

				{/* Fuel type pill tabs */}
				<View style={styles.fuelTabs}>
					{FUEL_TABS.map((f) => (
						<TouchableOpacity
							key={f}
							onPress={() => setFuel(f)}
							activeOpacity={0.8}
							style={styles.fuelTabTap}
						>
							<NeumorphicView
								pressed={fuel === f}
								style={[
									styles.fuelTab,
									fuel === f && styles.fuelTabActive,
								]}
							>
								<Text
									style={[
										styles.fuelTabText,
										fuel === f && styles.fuelTabTextActive,
									]}
								>
									{FUEL_LABEL[f]}
								</Text>
							</NeumorphicView>
						</TouchableOpacity>
					))}
				</View>

				{/* Map vs List switcher */}
				<View style={styles.viewSwitch}>
					{(["map", "list"] as ViewTab[]).map((v) => (
						<TouchableOpacity
							key={v}
							onPress={() => setTab(v)}
							style={[
								styles.viewSwitchBtn,
								tab === v && styles.viewSwitchBtnActive,
							]}
						>
							<Text
								style={[
									styles.viewSwitchText,
									tab === v && styles.viewSwitchTextActive,
								]}
							>
								{v === "map" ? "Map" : "List"}
							</Text>
						</TouchableOpacity>
					))}
				</View>

				{/* Body */}
				{tab === "map" ? (
					<View style={styles.mapWrap}>
						<MapView
							ref={mapRef}
							style={StyleSheet.absoluteFill}
							provider={PROVIDER_DEFAULT}
							mapType="standard"
							initialRegion={{
								latitude: 47,
								longitude: 17,
								latitudeDelta: 24,
								longitudeDelta: 30,
							}}
							onRegionChangeComplete={(r) => {
								// opportunistically fetch local stations when zoomed in
								if (r.latitudeDelta < 4) {
									fetchNearby(r.latitude, r.longitude);
								}
							}}
						>
							{allCountries.map((cc) => {
								const ctr = COUNTRY_CENTERS[cc];
								const p = priceFor(prices[cc], fuel);
								const tint = priceTint(p, homePrice);
								return (
									<Marker
										key={cc}
										coordinate={{ latitude: ctr.lat, longitude: ctr.lng }}
										onPress={() => setSelected(cc)}
										anchor={{ x: 0.5, y: 0.5 }}
									>
										<View
											style={[
												styles.countryPill,
												{ backgroundColor: tint },
												routeCountries.includes(cc) && styles.countryPillRoute,
											]}
										>
											<Text style={styles.countryPillFlag}>{ctr.flag}</Text>
											<Text style={styles.countryPillPrice}>
												{formatPrice(p)}
											</Text>
										</View>
									</Marker>
								);
							})}

							{nearby.map((s) => (
								<Marker
									key={s.id}
									coordinate={{ latitude: s.lat, longitude: s.lng }}
									anchor={{ x: 0.5, y: 0.5 }}
								>
									<View style={styles.stationDot}>
										<Text style={styles.stationDotText}>
											{s.petrol95
												? formatPrice(s.petrol95)
												: s.diesel
													? formatPrice(s.diesel)
													: "⛽"}
										</Text>
									</View>
								</Marker>
							))}
						</MapView>

						{/* Country detail card */}
						{selected ? (
							<View style={styles.countryCardWrap} pointerEvents="box-none">
								<NeumorphicView style={styles.countryCard}>
									<View style={styles.countryCardHeader}>
										<Text style={styles.countryCardTitle}>
											{COUNTRY_CENTERS[selected].flag}{" "}
											{COUNTRY_CENTERS[selected].name}
										</Text>
										<TouchableOpacity
											onPress={() => setSelected(null)}
											hitSlop={10}
										>
											<Text style={styles.countryCardClose}>✕</Text>
										</TouchableOpacity>
									</View>
									<View style={styles.countryCardRow}>
										<Text style={styles.countryCardLabel}>
											{FUEL_LABEL[fuel]}
										</Text>
										<Text style={styles.countryCardPrice}>
											{formatPrice(priceFor(prices[selected], fuel))}
										</Text>
									</View>
									<View style={styles.countryCardRow}>
										<Text style={styles.countryCardLabel}>
											vs {COUNTRY_CENTERS[HOME_COUNTRY].name}
										</Text>
										<Text
											style={[
												styles.countryCardDelta,
												deltaColor(
													priceFor(prices[selected], fuel) - homePrice,
												),
											]}
										>
											{formatDelta(
												priceFor(prices[selected], fuel) - homePrice,
											)}
										</Text>
									</View>
									<View style={styles.countryCardRow}>
										<Text style={styles.countryCardLabel}>
											Per tank ({tankSize}L)
										</Text>
										<Text
											style={[
												styles.countryCardDelta,
												deltaColor(
													(priceFor(prices[selected], fuel) - homePrice) *
														tankSize,
												),
											]}
										>
											{formatDelta(
												(priceFor(prices[selected], fuel) - homePrice) *
													tankSize,
											)}
										</Text>
									</View>
								</NeumorphicView>
							</View>
						) : null}
					</View>
				) : (
					<ScrollView
						style={styles.flex}
						contentContainerStyle={styles.listContent}
						refreshControl={
							<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
						}
					>
						{sortedCountries.map((cc, idx) => {
							const p = priceFor(prices[cc], fuel);
							const delta = p - homePrice;
							const cheapBadge =
								(priceFor(prices[mostExpensive], fuel) - p) /
									priceFor(prices[mostExpensive], fuel) >
								0.15;
							return (
								<StaggeredFadeIn key={cc} index={idx}>
									<NeumorphicView
										style={[
											styles.listRow,
											routeCountries.includes(cc) && styles.listRowRoute,
										]}
									>
										<Text style={styles.listFlag}>
											{COUNTRY_CENTERS[cc].flag}
										</Text>
										<View style={styles.listInfo}>
											<Text style={styles.listName}>
												{COUNTRY_CENTERS[cc].name}
											</Text>
											<Text style={styles.listSecondary}>
												{FUEL_LABEL[fuel]} {formatPrice(p)} · Diesel{" "}
												{formatPrice(prices[cc].diesel)}
											</Text>
										</View>
										<View style={styles.listRight}>
											<Text
												style={[styles.listDelta, deltaColor(delta)]}
											>
												{formatDelta(delta)}
											</Text>
											{cheapBadge ? (
												<View style={styles.cheapBadge}>
													<Text style={styles.cheapBadgeText}>CHEAP</Text>
												</View>
											) : null}
										</View>
									</NeumorphicView>
								</StaggeredFadeIn>
							);
						})}
						<Text style={styles.attribution}>
							Source: EU Weekly Oil Bulletin · Tankerkönig (DE) · data.economie.gouv.fr (FR)
						</Text>
					</ScrollView>
				)}

				{/* Recommendation card — always visible at bottom */}
				<TouchableOpacity
					activeOpacity={0.9}
					onPress={() => setCalcOpen(true)}
					style={styles.recoWrap}
				>
					<NeumorphicView style={styles.recoCard}>
						<View style={styles.recoLeft}>
							<Text style={styles.recoEmoji}>💡</Text>
						</View>
						<View style={styles.recoBody}>
							<Text style={styles.recoTitle}>
								Fill up in {COUNTRY_CENTERS[cheapestOnRoute].name}
							</Text>
							<Text style={styles.recoSavings}>
								Save ~{formatPrice(Math.max(0, routeSavingsPerTank))} per tank
							</Text>
							<Text style={styles.recoMeta}>
								{cheapestOnRouteKm > 0
									? `Next cheap stop: ~${cheapestOnRouteKm} km ahead`
									: "Tap to open savings calculator"}
							</Text>
						</View>
						<Text style={styles.recoChevron}>›</Text>
					</NeumorphicView>
				</TouchableOpacity>

				{/* Savings calculator modal */}
				<Modal
					visible={calcOpen}
					animationType="slide"
					transparent
					onRequestClose={() => setCalcOpen(false)}
				>
					<View style={styles.modalRoot}>
						<TouchableOpacity
							style={styles.modalBackdrop}
							activeOpacity={1}
							onPress={() => setCalcOpen(false)}
						/>
						<View style={styles.sheet}>
							<View style={styles.sheetHandle} />
							<View style={styles.sheetHeader}>
								<Text style={styles.sheetTitle}>Savings calculator</Text>
								<TouchableOpacity onPress={() => setCalcOpen(false)} hitSlop={12}>
									<Text style={styles.sheetClose}>✕</Text>
								</TouchableOpacity>
							</View>
							<ScrollView contentContainerStyle={styles.sheetContent}>
								<Text style={styles.label}>Tank size (L)</Text>
								<NeumorphicView pressed style={styles.inputWrap}>
									<TextInput
										style={styles.input}
										value={String(tankSize)}
										onChangeText={(t) =>
											setTankSize(Number(t.replace(/[^0-9.]/g, "")) || 0)
										}
										keyboardType="decimal-pad"
									/>
								</NeumorphicView>

								<Text style={styles.label}>Fuel type</Text>
								<View style={styles.fuelTabs}>
									{FUEL_TABS.map((f) => (
										<TouchableOpacity
											key={f}
											onPress={() => setFuel(f)}
											activeOpacity={0.8}
											style={styles.fuelTabTap}
										>
											<NeumorphicView
												pressed={fuel === f}
												style={[
													styles.fuelTab,
													fuel === f && styles.fuelTabActive,
												]}
											>
												<Text
													style={[
														styles.fuelTabText,
														fuel === f && styles.fuelTabTextActive,
													]}
												>
													{FUEL_LABEL[f]}
												</Text>
											</NeumorphicView>
										</TouchableOpacity>
									))}
								</View>

								<Text style={styles.label}>Fill-ups on trip: {calcFillups}</Text>
								<View style={styles.stepperRow}>
									<TouchableOpacity
										onPress={() => setCalcFillups((n) => Math.max(1, n - 1))}
										style={styles.stepperBtn}
									>
										<Text style={styles.stepperBtnText}>−</Text>
									</TouchableOpacity>
									<View style={styles.stepperBar}>
										<View
											style={[
												styles.stepperFill,
												{ width: `${(calcFillups / 10) * 100}%` },
											]}
										/>
									</View>
									<TouchableOpacity
										onPress={() => setCalcFillups((n) => Math.min(10, n + 1))}
										style={styles.stepperBtn}
									>
										<Text style={styles.stepperBtnText}>+</Text>
									</TouchableOpacity>
								</View>

								{/* Comparison bars */}
								<Text style={styles.label}>Comparison</Text>
								<View style={styles.barRow}>
									<Text style={styles.barCountry}>
										{COUNTRY_CENTERS[HOME_COUNTRY].flag} {HOME_COUNTRY}
									</Text>
									<View style={styles.barTrack}>
										<View
											style={[
												styles.barFill,
												{
													width: "100%",
													backgroundColor: Colors.danger,
												},
											]}
										/>
									</View>
									<Text style={styles.barValue}>{formatPrice(homePrice)}</Text>
								</View>
								<View style={styles.barRow}>
									<Text style={styles.barCountry}>
										{COUNTRY_CENTERS[cheapestOnRoute].flag} {cheapestOnRoute}
									</Text>
									<View style={styles.barTrack}>
										<View
											style={[
												styles.barFill,
												{
													width: `${
														(priceFor(prices[cheapestOnRoute], fuel) /
															homePrice) *
														100
													}%`,
													backgroundColor: Colors.online,
												},
											]}
										/>
									</View>
									<Text style={styles.barValue}>
										{formatPrice(priceFor(prices[cheapestOnRoute], fuel))}
									</Text>
								</View>

								<NeumorphicView style={styles.totalCard}>
									<Text style={styles.totalLabel}>Estimated total savings</Text>
									<Text style={styles.totalAmount}>
										{formatPrice(Math.max(0, calcTotalSavings))}
									</Text>
									<Text style={styles.totalMeta}>
										{calcFillups} fill-ups × {tankSize}L · {FUEL_LABEL[fuel]}
									</Text>
								</NeumorphicView>

								<Button
									label="Done"
									onPress={() => setCalcOpen(false)}
									style={{ marginTop: Spacing.lg }}
								/>
							</ScrollView>
						</View>
					</View>
				</Modal>
			</FadeInView>
		</SafeAreaView>
	);
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function priceTint(price: number, baseline: number): string {
	const ratio = price / baseline;
	if (ratio < 0.85) return "#dcfce7"; // light green — cheap
	if (ratio < 0.95) return "#ecfccb";
	if (ratio < 1.05) return "#ffffff";
	if (ratio < 1.15) return "#fef3c7";
	return "#fee2e2"; // light red — expensive
}

function deltaColor(delta: number) {
	if (delta < -0.01) return { color: Colors.online };
	if (delta > 0.01) return { color: Colors.danger };
	return { color: Colors.textMuted };
}

function formatDelta(delta: number) {
	const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
	return `${sign}€${Math.abs(delta).toFixed(2)}`;
}

function formatRelative(d: Date) {
	const diff = (Date.now() - d.getTime()) / 1000;
	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	return d.toLocaleDateString();
}

function nearestCountry(lat: number, lng: number): CountryCode | null {
	let best: CountryCode | null = null;
	let bestD = Infinity;
	for (const cc of Object.keys(COUNTRY_CENTERS) as CountryCode[]) {
		const ctr = COUNTRY_CENTERS[cc];
		const d = (ctr.lat - lat) ** 2 + (ctr.lng - lng) ** 2;
		if (d < bestD) {
			bestD = d;
			best = cc;
		}
	}
	return best;
}

// Best-effort EU Bulletin parser. The endpoint shape varies week to week and is
// sometimes blocked by CORS in browsers — on RN it usually returns JSON, but
// we accept any shape and only commit the result if at least 3 countries match.
function parseBulletin(json: any): Record<CountryCode, CountryPrice> | null {
	try {
		const out: Partial<Record<CountryCode, CountryPrice>> = {};
		const rows: any[] =
			(Array.isArray(json) && json) ||
			json?.data ||
			json?.records ||
			json?.results ||
			[];
		for (const r of rows) {
			const cc = (r.country || r.cc || r.code || "")
				.toString()
				.toUpperCase()
				.slice(0, 2) as CountryCode;
			if (!cc || !(cc in FALLBACK_PRICES)) continue;
			const p95 =
				Number(r.petrol95 ?? r.euro95 ?? r.gasoline95 ?? r.gasoline) || 0;
			const diesel = Number(r.diesel ?? r.gasoil) || 0;
			if (p95 > 0 && diesel > 0) {
				out[cc] = { petrol95: p95, diesel, currency: "EUR" };
			}
		}
		if (Object.keys(out).length < 3) return null;
		return { ...FALLBACK_PRICES, ...out } as Record<CountryCode, CountryPrice>;
	} catch {
		return null;
	}
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },

	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.md,
		marginBottom: Spacing.sm,
	},
	backBtn: {
		padding: Spacing.xs,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
	},
	backText: {
		fontSize: FontSize.sm,
		color: Colors.textPrimary,
		fontWeight: FontWeight.medium,
	},
	title: {
		fontSize: FontSize.lg,
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
		letterSpacing: -0.3,
	},

	updatedRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.xl,
		marginBottom: Spacing.md,
	},
	updatedText: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		fontWeight: FontWeight.medium,
	},
	offlineBadge: {
		backgroundColor: Colors.bgElevated,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 4,
		borderRadius: Radius.full,
	},
	offlineBadgeText: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.5,
		textTransform: "uppercase",
	},

	fuelTabs: {
		flexDirection: "row",
		gap: Spacing.sm,
		paddingHorizontal: Spacing.xl,
		marginBottom: Spacing.md,
	},
	fuelTabTap: { flex: 1 },
	fuelTab: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.full,
		paddingVertical: Spacing.sm,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 40,
	},
	fuelTabActive: { backgroundColor: Colors.bgElevated },
	fuelTabText: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.medium,
	},
	fuelTabTextActive: {
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},

	viewSwitch: {
		flexDirection: "row",
		marginHorizontal: Spacing.xl,
		marginBottom: Spacing.md,
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.full,
		padding: 4,
	},
	viewSwitchBtn: {
		flex: 1,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	viewSwitchBtnActive: { backgroundColor: Colors.bgElevated },
	viewSwitchText: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.medium,
	},
	viewSwitchTextActive: {
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},

	mapWrap: {
		flex: 1,
		marginHorizontal: Spacing.xl,
		marginBottom: Spacing.md,
		borderRadius: Radius.xl,
		overflow: "hidden",
		backgroundColor: Colors.bgCard,
	},

	countryPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: Radius.full,
		borderWidth: 1,
		borderColor: "rgba(0,0,0,0.08)",
	},
	countryPillRoute: {
		borderColor: Colors.primary,
		borderWidth: 2,
	},
	countryPillFlag: { fontSize: 14 },
	countryPillPrice: {
		fontSize: 12,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},

	stationDot: {
		backgroundColor: Colors.bgElevated,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: Radius.sm,
		borderWidth: 1,
		borderColor: "rgba(0,0,0,0.1)",
	},
	stationDotText: {
		fontSize: 10,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},

	countryCardWrap: {
		position: "absolute",
		left: Spacing.md,
		right: Spacing.md,
		top: Spacing.md,
	},
	countryCard: {
		backgroundColor: Colors.bgElevated,
		borderRadius: Radius.xl,
		padding: Spacing.lg,
		gap: Spacing.xs,
	},
	countryCardHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.xs,
	},
	countryCardTitle: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},
	countryCardClose: {
		fontSize: FontSize.lg,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},
	countryCardRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 4,
	},
	countryCardLabel: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},
	countryCardPrice: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},
	countryCardDelta: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
	},

	listContent: {
		paddingHorizontal: Spacing.xl,
		paddingBottom: Spacing.xxl,
		gap: Spacing.sm,
	},
	listRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.md,
		gap: Spacing.md,
	},
	listRowRoute: {
		backgroundColor: Colors.bgElevated,
	},
	listFlag: { fontSize: 28 },
	listInfo: { flex: 1 },
	listName: {
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},
	listSecondary: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginTop: 2,
		fontWeight: FontWeight.regular,
	},
	listRight: {
		alignItems: "flex-end",
		gap: 4,
	},
	listDelta: {
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
	},
	cheapBadge: {
		backgroundColor: Colors.online,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: Radius.sm,
	},
	cheapBadgeText: {
		fontSize: 10,
		fontWeight: FontWeight.semibold,
		color: "#fff",
		letterSpacing: 0.6,
	},

	attribution: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		textAlign: "center",
		marginTop: Spacing.md,
		fontWeight: FontWeight.regular,
	},

	recoWrap: {
		paddingHorizontal: Spacing.xl,
		paddingBottom: Platform.OS === "ios" ? Spacing.lg : Spacing.md,
	},
	recoCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.bgElevated,
		borderRadius: Radius.xl,
		padding: Spacing.lg,
		gap: Spacing.md,
	},
	recoLeft: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.bgCard,
	},
	recoEmoji: { fontSize: 24 },
	recoBody: { flex: 1 },
	recoTitle: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},
	recoSavings: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.online,
		marginTop: 2,
	},
	recoMeta: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		marginTop: 2,
		fontWeight: FontWeight.regular,
	},
	recoChevron: {
		fontSize: 24,
		color: Colors.textMuted,
		fontWeight: FontWeight.light,
	},

	// Modal
	modalRoot: { flex: 1, justifyContent: "flex-end" },
	modalBackdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.4)",
	},
	sheet: {
		backgroundColor: Colors.bg,
		borderTopLeftRadius: Radius.xl,
		borderTopRightRadius: Radius.xl,
		paddingBottom: Spacing.xl,
		maxHeight: "92%",
	},
	sheetHandle: {
		alignSelf: "center",
		width: 40,
		height: 4,
		borderRadius: 2,
		backgroundColor: Colors.primaryBorder,
		marginTop: Spacing.sm,
	},
	sheetHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: Spacing.xl,
	},
	sheetTitle: {
		fontSize: FontSize.xl,
		fontWeight: FontWeight.light,
		color: Colors.textPrimary,
		letterSpacing: -0.5,
	},
	sheetClose: {
		fontSize: FontSize.xl,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
	},
	sheetContent: {
		paddingHorizontal: Spacing.xl,
		paddingBottom: Spacing.xxl,
	},
	label: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		marginTop: Spacing.lg,
		marginBottom: Spacing.sm,
	},
	inputWrap: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
	},
	input: {
		backgroundColor: "transparent",
		fontSize: FontSize.md,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
	},

	stepperRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
	},
	stepperBtn: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: Colors.bgElevated,
		alignItems: "center",
		justifyContent: "center",
	},
	stepperBtnText: {
		fontSize: 22,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
		lineHeight: 24,
	},
	stepperBar: {
		flex: 1,
		height: 8,
		borderRadius: 4,
		backgroundColor: Colors.bgCard,
		overflow: "hidden",
	},
	stepperFill: { height: "100%", backgroundColor: Colors.primary },

	barRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		marginBottom: Spacing.sm,
	},
	barCountry: {
		width: 64,
		fontSize: FontSize.sm,
		fontWeight: FontWeight.medium,
		color: Colors.textPrimary,
	},
	barTrack: {
		flex: 1,
		height: 18,
		borderRadius: 9,
		backgroundColor: Colors.bgCard,
		overflow: "hidden",
	},
	barFill: { height: "100%" },
	barValue: {
		width: 64,
		textAlign: "right",
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},

	totalCard: {
		backgroundColor: Colors.bgElevated,
		borderRadius: Radius.xl,
		padding: Spacing.xl,
		alignItems: "center",
		marginTop: Spacing.lg,
	},
	totalLabel: {
		fontSize: FontSize.xs,
		color: Colors.textMuted,
		fontWeight: FontWeight.semibold,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		marginBottom: Spacing.sm,
	},
	totalAmount: {
		fontSize: FontSize.display,
		fontWeight: FontWeight.thin,
		color: Colors.online,
		letterSpacing: -1,
	},
	totalMeta: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.regular,
		marginTop: Spacing.xs,
	},
});
