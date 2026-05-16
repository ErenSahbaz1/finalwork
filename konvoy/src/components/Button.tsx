import React, { useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	Pressable,
	StyleSheet,
	Text,
	ViewStyle,
} from "react-native";
import {
	Colors,
	FontSize,
	FontWeight,
	Radius,
	Shadow,
	Spacing,
	Sizing,
} from "../constants/theme";
import { NeumorphicView } from "./NeumorphicView";

interface ButtonProps {
	label: string;
	onPress: () => void;
	variant?: "primary" | "ghost" | "danger";
	loading?: boolean;
	disabled?: boolean;
	style?: ViewStyle;
}

export function Button({
	label,
	onPress,
	variant = "primary",
	loading,
	disabled,
	style,
}: ButtonProps) {
	const scale = useRef(new Animated.Value(1)).current;
	const [pressed, setPressed] = useState(false);
	const isGhost = variant === "ghost";

	function handlePressIn() {
		setPressed(true);
		Animated.spring(scale, {
			toValue: 0.96,
			useNativeDriver: true,
		}).start();
	}

	function handlePressOut() {
		setPressed(false);
		Animated.spring(scale, {
			toValue: 1,
			useNativeDriver: true,
		}).start();
	}

	const labelColor = isGhost ? Colors.textPrimary : Colors.bgElevated;

	const content = (
		<Pressable
			onPress={onPress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			disabled={disabled || loading}
			style={styles.pressable}
		>
			{loading ? (
				<ActivityIndicator color={labelColor} size="small" />
			) : (
				<Text style={[styles.label, isGhost && styles.labelGhost]}>
					{label}
				</Text>
			)}
		</Pressable>
	);

	if (isGhost) {
		return (
			<Animated.View
				style={[styles.animated, { transform: [{ scale }] }, style]}
			>
				<NeumorphicView
					pressed={pressed}
					style={[
						styles.base,
						styles.ghost,
						(disabled || loading) && styles.disabled,
					]}
				>
					{content}
				</NeumorphicView>
			</Animated.View>
		);
	}

	return (
		<Animated.View style={[styles.animated, { transform: [{ scale }] }, style]}>
			<Pressable
				onPress={onPress}
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
				disabled={disabled || loading}
				style={[
					styles.base,
					styles.pressable,
					styles[variant],
					Shadow.shadowFloat,
					(disabled || loading) && styles.disabled,
				]}
			>
				{loading ? (
					<ActivityIndicator color={Colors.bgElevated} size="small" />
				) : (
					<Text style={styles.label}>{label}</Text>
				)}
			</Pressable>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	animated: {
		alignSelf: "stretch",
	},
	pressable: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: Sizing.touchTarget,
		paddingVertical: Spacing.buttonY,
		paddingHorizontal: Spacing.buttonX,
	},
	base: {
		borderRadius: Radius.full,
		minHeight: Sizing.touchTarget,
	},
	primary: {
		backgroundColor: Colors.primary,
	},
	ghost: {
		backgroundColor: Colors.bg,
		borderWidth: 1,
		borderColor: Colors.primaryBorder,
	},
	danger: {
		backgroundColor: Colors.danger,
	},
	disabled: {
		opacity: 0.6,
	},
	label: {
		color: Colors.bgElevated,
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
		letterSpacing: 0.2,
	},
	labelGhost: {
		color: Colors.textPrimary,
		fontWeight: FontWeight.medium,
	},
});
