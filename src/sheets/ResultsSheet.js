// PS168 — Results Modal (Layer 3)
// Centered "Dead-Reckoning Benchmark" card shown after a run completes:
//   tolerance check + grade, error drift curve with peak annotation,
//   2×2 stat grid (blackout / peak drift / blend / sensor rate),
//   Export CSV, Replay Session, repo QR and the cloud-sync toast

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { DEMO, ENGINE } from '../utils/constants';
import { COLORS as T, RADIUS, SHADOW } from '../utils/theme';
import DriftCurveChart from '../components/DriftCurveChart';

export default function ResultsSheet({ visible, frozenResults, onClose, onReplay, savedLocally = false }) {
  const cardAnim = useRef(new Animated.Value(0)).current;
  const [toastVisible, setToastVisible] = React.useState(false);

  useEffect(() => {
    if (visible && frozenResults) {
      Animated.spring(cardAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
      const toastTimer = setTimeout(() => setToastVisible(true), 900);
      return () => clearTimeout(toastTimer);
    }
    cardAnim.setValue(0);
    setToastVisible(false);
    return undefined;
  }, [visible, frozenResults, cardAnim]);

  // Export CSV (trail dump) via share sheet
  const handleExportCSV = useCallback(async () => {
    const trail = frozenResults?.trail;
    if (!trail || trail.length === 0) return;

    const header = 'index,lat,lon,source\n';
    const rows = trail.map((p, i) => `${i},${p.lat},${p.lon},${p.source}`).join('\n');
    const csv = header + rows;

    const filename = `ps168_run_${frozenResults.timestamp?.replace(/[:.]/g, '-') || 'export'}.csv`;
    const fileUri = FileSystem.documentDirectory + filename;

    try {
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Exported', `Saved to ${filename}`);
      }
    } catch (e) {
      Alert.alert('Export Failed', e.message);
    }
  }, [frozenResults]);

  if (!visible || !frozenResults) return null;

  const {
    driftMeters,
    totalMeters,
    driftPercent,
    pass,
    curve,
    peak,
    blackoutS,
    recoveryBlendS,
    sensorHz,
    sessionId,
    sessionPlace,
    peakMaxM,
    avgSpeedMps = 0,
  } = frozenResults;

  const grade = driftPercent <= 5 ? 'A+' : driftPercent <= ENGINE.DRIFT_PASS_THRESHOLD * 100 ? 'A' : 'B';

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Session chips */}
        <View style={styles.sessionRow}>
          <View style={styles.sessionChip}>
            <Text style={styles.sessionChipText}>📍 {sessionPlace}</Text>
          </View>
          <View style={styles.sessionChip}>
            <View style={styles.sessionDot} />
            <Text style={styles.sessionChipText}>SESSION {sessionId}</Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              transform: [
                { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              ],
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Svg width={22} height={22} viewBox="0 0 22 22">
                  <Path d="M3 16 L8 10 L12 13 L19 5" stroke="#4F46E5" strokeWidth={2.4} fill="none" strokeLinecap="round" />
                </Svg>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>Dead-Reckoning Benchmark</Text>
                <Text style={styles.subtitle}>GNSS Tunnel Blackout Simulation</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                testID="results-close"
                accessibilityLabel="results-close"
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Tolerance check */}
            <View style={[styles.toleranceCard, !pass && styles.toleranceCardFail]}>
              <View style={styles.toleranceMain}>
                <View style={styles.toleranceTitleRow}>
                  <View style={[styles.toleranceDot, !pass && { backgroundColor: DEMO.red }]} />
                  <Text style={styles.toleranceTitle}>TOLERANCE CHECK</Text>
                </View>
                <View style={styles.toleranceValueRow}>
                  <Text style={styles.toleranceValue}>{driftPercent.toFixed(1)}%</Text>
                  <Text style={[styles.toleranceVerdict, !pass && { color: DEMO.red }]}>
                    {pass ? 'PASS ✅' : 'FAIL ❌'}
                  </Text>
                </View>
                <Text style={styles.toleranceHint}>
                  Below {(ENGINE.DRIFT_PASS_THRESHOLD * 100).toFixed(1)}% ISO-26262 corridor threshold
                </Text>
              </View>
              <View style={[styles.gradeBox, !pass && { backgroundColor: DEMO.red }]}>
                <Text style={styles.gradeShield}>🛡</Text>
                <Text style={styles.gradeLabel}>GRADE</Text>
                <Text style={styles.gradeValue}>{grade}</Text>
              </View>
            </View>

            {/* Error drift curve */}
            <View style={styles.curveCard}>
              <View style={styles.curveHeader}>
                <Text style={styles.curveTitle}>⎍ Error Drift Curve</Text>
                <View style={styles.peakChip}>
                  <Text style={styles.peakChipText}>
                    Peak: {peak?.m?.toFixed(1) ?? '0.0'}m @ {Math.round(peak?.atS ?? 0)}s
                  </Text>
                </View>
              </View>
              <DriftCurveChart curve={curve} peak={peak} blackoutS={blackoutS} />
            </View>

            {/* Stat grid */}
            <View style={styles.statGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>🕐 Blackout Duration</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{blackoutS}</Text>
                  <Text style={styles.statUnit}>sec</Text>
                </View>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>🔀 Peak Drift</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{Math.round(peak?.m ?? driftMeters)}</Text>
                  <Text style={styles.statUnit}>m</Text>
                  <Text style={styles.statNote}>{`< ${peakMaxM}m max`}</Text>
                </View>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>⚡ Recovery Blend</Text>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: DEMO.green }]}>{recoveryBlendS?.toFixed(1)}</Text>
                  <Text style={styles.statUnit}>s</Text>
                  <Text style={[styles.statNote, { color: '#9CA3AF' }]}>Kalman</Text>
                </View>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>📡 Sensor Updates</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{sensorHz}</Text>
                  <Text style={styles.statUnit}>Hz</Text>
                  <Text style={[styles.statNote, { color: '#9CA3AF' }]}>IMU + ODO</Text>
                </View>
              </View>
              <View style={[styles.statCell, styles.statCellSpan]}>
                <Text style={styles.statLabel}>🚀 Avg Speed</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{(avgSpeedMps ?? 0).toFixed(1)}</Text>
                  <Text style={styles.statUnit}>m/s</Text>
                  <Text style={[styles.statNote, { color: '#9CA3AF' }]}>{`IMU+ODO ${sensorHz} Hz fusion`}</Text>
                </View>
              </View>
            </View>

            {/* Footer actions */}
            <View style={styles.footer}>
              <View style={styles.qrBox}>
                <FakeQR />
                <Text style={styles.qrLabel}>Repo / Log</Text>
              </View>
              <View style={styles.footerBtns}>
                <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV} activeOpacity={0.8}>
                  <Text style={styles.exportBtnText}>📄 Export CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.replayBtn} onPress={onReplay} activeOpacity={0.7}>
                  <Text style={styles.replayBtnText}>⟳ Replay Session</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>

        {/* Cloud sync toast */}
        <Animated.View
          style={[
            styles.toast,
            { opacity: toastVisible ? 1 : 0, transform: [{ translateY: toastVisible ? 0 : 16 }] },
          ]}
        >
          <View style={styles.toastDot}>
            <Text style={styles.toastCheck}>✓</Text>
          </View>
          <Text style={styles.toastText}>
            {savedLocally ? 'Telemetry saved locally on device' : 'Session complete — summary ready'}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Decorative QR block (repo / log link placeholder)
function FakeQR() {
  const cells = [
    [5, 0], [6, 0], [5, 1], [8, 1], [10, 1], [5, 3], [7, 3], [9, 3], [10, 3],
    [0, 5], [2, 5], [3, 5], [5, 5], [6, 5], [8, 5], [10, 5], [1, 6], [4, 6], [7, 6], [9, 6],
    [0, 8], [3, 8], [5, 8], [8, 8], [10, 8], [5, 9], [6, 9], [9, 9], [5, 10], [7, 10], [8, 10], [10, 10],
  ];
  return (
    <Svg width={54} height={54} viewBox="0 0 11 11">
      <Rect x={0} y={0} width={11} height={11} fill="#0B1220" />
      {/* Finder patterns */}
      {[[0, 0], [7, 0], [0, 7]].map(([fx, fy]) => (
        <React.Fragment key={`${fx}-${fy}`}>
          <Rect x={fx} y={fy} width={4} height={4} fill="#FFFFFF" />
          <Rect x={fx + 1} y={fy + 1} width={2} height={2} fill="#0B1220" />
        </React.Fragment>
      ))}
      {cells.map(([cx, cy]) => (
        <Rect key={`${cx}.${cy}`} x={cx} y={cy} width={1} height={1} fill="#FFFFFF" />
      ))}
      <Rect x={5} y={5} width={1} height={1} fill="#3B82F6" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: T.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  sessionRow: {
    position: 'absolute',
    top: 54,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(229, 231, 235, 0.9)',
    paddingHorizontal: 14,
    minHeight: 36,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DEMO.green,
  },
  sessionChipText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.modal,
    padding: 18,
    ...SHADOW.s4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
  toleranceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DEMO.greenFill,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  toleranceCardFail: {
    backgroundColor: DEMO.redFill,
    borderColor: '#FECACA',
  },
  toleranceMain: {
    flex: 1,
    gap: 3,
  },
  toleranceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  toleranceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DEMO.green,
  },
  toleranceTitle: {
    color: DEMO.greenDark,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  toleranceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  toleranceValue: {
    color: '#064E3B',
    fontSize: 30,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: -1,
  },
  toleranceVerdict: {
    color: DEMO.greenDark,
    fontSize: 17,
    fontWeight: '900',
  },
  toleranceHint: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '600',
  },
  gradeBox: {
    width: 86,
    height: 62,
    borderRadius: 14,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    elevation: 4,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  gradeShield: {
    fontSize: 12,
  },
  gradeLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  gradeValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    width: '100%',
    textAlign: 'left',
    paddingLeft: 10,
  },
  curveCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  curveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  curveTitle: {
    color: '#334155',
    fontSize: 13.5,
    fontWeight: '800',
  },
  peakChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  peakChipText: {
    color: DEMO.amberDark,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statCell: {
    width: '47.5%',
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.card,
    padding: 12,
    gap: 6,
  },
  statCellSpan: {
    width: '100%',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '700',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  statValue: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontFamily: 'monospace',
  },
  statUnit: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  statNote: {
    color: DEMO.green,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 'auto',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  qrBox: {
    width: 92,
    backgroundColor: '#0B1220',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  qrLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  footerBtns: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  exportBtn: {
    backgroundColor: T.primary,
    borderRadius: RADIUS.full,
    minHeight: 46,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.s2,
  },
  exportBtnText: {
    color: T.textOnColor,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  replayBtn: {
    backgroundColor: T.surfaceSoft,
    borderRadius: RADIUS.full,
    minHeight: 46,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayBtnText: {
    color: T.textSecondary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  toast: {
    position: 'absolute',
    bottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(229, 231, 235, 0.95)',
    paddingHorizontal: 16,
    minHeight: 40,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  toastDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DEMO.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastCheck: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  toastText: {
    color: '#374151',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
