import { Platform } from "react-native";

export const Colors = {
  primary: "#dc2626",
  primaryDim: "rgba(220,38,38,0.12)",
  primaryBorder: "rgba(220,38,38,0.25)",
  primaryGlow: "rgba(220,38,38,0.4)",

  bg: "#0a0a0a",
  bgCard: "rgba(255,255,255,0.04)",
  bgElevated: "rgba(255,255,255,0.07)",
  bgAccent: "rgba(220,38,38,0.08)",

  textPrimary: "#ffffff",
  textSecondary: "#888888",
  textMuted: "#444444",

  border: "rgba(255,255,255,0.08)",
  borderSubtle: "rgba(255,255,255,0.04)",
  borderAccent: "rgba(220,38,38,0.3)",

  vehicleGreen: "#16a34a",
  vehicleBlue: "#2563eb",
  vehicleOrange: "#ea580c",
  vehiclePink: "#db2777",
  vehiclePurple: "#7c3aed",
  vehicleYellow: "#d97706",

  danger: "#dc2626",
  warning: "#d97706",
  info: "#2563eb",
  success: "#16a34a",
  online: "#16a34a",

  overlay: "rgba(10,10,10,0.96)",
  spotlight: "rgba(255,255,255,0.05)",
};

export const Spacing = {
  xxs: 4,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  buttonY: 14,
  buttonX: 28,
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 17,
  xl: 20,
  xxl: 26,
  display: 34,
};

export const FontWeight = {
  thin: "200",
  light: "300",
  regular: "400",
  medium: "500",
  semibold: "600",
} as const;

// ─── New Shadows (glass/glow system) ──────────────────────────────────────────
export const Shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: {
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 0,
  },
  glowSm: {
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 0,
  },
  glowVehicle: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  }),
};

// ─── Backward-compatible Shadow alias ─────────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  shadowRaised: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  shadowRaisedDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  shadowInset: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 1,
  },
  shadowFloat: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 7,
  },
};

export const Sizing = {
  touchTarget: 44,
  dot: 8,
};

export const Mono = Platform.OS === "ios" ? "Courier" : "monospace";
