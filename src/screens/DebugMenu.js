// PS168 — Debug Menu (Layer 2)
// Accessible via triple-tap on status badge
// "Simulate Outage" sets HDOP=99 for 60s
// NOT visible on main UI — hidden behind gesture

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SIMULATE_OUTAGE } from '../utils/constants';
import { COLORS as T, RADIUS, SHADOW } from '../utils/theme';

export default function DebugMenu({
  visible,
  onClose,
  onSimulateOutage,
  onEndOutage,
  simulatedOutage,
  engineState,
  onCheckUpdates,
}) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>🛠 Debug Menu</Text>
          <Text style={styles.subtitle}>Hidden from main UI — for indoor demos only</Text>

          {/* Simulate Outage */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signal Simulation</Text>
            {simulatedOutage ? (
              <TouchableOpacity style={styles.btnDanger} onPress={onEndOutage} activeOpacity={0.7}>
                <Text style={styles.btnDangerText}>🛑 End Outage Early</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.btn} onPress={onSimulateOutage} activeOpacity={0.7}>
                <Text style={styles.btnText}>⚡ Simulate Outage ({SIMULATE_OUTAGE.DURATION_S}s)</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.hint}>
              Sets HDOP={SIMULATE_OUTAGE.HDOP_VALUE} for {SIMULATE_OUTAGE.DURATION_S}s — triggers automatic DR
            </Text>
          </View>

          {/* Engine State Inspector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Engine State</Text>
            <View style={styles.stateGrid}>
              <StateRow label="Source" value={engineState?.source ?? '—'} />
              <StateRow label="Lat" value={engineState?.lat?.toFixed(6) ?? '—'} />
              <StateRow label="Lon" value={engineState?.lon?.toFixed(6) ?? '—'} />
              <StateRow label="Heading" value={`${(engineState?.heading ?? 0).toFixed(1)}°`} />
              <StateRow label="Speed" value={`${(engineState?.speed ?? 0).toFixed(1)} m/s`} />
              <StateRow label="Sigma" value={`${(engineState?.sigma ?? 0).toFixed(1)} m`} />
            </View>
          </View>

          {/* App Updates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Updates</Text>
            <TouchableOpacity style={styles.btn} onPress={onCheckUpdates} activeOpacity={0.7}>
              <Text style={styles.btnText}>🔄 Check for Updates (v1.0.1)</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>
              Checks GitHub Releases for new APK versions
            </Text>
          </View>

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function StateRow({ label, value }) {
  return (
    <View style={styles.stateRow}>
      <Text style={styles.stateLabel}>{label}</Text>
      <Text style={styles.stateValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: T.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  panel: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.modal,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    ...SHADOW.s4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: T.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: T.textTertiary,
    marginTop: 4,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: T.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  btn: {
    backgroundColor: T.amberSoft,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: T.amberDeep,
  },
  btnDanger: {
    backgroundColor: T.alertSoft,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDangerText: {
    fontSize: 14,
    fontWeight: '700',
    color: T.alert,
  },
  hint: {
    fontSize: 11,
    color: T.textHint,
    marginTop: 6,
  },
  stateGrid: {
    backgroundColor: T.surfaceDim,
    borderRadius: RADIUS.card,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: T.surfaceBorder,
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stateLabel: {
    fontSize: 12,
    color: T.textTertiary,
    fontWeight: '500',
  },
  stateValue: {
    fontSize: 12,
    color: T.textPrimary,
    fontWeight: '600',
    fontFamily: 'monospace',
    letterSpacing: -0.2,
  },
  closeBtn: {
    backgroundColor: T.surfaceSoft,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: T.textSecondary,
  },
});
