import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Animated,
	Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { FadeInView } from "../../src/components/FadeInView";
import { SoftBackground } from "../../src/components/SoftBackground";
import { NeumorphicView } from "../../src/components/NeumorphicView";
import { StaggeredFadeIn } from "../../src/components/StaggeredFadeIn";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Spacing,
} from "../../src/constants/theme";
import { usePlanStore } from "../../src/store/planStore";
import type {
	GeneratedRoute,
	PlannedStop,
} from "../../src/store/planStore";
import { generateRoutes, generateInviteCode } from "../../src/lib/planner";
import { supabase } from "../../src/lib/supabase";
import { useUserStore } from "../../src/store/userStore";

const TYPE_ICON: Record<PlannedStop["type"], string> = {
	fuel: "⛽",
	food: "🍔",
	rest: "😴",
	sightseeing: "📸",
	overnight: "🏨",
	shopping: "🛒",
};

const ROUTE_BADGE: Record<GeneratedRoute["type"], string> = {
	fast: "⚡",
	balanced: "⚖️",
	scenic: "🌄",
};

const LOADING_MESSAGES = [
	"Checking fuel prices across 12 countries…",
	"Finding the best overnight spots…",
	"Calculating optimal stop timing…",
	"Almost ready…",
];

export default function PlanResults() {
	const router = useRouter();
	const userId = useUserStore((s) => s.userId);

	const origin = usePlanStore((s) => s.origin);
	const destination = usePlanStore((s) => s.destination);
	const carCount = usePlanStore((s) => s.carCount);
	const tripDays = usePlanStore((s) => s.tripDays);
	const departureDate = usePlanStore((s) => s.departureDate);
	const stopsPerDay = usePlanStore((s) => s.stopsPerDay);
	const stopTypes = usePlanStore((s) => s.stopTypes);
	const sleepType = usePlanStore((s) => s.sleepType);
	const hotelBudget = usePlanStore((s) => s.hotelBudget);
	const hotelStars = usePlanStore((s) => s.hotelStars);
	const selectedAiPlaces = usePlanStore((s) => s.selectedAiPlaces);
	const manualPlaces = usePlanStore((s) => s.manualPlaces);
	const generatedRoutes = usePlanStore((s) => s.generatedRoutes);
	const setGeneratedRoutes = usePlanStore((s) => s.setGeneratedRoutes);
	const selectedRoute = usePlanStore((s) => s.selectedRoute);
	const setSelectedRoute = usePlanStore((s) => s.setSelectedRoute);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [pickedId, setPickedId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [messageIdx, setMessageIdx] = useState(0);

	// Animated car for loading state
	const spin = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		if (!loading) return;
		const anim = Animated.loop(
			Animated.timing(spin, {
				toValue: 1,
				duration: 1600,
				easing: Easing.linear,
				useNativeDriver: true,
			}),
		);
		anim.start();
		return () => anim.stop();
	}, [loading, spin]);

	// Rotate loading messages
	useEffect(() => {
		if (!loading) return;
		const t = setInterval(
			() => setMessageIdx((i) => (i + 1) % LOADING_MESSAGES.length),
			2000,
		);
		return () => clearInterval(t);
	}, [loading]);

	const fetchRoutes = useCallback(async () => {
		if (!origin || !destination) {
			setError("Origin and destination required.");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const routes = await generateRoutes({
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
				mustSeePlaces: [...selectedAiPlaces, ...manualPlaces],
			});
			setGeneratedRoutes(routes);
		} catch (e: any) {
			setError(e?.message ?? "Couldn't generate routes.");
		} finally {
			setLoading(false);
		}
	}, [
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
		selectedAiPlaces,
		manualPlaces,
		setGeneratedRoutes,
	]);

	// Generate once on mount unless we already have routes in the store
	useEffect(() => {
		if (!generatedRoutes) fetchRoutes();
	}, [generatedRoutes, fetchRoutes]);

	async function createConvoyFromPlan(route: GeneratedRoute) {
		if (!userId || !origin || !destination) {
			setError("Missing user session — try restarting the app.");
			return;
		}
		setCreating(true);
		setError("");
		try {
			// 1. Convoy row
			const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
			const { data: convoy, error: convoyErr } = await supabase
				.from("convoys")
				.insert({
					created_by: userId,
					title: `${origin.name} → ${destination.name}`,
					invite_code: generateInviteCode(),
					status: "preparation",
					expires_at: expires.toISOString(),
					starts_at:
						departureDate?.toISOString() ?? new Date().toISOString(),
				})
				.select("id")
				.single();
			if (convoyErr) throw convoyErr;

			// 2. Creator as leader
			const { data: member, error: memberErr } = await supabase
				.from("convoy_members")
				.insert({
					convoy_id: convoy.id,
					user_id: userId,
					role: "leader",
					status: "online",
				})
				.select("id")
				.single();
			if (memberErr) throw memberErr;

			// 3. Bulk-insert planned stops (already pre-confirmed)
			if (route.stops.length > 0) {
				const rows = route.stops.map((s) => ({
					convoy_id: convoy.id,
					proposed_by: member.id,
					// Map planner types to DB stop types — "shopping" isn't in the DB
					// enum, so it falls back to "sightseeing".
					type:
						s.type === "shopping" ? "sightseeing" : s.type,
					name: s.name,
					lat: s.lat,
					lng: s.lng,
					duration_min: s.duration_min,
					status: "confirmed",
				}));
				const { error: stopsErr } = await supabase.from("stops").insert(rows);
				if (stopsErr) throw stopsErr;
			}

			setSelectedRoute(route);
			router.replace(`/convoy/${convoy.id}/lobby`);
		} catch (e: any) {
			setError(e?.message ?? "Couldn't create the convoy.");
		} finally {
			setCreating(false);
		}
	}

	// ── Render ──────────────────────────────────────────────────────────────
	if (loading) {
		const rotate = spin.interpolate({
			inputRange: [0, 1],
			outputRange: ["0deg", "360deg"],
		});
		return (
			<SafeAreaView style={styles.safe}>
				<SoftBackground />
				<FadeInView style={styles.loaderRoot}>
					<Animated.Text
						style={[styles.loaderEmoji, { transform: [{ rotate }] }]}
					>
						🚗
					</Animated.Text>
					<Text style={styles.loaderTitle}>
						ConvoyAI is planning your route…
					</Text>
					<Text style={styles.loaderSub}>{LOADING_MESSAGES[messageIdx]}</Text>
				</FadeInView>
			</SafeAreaView>
		);
	}

	if (creating) {
		return (
			<SafeAreaView style={styles.safe}>
				<SoftBackground />
				<FadeInView style={styles.loaderRoot}>
					<ActivityIndicator color={Colors.primary} size="large" />
					<Text style={styles.loaderTitle}>Creating your convoy…</Text>
				</FadeInView>
			</SafeAreaView>
		);
	}

	if (error && !generatedRoutes) {
		return (
			<SafeAreaView style={styles.safe}>
				<SoftBackground />
				<View style={styles.center}>
					<Text style={styles.errorTitle}>Couldn't plan the trip</Text>
					<Text style={styles.errorMsg}>{error}</Text>
					<Button label="Try again" onPress={fetchRoutes} style={{ marginTop: Spacing.lg }} />
					<Button
						label="Back"
						variant="ghost"
						onPress={() => router.back()}
						style={{ marginTop: Spacing.sm }}
					/>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.flex}>
				<ScrollView contentContainerStyle={styles.container}>
					<View style={styles.header}>
						<TouchableOpacity
							onPress={() => router.back()}
							hitSlop={12}
							style={styles.backBtn}
						>
							<Text style={styles.backText}>Back</Text>
						</TouchableOpacity>
						<Text style={styles.headerTitle}>Pick a route</Text>
						<View style={{ width: 50 }} />
					</View>

					{(generatedRoutes ?? []).map((route, idx) => {
						const selected = pickedId === route.id;
						return (
							<StaggeredFadeIn key={route.id} index={idx}>
								<TouchableOpacity
									activeOpacity={0.9}
									onPress={() => setPickedId(route.id)}
								>
									<NeumorphicView
										style={[
											styles.routeCard,
											selected && styles.routeCardSel,
										]}
									>
										<View style={styles.routeHeader}>
											<Text style={styles.routeTitle}>
												{ROUTE_BADGE[route.type]} {route.title}
											</Text>
											{selected ? (
												<View style={styles.selectedPill}>
													<Text style={styles.selectedPillText}>SELECTED</Text>
												</View>
											) : null}
										</View>

										<Text style={styles.routeMeta}>
											{route.totalKm.toLocaleString()} km · {route.estimatedDays}{" "}
											days · {route.stops.length} stops
										</Text>
										<Text style={styles.routeFuel}>
											Fuel est. ~€{route.fuelCostEstimate} per car
										</Text>

										{groupStopsByDay(route.stops).map((day) => (
											<View key={day.day} style={styles.dayBlock}>
												<Text style={styles.dayTitle}>Day {day.day}</Text>
												<View style={styles.dayLine} />
												{day.stops.map((s, i) => (
													<View
														key={`${s.name}-${i}`}
														style={styles.stopRow}
													>
														<Text style={styles.stopIcon}>
															{TYPE_ICON[s.type] ?? "📍"}
														</Text>
														<Text style={styles.stopText} numberOfLines={1}>
															{stopLabel(s)}
														</Text>
													</View>
												))}
											</View>
										))}
									</NeumorphicView>
								</TouchableOpacity>
							</StaggeredFadeIn>
						);
					})}

					{error ? (
						<NeumorphicView style={styles.errorBox}>
							<Text style={styles.errorText}>{error}</Text>
						</NeumorphicView>
					) : null}

					<View style={styles.actions}>
						<Button
							label="Use this route"
							onPress={() => {
								const route = (generatedRoutes ?? []).find(
									(r) => r.id === pickedId,
								);
								if (route) createConvoyFromPlan(route);
							}}
							disabled={!pickedId}
						/>
						<Button
							label="Regenerate"
							variant="ghost"
							onPress={() => {
								setGeneratedRoutes(null);
								setPickedId(null);
								fetchRoutes();
							}}
						/>
					</View>
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupStopsByDay(stops: PlannedStop[]) {
	const map = new Map<number, PlannedStop[]>();
	for (const s of stops) {
		const arr = map.get(s.day) ?? [];
		arr.push(s);
		map.set(s.day, arr);
	}
	return Array.from(map.entries())
		.sort(([a], [b]) => a - b)
		.map(([day, stops]) => ({
			day,
			stops: stops.sort((a, b) => a.order - b.order),
		}));
}

function stopLabel(s: PlannedStop) {
	if (s.isOvernight && s.hotelName) {
		return `Night — ${s.hotelName}`;
	}
	if (s.type === "overnight") return `Night — ${s.name}`;
	return s.name;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	flex: { flex: 1 },
	container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },

	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.xl,
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
	headerTitle: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},

	loaderRoot: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: Spacing.xl,
		gap: Spacing.md,
	},
	loaderEmoji: { fontSize: 64 },
	loaderTitle: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.light,
		color: Colors.textPrimary,
		textAlign: "center",
		letterSpacing: -0.3,
	},
	loaderSub: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		textAlign: "center",
		fontWeight: FontWeight.regular,
	},

	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: Spacing.xl,
	},
	errorTitle: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		marginBottom: Spacing.sm,
	},
	errorMsg: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		textAlign: "center",
		fontWeight: FontWeight.regular,
		lineHeight: 20,
	},

	routeCard: {
		backgroundColor: Colors.bgElevated,
		borderRadius: Radius.xl,
		padding: Spacing.lg,
		marginBottom: Spacing.lg,
		borderWidth: 1,
		borderColor: "transparent",
	},
	routeCardSel: {
		borderColor: Colors.primary,
		borderWidth: 2,
		transform: [{ scale: 1.01 }],
	},
	routeHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.xs,
	},
	routeTitle: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		flex: 1,
	},
	selectedPill: {
		backgroundColor: Colors.primary,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 4,
		borderRadius: Radius.full,
	},
	selectedPillText: {
		color: Colors.bgElevated,
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.6,
	},
	routeMeta: {
		fontSize: FontSize.sm,
		color: Colors.textSecondary,
		fontWeight: FontWeight.medium,
		marginTop: 2,
	},
	routeFuel: {
		fontSize: FontSize.sm,
		color: Colors.online,
		fontWeight: FontWeight.semibold,
		marginTop: 4,
		marginBottom: Spacing.md,
	},

	dayBlock: { marginTop: Spacing.md },
	dayTitle: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		marginBottom: 4,
	},
	dayLine: {
		height: 1,
		backgroundColor: Colors.borderSubtle,
		marginBottom: Spacing.sm,
	},
	stopRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		paddingVertical: 4,
	},
	stopIcon: { fontSize: 18, width: 22 },
	stopText: {
		fontSize: FontSize.sm,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
		flex: 1,
	},

	errorBox: {
		backgroundColor: "rgba(220,38,38,0.08)",
		borderRadius: Radius.lg,
		padding: Spacing.md,
		marginBottom: Spacing.md,
	},
	errorText: {
		fontSize: FontSize.sm,
		color: Colors.danger,
		fontWeight: FontWeight.medium,
	},

	actions: { gap: Spacing.md, marginTop: Spacing.md },
});
