import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Progress dots */}
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.emoji}>🛣️</Text>
          <Text style={styles.appName}>Konvoy</Text>
          <Text style={styles.tagline}>Drive together. Arrive together.</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button label="Get started" onPress={() => router.push('/onboarding/permissions')} />
          <Button
            label="I have an invite code"
            variant="ghost"
            onPress={() => router.push('/convoy/join')}
            style={styles.ghostBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const FEATURES = [
  { icon: '📍', label: 'Live group position sharing' },
  { icon: '⛽', label: 'Smart fuel stop planning' },
  { icon: '🏁', label: 'Coordinate stops as a group' },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: Spacing.xl, justifyContent: 'space-between' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, paddingTop: Spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.bgElevated },
  dotActive: { width: 18, borderRadius: 3, backgroundColor: Colors.primary },
  hero: { alignItems: 'center', gap: Spacing.sm },
  emoji: { fontSize: 56 },
  appName: { fontSize: FontSize.display, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -1 },
  tagline: { fontSize: FontSize.sm, color: Colors.textMuted },
  features: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    gap: Spacing.md,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  featureIcon: { fontSize: 18 },
  featureLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  actions: { gap: Spacing.sm },
  ghostBtn: { marginTop: Spacing.xs },
});
