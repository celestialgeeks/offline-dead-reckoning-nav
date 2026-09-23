// PS168 — Dead-Reckoning History Panel (Settings > drHistory)
// Visualizes persisted DR sessions: 2×2 summary tiles + per-session cards
// with an inline drift-curve sparkline. Google-Maps-like clean white cards.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { getDrHistory, clearDrHistory } from '../services/drHistoryService';
import DriftCurveChart from './DriftCurveChart';
import { DEMO } from '../utils/constants';
import { COLORS as T, RADIUS, SHADOW } from '../utils/theme';

// Keep the panel inside the bottom-sheet so the inner ScrollView can scroll
const PANEL_MAX_H = Math.round(Dimensions.get('window').height * 0.62);

export default function DrHistoryPanel({ onBack }) {
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    getDrHistory()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  // Aggregate stats over all sessions (empty-safe)
  const summary = useMemo(() => {
    const list = sessions || [];
    const count = list.length;
    const passCount = list.filter(s => s.pass).length;
    const passRate = count > 0 ? Math.round((passCount / count) * 100) : 0;
    const peaks = list
      .map(s => s.peakM)
      .filter(v => typeof v === 'number' && !Number.isNaN(v));
    const avgPeak = peaks.length > 0 ? peaks.reduce((a, b) => a + b, 0) / peaks.length : null;
    const maxDrift = peaks.length > 0 ? Math.max(...peaks) : null;
    return { count, passRate, avgPeak, maxDrift };
  }, [sessions]);

  // Newest first
  const sorted = useMemo(() => {
    const list = sessions || [];
    return [...list].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [sessions]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear DR History',
      'Delete all recorded dead-reckoning sessions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clearDrHistory().then(() => setSessions([])),
        },
      ]
    );
  }, []);

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          testID="history-back"
          accessibilityLabel="history-back"
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dead Reckoning History</Text>
      </View>

      {sessions === null ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (
        <>
          {/* Summary tiles (2×2) */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Sessions</Text>
              <Text style={styles.summaryValue}>{summary.count}</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Pass rate</Text>
              <Text style={styles.summaryValue}>
                {summary.count > 0 ? `${summary.passRate}%` : '—'}
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Avg peak drift</Text>
              <Text style={styles.summaryValue}>
                {summary.avgPeak != null ? `${summary.avgPeak.toFixed(1)} m` : '—'}
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Max drift</Text>
              <Text style={styles.summaryValue}>
                {summary.maxDrift != null ? `${summary.maxDrift.toFixed(1)} m` : '—'}
              </Text>
            </View>
          </View>

          {/* Session cards */}
          {sorted.length === 0 ? (
            <Text style={styles.empty}>
              No DR sessions yet — run the Dead Reckoning Demo to record one.
            </Text>
          ) : (
            sorted.map(session => (
              <View key={session.id} style={styles.sessionCard}>
                <View style={styles.cardLine1}>
                  <Text style={styles.cardDate} numberOfLines={1}>
                    {new Date(session.timestamp).toLocaleString()}
                  </Text>
                  <View style={[styles.pill, session.pass ? styles.pillPass : styles.pillFail]}>
                    <Text style={[styles.pillText, session.pass ? styles.pillTextPass : styles.pillTextFail]}>
                      {session.pass ? 'PASS' : 'FAIL'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardLine2} numberOfLines={1}>
                  {session.place} · SESSION {session.id}
                </Text>
                <Text style={styles.cardLine3} numberOfLines={1}>
                  {`${session.driftPercent}% drift · peak ${session.peakM} m · blackout ${session.blackoutS}s`}
                </Text>
                <Text style={styles.cardLine4} numberOfLines={1}>
                  {`${session.sensorHz} Hz IMU+ODO · ${session.recoveryBlendS}s Kalman blend · ${session.trailPoints} pts`}
                </Text>
                <View style={styles.sparkWrap}>
                  <DriftCurveChart
                    curve={session.curve}
                    peak={{ m: session.peakM, atS: session.peakAtS }}
                    blackoutS={session.blackoutS}
                    width={280}
                    height={70}
                    showLabels={false}
                  />
                </View>
              </View>
            ))
          )}

          {/* Destructive clear */}
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            testID="history-clear"
            accessibilityLabel="history-clear"
          >
            <Text style={styles.clearBtnText}>Clear DR History</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: PANEL_MAX_H,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: T.surfaceSoft,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.textSecondary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: T.textPrimary,
    letterSpacing: -0.2,
  },
  muted: {
    fontSize: 13,
    color: T.textTertiary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  empty: {
    fontSize: 13,
    color: T.textTertiary,
    textAlign: 'center',
    paddingVertical: 28,
    lineHeight: 19,
  },
  // Summary tiles
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  summaryTile: {
    width: '47.5%',
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.card,
    padding: 12,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: T.textTertiary,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: T.textPrimary,
    fontFamily: 'monospace',
    letterSpacing: -0.5,
  },
  // Session cards
  sessionCard: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.surfaceBorder,
    padding: 14,
    marginBottom: 12,
    gap: 6,
    ...SHADOW.s1,
  },
  cardLine1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardDate: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: T.textPrimary,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  pillPass: {
    backgroundColor: DEMO.greenFill,
  },
  pillFail: {
    backgroundColor: DEMO.redFill,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pillTextPass: {
    color: DEMO.green,
  },
  pillTextFail: {
    color: DEMO.red,
  },
  cardLine2: {
    fontSize: 12.5,
    fontWeight: '600',
    color: T.textSecondary,
  },
  cardLine3: {
    fontSize: 12,
    fontWeight: '600',
    color: DEMO.amberDark,
    fontFamily: 'monospace',
  },
  cardLine4: {
    fontSize: 11,
    color: T.textTertiary,
  },
  sparkWrap: {
    marginTop: 4,
    alignItems: 'center',
  },
  // Destructive action (mirrors SettingsModal clearBtn)
  clearBtn: {
    backgroundColor: '#FCE8E6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D93025',
  },
});
