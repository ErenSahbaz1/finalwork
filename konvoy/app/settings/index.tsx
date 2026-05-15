import { View, Text, StyleSheet } from "react-native";
import { Colors, FontSize } from "../../src/constants/theme";

// TODO: Implement settings screen
export default function SettingsScreen() {
	return (
		<View style={styles.container}>
			<Text style={styles.text}>Settings</Text>
			<Text style={styles.sub}>Privacy, account & preferences</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.bg,
		alignItems: "center",
		justifyContent: "center",
	},
	text: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.textPrimary },
	sub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 8 },
});
