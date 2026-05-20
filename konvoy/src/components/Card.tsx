import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Colors, Radius, Spacing } from "../constants/theme";
import { NeumorphicView } from "./NeumorphicView";

interface CardProps {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	accent?: boolean; // black left border
}

export function Card({ children, style, accent }: CardProps) {
	return (
		<NeumorphicView style={[styles.card, accent && styles.accent, style]}>
			{children}
		</NeumorphicView>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: Colors.bgCard,
		borderRadius: Radius.xl,
		padding: Spacing.lg,
	},
	accent: {
		backgroundColor: Colors.bgElevated,
	},
});
