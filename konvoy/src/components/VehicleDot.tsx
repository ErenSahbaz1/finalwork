import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontWeight, Shadow } from '../constants/theme';

interface VehicleDotProps {
  color: string;
  label?: string;
  size?: number;
  isLeader?: boolean;
  isWeak?: boolean;
  withRing?: boolean; // white outer ring (for map markers)
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
  const leaderSize = size + 10;
  const whiteRingSize = size + 4;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          opacity: isWeak ? 0.6 : 1,
        },
      ]}
    >
      {/* White ring (siblings, absolutely positioned, so they can extend
          outside the dot's `overflow: hidden` clip region). */}
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
              borderColor: Colors.bgElevated,
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
              top: -5,
              left: -5,
              borderColor: Colors.primary,
            },
          ]}
        />
      )}

      {/* The dot itself — a perfect circle with the label centered. */}
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: color,
          },
        ]}
      >
        {label ? (
          <Text style={[styles.label, { fontSize: size * 0.36, lineHeight: size }]}>
            {label.charAt(0).toUpperCase()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadow.shadowRaisedDark,
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  label: {
    color: Colors.bgElevated,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
