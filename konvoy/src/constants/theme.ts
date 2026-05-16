import { Platform } from "react-native";

export const Colors = {
	primary: "#1a1a1a",
	primaryDim: "rgba(0,0,0,0.06)",
	primaryBorder: "rgba(0,0,0,0.08)",

	bg: "#efefef",
	bgCard: "#f5f5f5",
	bgElevated: "#ffffff",

	textPrimary: "#1a1a1a",
	textSecondary: "#555555",
	textMuted: "#999999",

	border: "transparent",
	borderSubtle: "rgba(0,0,0,0.04)",

	vehicleGreen: "#16a34a",
	vehicleBlue: "#2563eb",
	vehicleOrange: "#ea580c",
	vehiclePink: "#db2777",
	vehiclePurple: "#7c3aed",
	vehicleYellow: "#d97706",

	danger: "#dc2626",
	warning: "#d97706",
	info: "#2563eb",
	online: "#16a34a",

	overlay: "rgba(239,239,239,0.96)",
	spotlight: "rgba(255,255,255,0.5)",
};

export const Spacing = {
	xxs: 4,
	xs: 8,
	sm: 12,
	md: 16,
	lg: 24,
	xl: 32,
	xxl: 40,
	buttonY: 14,
	buttonX: 28,
};

export const Radius = {
	sm: 10,
	md: 14,
	lg: 20,
	xl: 24,
	full: 999,
};

export const FontSize = {
	xs: 11,
	sm: 13,
	md: 16,
	lg: 20,
	xl: 24,
	xxl: 30,
	display: 48,
};

export const FontWeight = {
	thin: "200",
	light: "300",
	regular: "400",
	medium: "500",
	semibold: "600",
} as const;

export const Shadow = {
	shadowRaised: {
		shadowColor: "#ffffff",
		shadowOffset: { width: -4, height: -4 },
		shadowOpacity: 0.8,
		shadowRadius: 8,
		elevation: 0,
	},
	shadowRaisedDark: {
		shadowColor: "#b0b0b0",
		shadowOffset: { width: 4, height: 4 },
		shadowOpacity: 0.5,
		shadowRadius: 8,
		elevation: 4,
	},
	shadowInset: {
		backgroundColor: "#efefef",
		shadowColor: "#b0b0b0",
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 0.4,
		shadowRadius: 4,
		elevation: 0,
	},
	shadowFloat: {
		shadowColor: "#b0b0b0",
		shadowOffset: { width: 6, height: 6 },
		shadowOpacity: 0.4,
		shadowRadius: 12,
		elevation: 6,
	},

	// Convenience aliases
	sm: {
		shadowColor: "#b0b0b0",
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 2,
	},
	md: {
		shadowColor: "#b0b0b0",
		shadowOffset: { width: 4, height: 4 },
		shadowOpacity: 0.35,
		shadowRadius: 8,
		elevation: 4,
	},
	lg: {
		shadowColor: "#b0b0b0",
		shadowOffset: { width: 6, height: 8 },
		shadowOpacity: 0.4,
		shadowRadius: 16,
		elevation: 8,
	},
};

export const Sizing = {
	touchTarget: 44,
	dot: 8,
};

export const Mono = Platform.OS === "ios" ? "Courier" : "monospace";
