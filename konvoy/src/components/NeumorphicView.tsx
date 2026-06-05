import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Colors, Radius } from "../constants/theme";

interface NeumorphicViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressed?: boolean;
}

/**
 * Glass card component — dark-theme replacement for the neumorphic effect.
 * `pressed` renders a slightly darker inset appearance for interactive states.
 */
export function NeumorphicView({
  children,
  style,
  pressed = false,
}: NeumorphicViewProps) {
  const flatStyle = StyleSheet.flatten(style) ?? {};
  const radius =
    typeof flatStyle.borderRadius === "number" ? flatStyle.borderRadius : Radius.lg;

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

  const outerLayout = {
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

  const baseCard = pressed ? styles.pressed : styles.raised;

  return (
    <View style={[baseCard, { borderRadius: radius }, outerLayout]}>
      <View style={[{ borderRadius: radius }, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  raised: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  pressed: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
});
