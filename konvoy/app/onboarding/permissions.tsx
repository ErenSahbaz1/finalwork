import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Button } from '../../src/components/Button';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

export default function PermissionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAllow() {
    setLoading(true);
    try {
      await Location.requestForegroundPermissionsAsync();
      await Location.requestBackgroundPermissionsAsync();
      // Notifications permission
      await Notifications.requestPermissionsAsync();
    } catch (e) {
      // User can deny — app will handle limited mode
    } finally {
      setLoading(false);
      router.push('/onboarding/profile');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotDone]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🛡️</Text>
        </View>
        <Text style={styles.title}>A few permissions first</Text>
        <Text style={styles.sub}>Only active during your convoy. Auto-off when trip ends.</Text>

        <View style={styles.permList}>
          {PERMISSIONS.map((p) => (
            <View key={p.name} style={styles.permCard}>
              <View style={[styles.permIcon, { backgroundColor: p.bgColor }]}>
                <Text style={styles.permEmoji}>{p.emoji}</Text>
              </View>
              <View style={styles.permText}>
                <Text style={styles.permName}>{p.name}</Text>
                <Text style={styles.permDesc}>{p.desc}</Text>
              </View>
              <View style={[styles.badge, p.required ? styles.badgeReq : styles.badgeOpt]}>
                <Text style={[styles.badgeText, p.required ? styles.badgeTextReq : styles.badgeTextOpt]}>
                  {p.required ? 'Required' : 'Optional'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Your location is only visible to convoy members and is auto-deleted when the trip ends.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button label="Allow & continue" onPress={handleAllow} loading={loading} />
          <Button
            label="Set up manually later"
            variant="ghost"
            onPress={() => router.push('/onboarding/profile')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const PERMISSIONS = [
  { emoji: '📍', name: 'Location', desc: 'Share live position with convoy only', required: true, bgColor: Colors.primaryDim },
  { emoji: '🔔', name: 'Notifications', desc: 'Stop alerts and emergencies', required: true, bgColor: 'rgba(55,138,221,0.12)' },
  { emoji: '📷', name: 'Camera', desc: 'Scan QR codes to join', required: false, bgColor: 'rgba(136,135,128,0.1)' },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: Spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, marginBottom: Spacing.xl },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.bgElevated },
  dotActive: { width: 18, borderRadius: 3, backgroundColor: Colors.primary },
  dotDone: { width: 6, backgroundColor: Colors.primary },
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
  sub: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 16, marginBottom: Spacing.lg },
  permList: { gap: Spacing.sm, marginBottom: Spacing.md },
  permCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  permIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  permEmoji: { fontSize: 16 },
  permText: { flex: 1 },
  permName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  permDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, lineHeight: 14 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeReq: { backgroundColor: Colors.primaryDim },
  badgeOpt: { backgroundColor: 'rgba(136,135,128,0.1)' },
  badgeText: { fontSize: 8, fontWeight: '600' },
  badgeTextReq: { color: Colors.primary },
  badgeTextOpt: { color: Colors.textMuted },
  note: {
    padding: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm, borderLeftWidth: 2, borderLeftColor: Colors.primary,
    marginBottom: Spacing.lg,
  },
  noteText: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16 },
  actions: { gap: Spacing.sm, marginTop: 'auto' },
});
