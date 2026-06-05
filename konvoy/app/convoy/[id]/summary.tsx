import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	SafeAreaView,
	ScrollView,
	Share,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
	ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { computeTripStats, TripStats } from "../../../src/lib/tripStats";
import { supabase } from "../../../src/lib/supabase";

const AMBER = "#f59e0b";
const BG = "#0c0b0a";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

const STOP_ICON: Record<string, string> = {
	fuel: "⛽",
	food: "🍔",
	rest: "😴",
	overnight: "🏨",
	sightseeing: "📸",
	emergency: "🚨",
};

export default function SummaryScreen() {
	const { id: convoyId } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const [stats, setStats] = useState<TripStats | null>(null);
	const [stops, setStops] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	const fadeAnim = useRef(new Animated.Value(0)).current;
	const slideAnim = useRef(new Animated.Value(20)).current;

	useEffect(() => {
		if (!convoyId) return;
		async function load() {
			try {
				const [tripStats, { data: stopData }] = await Promise.all([
					computeTripStats(convoyId),
					supabase
						.from("stops")
						.select("*")
						.eq("convoy_id", convoyId)
						.order("order_index", { ascending: true }),
				]);
				setStats(tripStats);
				setStops(stopData ?? []);
			} catch {
				// show what we have
			} finally {
				setLoading(false);
				Animated.parallel([
					Animated.timing(fadeAnim, {
						toValue: 1,
						duration: 560,
						useNativeDriver: true,
					}),
					Animated.timing(slideAnim, {
						toValue: 0,
						duration: 560,
						useNativeDriver: true,
					}),
				]).start();
			}
		}
		load();
	}, [convoyId]);

	function formatDuration(minutes: number): string {
		if (minutes <= 0) return "—";
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		if (h === 0) return `${m}m`;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	async function handleShare() {
		if (!stats) return;
		await Share.share({
			message:
				`🚗 Convoi trip complete!\n\n` +
				`${stats.convoyTitle}\n` +
				`📍 ${stats.totalDistanceKm} km covered\n` +
				`⏱ ${formatDuration(stats.totalDurationMin)}\n` +
				`🛑 ${stats.stopsCompleted} stops completed\n` +
				`👥 ${stats.crewCount} vehicles\n` +
				(stats.fuelSavedEstimate > 0
					? `⛽ ~€${stats.fuelSavedEstimate} saved on fuel\n\n`
					: "\n") +
				`Planned with Convoi`,
		});
	}

	if (loading) {
		return (
			<SafeAreaView style={styles.safe}>
				<StatusBar barStyle="light-content" backgroundColor={BG} />
				<View style={styles.loadingContainer}>
					<ActivityIndicator color={AMBER} size="large" />
					<Text style={styles.loadingText}>Compiling your trip…</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar barStyle="light-content" backgroundColor={BG} />
			<Animated.ScrollView
				style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
				contentContainerStyle={styles.container}
				showsVerticalScrollIndicator={false}
			>
				{/* Top bar */}
				<View style={styles.topBar}>
					<TouchableOpacity
						onPress={() => router.replace("/")}
						style={styles.backBtn}
						hitSlop={12}
					>
						<Text style={styles.backText}>← Home</Text>
					</TouchableOpacity>
					<View style={styles.endedChip}>
						<Text style={styles.endedChipText}>ENDED</Text>
					</View>
				</View>

				{/* Hero */}
				<View style={styles.hero}>
					<Text style={styles.eyebrow}>TRIP SUMMARY</Text>
					<Text style={styles.tripTitle} numberOfLines={3}>
						{stats?.convoyTitle}
					</Text>
					<Text style={styles.tripDate}>
						{stats?.endedAt
							? new Date(stats.endedAt).toLocaleDateString("en-GB", {
									day: "numeric",
									month: "long",
									year: "numeric",
								})
							: "Trip completed"}
					</Text>
				</View>

				{/* Stats strip */}
				<View style={styles.statsCard}>
					{[
						{
							label: "Distance",
							value: stats?.totalDistanceKm
								? `${stats.totalDistanceKm} km`
								: "—",
							icon: "📍",
						},
						{
							label: "Duration",
							value: formatDuration(stats?.totalDurationMin ?? 0),
							icon: "⏱",
						},
						{
							label: "Stops",
							value: `${stats?.stopsCompleted ?? 0}/${stats?.stopsTotal ?? 0}`,
							icon: "🛑",
						},
						{
							label: "Crew",
							value:
								(stats?.crewCount ?? 0) > 0
									? `${stats!.crewCount} car${stats!.crewCount !== 1 ? "s" : ""}`
									: "—",
							icon: "👥",
						},
					].map((stat) => (
						<View key={stat.label} style={styles.statItem}>
							<Text style={styles.statIcon}>{stat.icon}</Text>
							<Text style={styles.statValue}>{stat.value}</Text>
							<Text style={styles.statLabel}>{stat.label}</Text>
						</View>
					))}
				</View>

				{/* Fuel savings highlight */}
				{(stats?.fuelSavedEstimate ?? 0) > 0 ? (
					<View style={styles.savingsCard}>
						<Text style={styles.savingsIcon}>⛽</Text>
						<View style={styles.savingsTextBlock}>
							<Text style={styles.savingsTitle}>
								~€{stats!.fuelSavedEstimate} saved on fuel
							</Text>
							<Text style={styles.savingsSub}>
								vs filling up in Belgium the whole trip
							</Text>
						</View>
					</View>
				) : null}

				{/* Route timeline */}
				{stops.length > 0 ? (
					<>
						<Text style={styles.sectionLabel}>ROUTE COMPLETED</Text>
						<View style={styles.timeline}>
							{stops.map((stop, index) => {
								const isPassed = stop.status === "passed";
								const isCancelled = stop.status === "cancelled";
								const dotColor = isCancelled
									? "#dc2626"
									: isPassed
										? AMBER
										: "#333";
								return (
									<View key={stop.id}>
										<View style={styles.timelineItem}>
											<View style={styles.timelineLeft}>
												<View
													style={[
														styles.timelineDot,
														{ backgroundColor: dotColor },
													]}
												/>
											</View>
											<View style={styles.timelineContent}>
												<Text
													style={[
														styles.timelineStopName,
														isPassed && styles.stopNamePassed,
														isCancelled && styles.stopNameCancelled,
													]}
													numberOfLines={1}
												>
													{STOP_ICON[stop.type] ?? "📍"}{"  "}{stop.name}
												</Text>
												<Text style={styles.timelineStopMeta}>
													{stop.type.charAt(0).toUpperCase() +
														stop.type.slice(1)}{" "}
													· {stop.duration_min} min
													{isCancelled ? " · Cancelled" : ""}
												</Text>
											</View>
										</View>
										{index < stops.length - 1 ? (
											<View style={styles.timelineConnector}>
												<View style={styles.timelineLine} />
											</View>
										) : null}
									</View>
								);
							})}
						</View>
					</>
				) : null}

				{/* Actions */}
				<View style={styles.actions}>
					<TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
						<Text style={styles.shareBtnText}>📤  Share trip summary</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.newTripBtn}
						onPress={() => router.replace("/plan")}
					>
						<Text style={styles.newTripText}>Plan a new trip →</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.homeBtn}
						onPress={() => router.replace("/")}
					>
						<Text style={styles.homeBtnText}>Back to home</Text>
					</TouchableOpacity>
				</View>

				<View style={{ height: 48 }} />
			</Animated.ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: BG },
	container: { padding: 24 },
	loadingContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 16,
	},
	loadingText: { color: "#555555", fontSize: 14, fontWeight: "400" },

	// Top bar
	topBar: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 32,
	},
	backBtn: { minHeight: 44, justifyContent: "center" },
	backText: { fontSize: 14, color: "#555555", fontWeight: "400" },
	endedChip: {
		backgroundColor: "rgba(255,255,255,0.06)",
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.1)",
		borderRadius: 20,
		paddingHorizontal: 12,
		paddingVertical: 5,
	},
	endedChipText: {
		fontSize: 10,
		fontWeight: "700",
		letterSpacing: 1.5,
		color: "#555555",
	},

	// Hero
	hero: { marginBottom: 28 },
	eyebrow: {
		fontSize: 10,
		fontWeight: "700",
		letterSpacing: 3,
		color: AMBER,
		marginBottom: 10,
	},
	tripTitle: {
		fontSize: 36,
		fontWeight: "200",
		color: "#ffffff",
		letterSpacing: -0.5,
		lineHeight: 42,
		marginBottom: 6,
	},
	tripDate: { fontSize: 13, color: "#555555", fontWeight: "400" },

	// Stats
	statsCard: {
		flexDirection: "row",
		backgroundColor: CARD_BG,
		borderWidth: 1,
		borderColor: CARD_BORDER,
		borderRadius: 20,
		paddingVertical: 20,
		paddingHorizontal: 8,
		marginBottom: 12,
	},
	statItem: { alignItems: "center", flex: 1 },
	statIcon: { fontSize: 18, marginBottom: 6 },
	statValue: {
		fontSize: 16,
		fontWeight: "700",
		color: "#ffffff",
		marginBottom: 3,
		letterSpacing: -0.3,
	},
	statLabel: { fontSize: 9, color: "#444444", letterSpacing: 0.8, fontWeight: "600" },

	// Fuel savings
	savingsCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		backgroundColor: "rgba(245,158,11,0.08)",
		borderWidth: 1,
		borderColor: "rgba(245,158,11,0.2)",
		borderRadius: 16,
		padding: 16,
		marginBottom: 32,
	},
	savingsIcon: { fontSize: 26 },
	savingsTextBlock: { flex: 1 },
	savingsTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: AMBER,
		marginBottom: 3,
	},
	savingsSub: { fontSize: 12, color: "#555555", fontWeight: "400" },

	// Section label
	sectionLabel: {
		fontSize: 10,
		fontWeight: "700",
		letterSpacing: 2,
		color: "#333333",
		marginBottom: 16,
	},

	// Timeline
	timeline: { marginBottom: 32 },
	timelineItem: {
		flexDirection: "row",
		gap: 14,
		alignItems: "flex-start",
	},
	timelineLeft: { width: 20, alignItems: "center", marginTop: 4 },
	timelineDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
	},
	timelineConnector: { paddingLeft: 7, minHeight: 28 },
	timelineLine: {
		width: 1.5,
		minHeight: 28,
		backgroundColor: "rgba(255,255,255,0.06)",
		marginVertical: 3,
	},
	timelineContent: { flex: 1, paddingBottom: 6 },
	timelineStopName: {
		fontSize: 14,
		fontWeight: "500",
		color: "#ffffff",
		marginBottom: 3,
	},
	stopNamePassed: { color: "#888888" },
	stopNameCancelled: {
		color: "#dc2626",
		textDecorationLine: "line-through",
	},
	timelineStopMeta: { fontSize: 12, color: "#444444", fontWeight: "400" },

	// Actions
	actions: { gap: 10, marginTop: 8 },
	shareBtn: {
		backgroundColor: "rgba(245,158,11,0.10)",
		borderWidth: 1,
		borderColor: "rgba(245,158,11,0.22)",
		borderRadius: 16,
		padding: 15,
		alignItems: "center",
	},
	shareBtnText: { fontSize: 14, fontWeight: "600", color: AMBER },
	newTripBtn: {
		backgroundColor: AMBER,
		borderRadius: 16,
		padding: 15,
		alignItems: "center",
		shadowColor: AMBER,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 12,
		elevation: 6,
	},
	newTripText: { fontSize: 14, fontWeight: "700", color: "#0c0b0a" },
	homeBtn: { padding: 14, alignItems: "center" },
	homeBtnText: { fontSize: 13, color: "#444444", fontWeight: "400" },
});
