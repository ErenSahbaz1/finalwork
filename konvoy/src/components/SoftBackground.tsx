import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";

/**
 * Ambient red orb glow effect for dark-themed screens.
 * Positioned top-right to create depth without obscuring content.
 */
export function SoftBackground() {
  const { width } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Primary red orb — top right */}
      <View
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: "rgba(220,38,38,0.07)",
        }}
      />
      {/* Secondary softer orb — slightly offset */}
      <View
        style={{
          position: "absolute",
          top: 40,
          right: 20,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(220,38,38,0.04)",
        }}
      />
    </View>
  );
}
