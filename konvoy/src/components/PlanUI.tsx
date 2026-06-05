// ─── Shared building blocks for the trip-planning wizard ──────────────────────
// Keeps each step file slim by hoisting the bits used in 2+ steps.
// ──────────────────────────────────────────────────────────────────────────────

import React from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ViewStyle,
} from "react-native";
import { NeumorphicView } from "./NeumorphicView";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Sizing,
	Spacing,
} from "../constants/theme";

// ── Progress dots ─────────────────────────────────────────────────────────────

export function ProgressDots({
	current,
	total = 5,
}: {
	current: number;
	total?: number;
}) {
	return (
		<View style={progressStyles.row}>
			{Array.from({ length: total }, (_, i) => i + 1).map((step) => {
				const done = current > step;
				const active = current === step;
				return (
					<View
						key={step}
						style={[
							progressStyles.dot,
							done && progressStyles.dotDone,
							active && progressStyles.dotActive,
						]}
					/>
				);
			})}
		</View>
	);
}

const progressStyles = StyleSheet.create({
	row: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.xs,
		marginBottom: Spacing.xxl,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: Colors.primaryDim,
	},
	dotActive: { width: 22, borderRadius: 3, backgroundColor: Colors.primary },
	dotDone: { width: 6, backgroundColor: Colors.textPrimary },
});

// ── Stepper (−  number  +) ────────────────────────────────────────────────────

export function Stepper({
	value,
	onChange,
	min = 1,
	max = 99,
	unit,
}: {
	value: number;
	onChange: (n: number) => void;
	min?: number;
	max?: number;
	unit?: string;
}) {
	const dec = () => onChange(Math.max(min, value - 1));
	const inc = () => onChange(Math.min(max, value + 1));
	return (
		<View style={stepperStyles.row}>
			<TouchableOpacity
				onPress={dec}
				disabled={value <= min}
				activeOpacity={0.85}
				style={stepperStyles.btnTap}
			>
				<View style={[stepperStyles.btn, value <= min && stepperStyles.btnDisabled]}>
					<Text style={stepperStyles.btnText}>−</Text>
				</View>
			</TouchableOpacity>
			<View style={stepperStyles.valueBox}>
				<Text style={stepperStyles.value}>
					{value}
					{unit ? ` ${unit}` : ""}
				</Text>
			</View>
			<TouchableOpacity
				onPress={inc}
				disabled={value >= max}
				activeOpacity={0.85}
				style={stepperStyles.btnTap}
			>
				<View style={[stepperStyles.btn, value >= max && stepperStyles.btnDisabled]}>
					<Text style={stepperStyles.btnText}>+</Text>
				</View>
			</TouchableOpacity>
		</View>
	);
}

const stepperStyles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		marginBottom: Spacing.xl,
	},
	btnTap: { borderRadius: Radius.full },
	btn: {
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: Colors.bgElevated,
		alignItems: "center",
		justifyContent: "center",
	},
	btnDisabled: { opacity: 0.4 },
	btnText: {
		fontSize: 28,
		color: Colors.textPrimary,
		fontWeight: FontWeight.regular,
		lineHeight: 30,
	},
	valueBox: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		minHeight: Sizing.touchTarget,
	},
	value: {
		fontSize: FontSize.xxl,
		fontWeight: FontWeight.light,
		color: Colors.textPrimary,
		letterSpacing: -0.5,
	},
});

// ── Chip ──────────────────────────────────────────────────────────────────────

export function Chip({
	label,
	selected,
	onPress,
	icon,
	style,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	icon?: string;
	style?: ViewStyle;
}) {
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.85}
			style={[chipStyles.tap, style]}
		>
			<NeumorphicView
				pressed={selected}
				style={[chipStyles.base, selected && chipStyles.selected]}
			>
				<Text
					style={[
						chipStyles.label,
						selected && chipStyles.labelSelected,
					]}
				>
					{icon ? `${icon}  ` : ""}
					{label}
				</Text>
			</NeumorphicView>
		</TouchableOpacity>
	);
}

const chipStyles = StyleSheet.create({
	tap: {},
	base: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.full,
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.md,
		minHeight: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	selected: {
		backgroundColor: Colors.primary,
	},
	label: {
		fontSize: FontSize.sm,
		color: Colors.textSecondary,
		fontWeight: FontWeight.medium,
	},
	labelSelected: {
		color: Colors.textPrimary,
		fontWeight: FontWeight.semibold,
	},
});

// ── Section label (uppercase muted caption) ───────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
	return <Text style={labelStyles.label}>{children}</Text>;
}

const labelStyles = StyleSheet.create({
	label: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.semibold,
		color: Colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: 1.4,
		marginBottom: Spacing.sm,
		marginTop: Spacing.lg,
	},
});

// ── Step shell (title + sub + body) ───────────────────────────────────────────

export function StepHeader({
	step,
	title,
	sub,
}: {
	step: number;
	title: string;
	sub?: string;
}) {
	return (
		<>
			<ProgressDots current={step} />
			<Text style={headerStyles.title}>{title}</Text>
			{sub ? <Text style={headerStyles.sub}>{sub}</Text> : null}
		</>
	);
}

const headerStyles = StyleSheet.create({
	title: {
		fontSize: FontSize.xxl,
		fontWeight: FontWeight.light,
		color: Colors.textPrimary,
		marginBottom: Spacing.sm,
		letterSpacing: -0.5,
	},
	sub: {
		fontSize: FontSize.md,
		color: Colors.textMuted,
		lineHeight: 22,
		marginBottom: Spacing.xl,
		fontWeight: FontWeight.regular,
	},
});
