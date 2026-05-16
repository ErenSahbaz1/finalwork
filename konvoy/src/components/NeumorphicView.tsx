import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Colors, Radius, Shadow } from "../constants/theme";

interface NeumorphicViewProps {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	pressed?: boolean;
}

export function NeumorphicView({
	children,
	style,
	pressed = false,
}: NeumorphicViewProps) {
	const flatStyle = StyleSheet.flatten(style) ?? {};
	const radius =
		typeof flatStyle.borderRadius === "number"
			? flatStyle.borderRadius
			: Radius.lg;
	const backgroundColor =
		typeof flatStyle.backgroundColor === "string"
			? flatStyle.backgroundColor
			: Colors.bgCard;

	// Outer wrapper carries layout-side properties (margin, position, flex sizing)
	// so the component behaves like a single box in its parent layout.
	// Inner View carries the user's content-side styles (padding, flexDirection,
	// alignItems, gap, etc.) so children lay out correctly.
	const {
		margin,
		marginTop,
		marginBottom,
		marginLeft,
		marginRight,
		marginHorizontal,
		marginVertical,
		alignSelf,
		flex,
		flexGrow,
		flexShrink,
		flexBasis,
		width,
		height,
		minWidth,
		minHeight,
		maxWidth,
		maxHeight,
		position,
		top,
		bottom,
		left,
		right,
		zIndex,
		...innerStyle
	} = flatStyle as any;

	const outerLayoutStyle = {
		margin,
		marginTop,
		marginBottom,
		marginLeft,
		marginRight,
		marginHorizontal,
		marginVertical,
		alignSelf,
		flex,
		flexGrow,
		flexShrink,
		flexBasis,
		width,
		height,
		minWidth,
		minHeight,
		maxWidth,
		maxHeight,
		position,
		top,
		bottom,
		left,
		right,
		zIndex,
	};

	if (pressed) {
		return (
			<View
				style={[
					styles.insetOuter,
					{ borderRadius: radius, backgroundColor },
					outerLayoutStyle,
				]}
			>
				<View
					style={[
						styles.insetInner,
						{ borderRadius: radius, backgroundColor },
						innerStyle,
					]}
				>
					{children}
				</View>
			</View>
		);
	}

	return (
		<View
			style={[
				styles.raisedLight,
				{ borderRadius: radius, backgroundColor },
				outerLayoutStyle,
			]}
		>
			<View
				style={[
					styles.raisedDark,
					{ borderRadius: radius, backgroundColor },
					innerStyle,
				]}
			>
				{children}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	raisedLight: {
		backgroundColor: Colors.bgCard,
		...Shadow.shadowRaised,
	},
	raisedDark: {
		backgroundColor: Colors.bgCard,
		...Shadow.shadowRaisedDark,
	},
	insetOuter: {
		backgroundColor: Colors.bg,
	},
	insetInner: {
		...Shadow.shadowInset,
	},
});
