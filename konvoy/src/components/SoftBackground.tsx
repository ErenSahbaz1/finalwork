import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";

/**
 * Simulates a soft radial gradient highlight on the background.
 * Because React Native lacks native radial gradients, we layer 3 concentric
 * circles with progressively lower opacity to feather the edge.
 *
 * The result is a barely-there glow behind content, not a visible blob.
 */
export function SoftBackground() {
	const { width, height } = useWindowDimensions();
	// Anchor the glow above the screen center so it reads as light coming
	// from the top of the device. Diameter is sized off the larger axis.
	const diameter = Math.max(width, height) * 0.9;
	const radius = diameter / 2;
	const centerX = width / 2;
	const centerY = height * 0.32;

	const layers = [
		{ scale: 1.0, opacity: 0.12 },
		{ scale: 0.72, opacity: 0.18 },
		{ scale: 0.45, opacity: 0.22 },
	];

	return (
		<View pointerEvents="none" style={StyleSheet.absoluteFill}>
			{layers.map((layer, i) => {
				const d = diameter * layer.scale;
				return (
					<View
						key={i}
						style={{
							position: "absolute",
							width: d,
							height: d,
							borderRadius: d / 2,
							left: centerX - d / 2,
							top: centerY - d / 2,
							backgroundColor: `rgba(255,255,255,${layer.opacity})`,
						}}
					/>
				);
			})}
		</View>
	);
}
