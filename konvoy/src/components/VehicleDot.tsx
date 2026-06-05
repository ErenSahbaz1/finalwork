import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, FontWeight, Shadows } from "../constants/theme";

interface VehicleDotProps {
  color: string;
  label?: string;
  size?: number;
  isLeader?: boolean;
  isWeak?: boolean;
  withRing?: boolean;
}

export function VehicleDot({
  color,
  label,
  size = 44,
  isLeader,
  isWeak,
  withRing,
}: VehicleDotProps) {
  const radius = size / 2;
  const leaderSize = size + 14;
  const whiteRingSize = size + 4;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          opacity: isWeak ? 0.35 : 1,
        },
      ]}
    >
      {withRing && (
        <View
          style={[
            styles.outerRing,
            {
              width: whiteRingSize,
              height: whiteRingSize,
              borderRadius: whiteRingSize / 2,
              top: -2,
              left: -2,
              borderColor: "rgba(255,255,255,0.3)",
            },
          ]}
        />
      )}
      {isLeader && (
        <View
          style={[
            styles.outerRing,
            {
              width: leaderSize,
              height: leaderSize,
              borderRadius: leaderSize / 2,
              top: -7,
              left: -7,
              borderColor: color + "80",
              borderWidth: 2,
            },
          ]}
        />
      )}

      <View
        style={[
          styles.dot,
          Shadows.glowVehicle(color),
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: color,
          },
        ]}
      >
        {label ? (
          <Text
            style={[styles.label, { fontSize: size * 0.36, lineHeight: size }]}
          >
            {label.charAt(0).toUpperCase()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  outerRing: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  label: {
    color: "#ffffff",
    fontWeight: FontWeight.semibold,
    textAlign: "center",
    includeFontPadding: false,
  },
});
