import React, { useCallback, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	ScrollView,
	ActivityIndicator,
	Animated,
	Pressable,
} from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { Button } from "../src/components/Button";
import { FadeInView } from "../src/components/FadeInView";
import { NeumorphicView } from "../src/components/NeumorphicView";
import { SoftBackground } from "../src/components/SoftBackground";
import { StaggeredFadeIn } from "../src/components/StaggeredFadeIn";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Spacing,
	Sizing,
} from "../src/constants/theme";
import type { ConvoyStatus, MemberRole } from "../src/types";
import { useUserStore } from "../src/store/userStore";

interface ActiveConvoy {
	id: string;
	title: string;
	status: ConvoyStatus;
	invite_code: string;
	starts_at: string | null;
	created_at: string;
	role: MemberRole;
	member_count: number;
}

const STATUS_LABEL: Record<ConvoyStatus, string> = {
	preparation: "Preparation",
	driving: "Driving",
	paused: "Paused",
	ended: "Ended",
};

const ROLE_LABEL: Record<MemberRole, string> = {
	leader: "Leader",
	co_leader: "Co-leader",
	member: "Member",
};

function ConvoyCard({
	convoy,
	index,
	onPress,
}: {
	convoy: ActiveConvoy;
	index: number;
	onPress: () => void;
}) {
	const scale = useRef(new Animated.Value(1)).current;

	const handlePressIn = () => {
		Animated.spring(scale, {
			toValue: 0.98,
			useNativeDriver: true,
			speed: 24,
			bounciness: 0,
		}).start();
	};

	const handlePressOut = () => {
		Animated.spring(scale, {
			toValue: 1,
			useNativeDriver: true,
			speed: 24,
			bounciness: 0,
		}).start();
	};

	return (
		<StaggeredFadeIn index={index}>
			<Animated.View style={{ transform: [{ scale }] }}>
				<Pressable
					onPress={onPress}
					onPressIn={handlePressIn}
					onPressOut={handlePressOut}
					hitSlop={8}
				>
					<NeumorphicView style={styles.convoyCard}>
						<View style={styles.cardTopRow}>
							<Text style={styles.convoyTitle} numberOfLines={1}>
								{convoy.title}
							</Text>
							<NeumorphicView
								pressed
								style={[
									styles.statusChip,
									convoy.status === "preparation" && styles.statusPreparation,
									convoy.status === "driving" && styles.statusDriving,
									convoy.status === "paused" && styles.statusPaused,
								]}
							>
								<Text
									style={[
										styles.statusChipText,
										convoy.status === "driving" && styles.statusChipTextOnDark,
									]}
								>
									{STATUS_LABEL[convoy.status]}
								</Text>
							</NeumorphicView>
						</View>

						<View style={styles.cardBottomRow}>
							<Text style={styles.metaText}>
								{convoy.member_count}{" "}
								{convoy.member_count === 1 ? "member" : "members"}
							</Text>
							<NeumorphicView
								style={[
									styles.roleChip,
									convoy.role === "leader" && styles.roleLeader,
									convoy.role === "co_leader" && styles.roleCoLeader,
									convoy.role === "member" && styles.roleMember,
								]}
							>
								<Text
									style={[
										styles.roleChipText,
										convoy.role === "leader" && styles.roleChipTextOnDark,
									]}
								>
									{ROLE_LABEL[convoy.role]}
								</Text>
							</NeumorphicView>
						</View>
					</NeumorphicView>
				</Pressable>
			</Animated.View>
		</StaggeredFadeIn>
	);
}

export default function HomeScreen() {
	const router = useRouter();
	const userId = useUserStore((s) => s.userId);
	const isOnboarded = useUserStore((s) => s.isOnboarded);
	const [convoys, setConvoys] = useState<ActiveConvoy[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		if (!userId) return;
		setError("");
		try {
			const { data, error: e } = await supabase
				.from("convoy_members")
				.select(
					"role, convoy:convoy_id ( id, title, status, invite_code, starts_at, created_at )",
				)
				.eq("user_id", userId);
			if (e) throw e;

			const rows = (data ?? [])
				.map((row: any) => {
					if (!row.convoy) return null;
					return {
						id: row.convoy.id,
						title: row.convoy.title,
						status: row.convoy.status as ConvoyStatus,
						invite_code: row.convoy.invite_code,
						starts_at: row.convoy.starts_at,
						created_at: row.convoy.created_at,
						role: row.role as MemberRole,
					};
				})
				.filter(
					(r): r is Omit<ActiveConvoy, "member_count"> =>
						!!r && r.status !== "ended",
				)
				.sort((a, b) => b.created_at.localeCompare(a.created_at));

			if (rows.length === 0) {
				setConvoys([]);
				return;
			}

			const ids = rows.map((r) => r.id);
			const { data: counts, error: ce } = await supabase
				.from("convoy_members")
				.select("convoy_id")
				.in("convoy_id", ids);
			if (ce) throw ce;

			const tally: Record<string, number> = {};
			for (const c of counts ?? []) {
				const cid = (c as any).convoy_id;
				tally[cid] = (tally[cid] ?? 0) + 1;
			}

			setConvoys(rows.map((r) => ({ ...r, member_count: tally[r.id] ?? 1 })));
		} catch (e: any) {
			setError(e?.message ?? "Couldn't load your convoys.");
			setConvoys([]);
		} finally {
			setLoading(false);
		}
	}, [userId]);

	useFocusEffect(
		useCallback(() => {
			if (!userId) return;
			setLoading(true);
			load();
		}, [load, userId]),
	);

	function openConvoy(c: ActiveConvoy) {
		if (c.status === "preparation") {
			router.push(`/convoy/${c.id}/lobby`);
		} else {
			router.push(`/convoy/${c.id}/map`);
		}
	}

	// First-run: send the user through onboarding before showing the home.
	// Placed after hooks so we never violate the rules of hooks when the flag flips.
	if (!isOnboarded) {
		return <Redirect href="/onboarding" />;
	}

	return (
		<SafeAreaView style={styles.safe}>
			<SoftBackground />
			<FadeInView style={styles.fade}>
				<ScrollView
					contentContainerStyle={styles.container}
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.header}>
						<Text style={styles.logo}>Konvoy</Text>
						<Pressable
							onPress={() => router.push("/settings")}
							hitSlop={10}
							style={styles.settingsBtn}
						>
							<NeumorphicView style={styles.settingsPill}>
								<Text style={styles.settingsText}>Settings</Text>
							</NeumorphicView>
						</Pressable>
					</View>

					<View style={styles.hero}>
						<Text style={styles.heroText}>Ready to roll?</Text>
						<Text style={styles.heroSub}>
							Start a convoy or join one with an invite code.
						</Text>
					</View>

					<View style={styles.actions}>
						<Button
							label="Start a convoy"
							onPress={() => router.push("/convoy/create")}
						/>
						<Button
							label="Join a convoy"
							variant="ghost"
							onPress={() => router.push("/convoy/join")}
						/>
					</View>

					<View style={styles.section}>
						<Text style={styles.sectionTitle}>Your convoys</Text>

						{loading ? (
							<View style={styles.loadingBox}>
								<ActivityIndicator color={Colors.primary} />
							</View>
						) : error ? (
							<NeumorphicView style={styles.errorBox}>
								<Text style={styles.errorText}>{error}</Text>
							</NeumorphicView>
						) : convoys.length === 0 ? (
							<View style={styles.emptyState}>
								<Text style={styles.emptyTitle}>No convoys yet</Text>
								<Text style={styles.emptyText}>
									Start your first one to get going.
								</Text>
							</View>
						) : (
							<View style={styles.list}>
								{convoys.map((c, index) => (
									<ConvoyCard
										key={c.id}
										convoy={c}
										index={index}
										onPress={() => openConvoy(c)}
									/>
								))}
							</View>
						)}
					</View>
				</ScrollView>
			</FadeInView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: Colors.bg },
	fade: { flex: 1 },
	container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.xl,
	},
	logo: {
		fontSize: FontSize.xl,
		fontWeight: FontWeight.thin,
		color: Colors.textPrimary,
		letterSpacing: -0.6,
	},
	settingsBtn: { paddingLeft: Spacing.sm },
	settingsPill: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.full,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
		minHeight: Sizing.touchTarget,
		justifyContent: "center",
	},
	settingsText: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.medium,
		letterSpacing: 0.4,
	},
	hero: { marginBottom: Spacing.xl },
	heroText: {
		fontSize: FontSize.xxl,
		fontWeight: FontWeight.light,
		color: Colors.textPrimary,
		letterSpacing: -0.6,
	},
	heroSub: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		marginTop: Spacing.sm,
		fontWeight: FontWeight.regular,
		lineHeight: 22,
	},
	actions: { gap: Spacing.md, marginBottom: Spacing.xxl },

	section: { marginTop: Spacing.lg },
	sectionTitle: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		marginBottom: Spacing.md,
		textTransform: "uppercase",
		letterSpacing: 1.4,
	},

	loadingBox: {
		paddingVertical: Spacing.xl,
		alignItems: "center",
		justifyContent: "center",
	},
	errorBox: {
		backgroundColor: "rgba(220,38,38,0.08)",
		borderRadius: Radius.lg,
		padding: Spacing.md,
	},
	errorText: {
		fontSize: FontSize.sm,
		color: Colors.danger,
		fontWeight: FontWeight.medium,
	},

	list: { gap: Spacing.md },
	convoyCard: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.xl,
		padding: Spacing.lg,
		gap: Spacing.md,
	},
	cardTopRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.sm,
	},
	convoyTitle: {
		flex: 1,
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
		letterSpacing: -0.3,
	},
	cardBottomRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	metaText: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		fontWeight: FontWeight.medium,
	},

	// Status chip
	statusChip: {
		paddingHorizontal: Spacing.sm,
		paddingVertical: 6,
		borderRadius: Radius.full,
	},
	statusChipText: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.6,
		color: Colors.textSecondary,
	},
	statusChipTextOnDark: { color: Colors.bgElevated },
	statusPreparation: { backgroundColor: Colors.bgElevated },
	statusDriving: { backgroundColor: Colors.primary },
	statusPaused: { backgroundColor: Colors.primaryDim },

	// Role chip
	roleChip: {
		paddingHorizontal: Spacing.sm,
		paddingVertical: 6,
		borderRadius: Radius.full,
	},
	roleChipText: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.6,
		color: Colors.textSecondary,
	},
	roleChipTextOnDark: { color: Colors.bgElevated },
	roleLeader: { backgroundColor: Colors.primary },
	roleCoLeader: { backgroundColor: Colors.primaryDim },
	roleMember: { backgroundColor: Colors.bgElevated },

	emptyState: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Spacing.xxl,
		gap: Spacing.sm,
	},
	emptyTitle: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
		color: Colors.textPrimary,
	},
	emptyText: {
		fontSize: FontSize.sm,
		color: Colors.textMuted,
		textAlign: "center",
		lineHeight: 20,
		fontWeight: FontWeight.regular,
	},
});
