import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface VehicleDotProps {
  color: string;
  label?: string;
  size?: number;
  isLeader?: boolean;
  isWeak?: boolean;
}

export function VehicleDot({ color, label, size = 36, isLeader, isWeak }: VehicleDotProps) {
  return (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: isWeak ? 0.5 : 1 }]}>
      {isLeader && (
        <View style={[styles.leaderRing, { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2 }]} />
      )}
      {label && (
        <Text style={[styles.label, { fontSize: size * 0.33 }]}>{label.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  leaderRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#33a86d',
  },
  label: {
    color: '#fff',
    fontWeight: '700',
  },
});
