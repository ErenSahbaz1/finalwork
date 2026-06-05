import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Colors, Radius, Shadows, Spacing } from "../constants/theme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean; // red-glow accent card
}

export function Card({ children, style, accent }: CardProps) {
  if (accent) {
    return (
      <View style={[styles.accent, Shadows.glow, style]}>
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.card, Shadows.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accent: {
    backgroundColor: Colors.bgAccent,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
});
