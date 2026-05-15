import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

interface PrivacySettings {
  exactLocation: boolean;
  autoWipe: boolean;
  showLicensePlate: boolean;
  shareVehicleProfile: boolean;
}

export default function PrivacyScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<PrivacySettings>({
    exactLocation: true,
    autoWipe: true,
    showLicensePlate: false,
    shareVehicleProfile: true,
  });

  function toggle(key: keyof PrivacySettings) {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  }

  function handleStart() {
    // TODO: save privacy settings to store
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.dots}>
          {[0,1,2,3].map((i) => (
            <View key={i} style={[styles.dot, i < 3 ? styles.dotDone : styles.dotActive]} />
          ))}
        </View>

        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔒</Text>
        </View>
        <Text style={styles.title}>Your privacy, your rules</Text>
        <Text style={styles.sub}>Change these anytime during your trip.</Text>

        <View style={styles.toggleList}>
          {TOGGLES.map((t) => (
            <View key={t.key} style={styles.toggleRow}>
              <View style={styles.toggleTrack}>
                <Switch
                  value={settings[t.key as keyof PrivacySettings]}
                  onValueChange={() => toggle(t.key as keyof PrivacySettings)}
                  trackColor={{ false: Colors.bgElevated, true: Colors.primary }}
                  thumbColor="#fff"
                  ios_backgroundColor={Colors.bgElevated}
                />
              </View>
              <View>
                <Text style={styles.toggleName}>{t.name}</Text>
                <Text style={styles.toggleDesc}>{t.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoPill}>
          <Text style={styles.infoText}>
            Location sharing stops automatically{'\n'}48h after convoy ends
          </Text>
        </View>

        <Button label="Start using Konvoy" onPress={handleStart} />
      </ScrollView>
    </SafeAreaView>
  );
}

const TOGGLES = [
  { key: 'exactLocation', name: 'Exact location', desc: 'Share precise GPS with convoy' },
  { key: 'autoWipe', name: 'Auto-wipe on trip end', desc: 'Delete all data when convoy closes' },
  { key: 'showLicensePlate', name: 'Show license plate', desc: 'Optional — visible to your convoy' },
  { key: 'shareVehicleProfile', name: 'Share vehicle profile', desc: 'Helps plan smarter fuel stops' },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, marginBottom: Spacing.xl },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.bgElevated },
  dotActive: { width: 18, borderRadius: 3, backgroundColor: Colors.primary },
  dotDone: { backgroundColor: Colors.primary },
  iconWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.primaryBorder,
    alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  icon: { fontSize: 28 },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xs },
  sub: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 16, marginBottom: Spacing.xl },
  toggleList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  toggleRow: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  toggleTrack: { flexShrink: 0 },
  toggleName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  toggleDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  infoPill: {
    backgroundColor: 'rgba(51,168,109,0.07)',
    borderWidth: 1, borderColor: Colors.primaryBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoText: { fontSize: FontSize.xs, color: Colors.primary, textAlign: 'center', lineHeight: 18 },
});
