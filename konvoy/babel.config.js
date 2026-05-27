// ─── Babel configuration ──────────────────────────────────────────────────────
// react-native-reanimated requires its worklets plugin to be registered, and
// it must be the LAST entry in `plugins`. Without it, worklet imports throw
// "Exception in HostFunction" during module init and the whole JS bundle
// fails to load (which is why expo-router shows an "Unmatched Route" page).
// ──────────────────────────────────────────────────────────────────────────────

module.exports = function (api) {
	api.cache(true);
	return {
		presets: ["babel-preset-expo"],
		plugins: ["react-native-reanimated/plugin"],
	};
};
