import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { Colors, FontSize, FontWeight, Radius, Shadows, Spacing, Sizing } from "../constants/theme";

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

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  }

  const isGhost = variant === "ghost";
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  const shadowStyle = isPrimary || isDanger ? Shadows.glow : {};
  const bgStyle = isPrimary
    ? styles.primary
    : isDanger
      ? styles.danger
      : styles.ghost;

  const labelStyle = isGhost ? styles.labelGhost : styles.label;

  return (
    <Animated.View style={[styles.animated, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[styles.base, bgStyle, shadowStyle, (disabled || loading) && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={isGhost ? Colors.textSecondary : "#fff"} size="small" />
        ) : (
          <Text style={labelStyle}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animated: { alignSelf: "stretch" },
  base: {
    borderRadius: Radius.lg,
    minHeight: Sizing.touchTarget,
    paddingVertical: Spacing.buttonY,
    paddingHorizontal: Spacing.buttonX,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  ghost: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  danger: {
    backgroundColor: Colors.danger,
  },
  disabled: { opacity: 0.45 },
  label: {
    color: "#ffffff",
    fontSize: FontSize.md,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  labelGhost: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.2,
  },
});
