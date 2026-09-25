// PS168 — Run Controls Bottom Sheet (Layer 3)
// Replay file picker, Replay/Live toggle, START button
// 15-second auto-calibrate countdown with circular progress

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { CALIBRATION_DURATION_S } from '../utils/constants';
import { COLORS as T, RADIUS, SHADOW, TYPE } from '../utils/theme';
import { getAvailableReplays } from '../data/replayLoader';

export default function RunControlsSheet({
  sheetRef,
  onStart,
  isCalibrating,
  calibrateCountdown,
  isRunning,
  onStop,
  onSkipCalibration,
}) {
  const [mode, setMode] = useState('replay'); // 'replay' | 'live'
  const [selectedReplay, setSelectedReplay] = useState(0);
  const replays = useMemo(() => getAvailableReplays(), []);

  const snapPoints = useMemo(() => ['12%', '45%'], []);

  // Open expanded (45%) so ▶ START is immediately visible — no drag needed.
  // `index={1}` handles the declarative case; the nudge + settle fallback
  // cover the conditional-mount path where the library's mount animation
  // lands on (or stays at) the 12% peek.
  useEffect(() => {
    const t = setTimeout(() => sheetRef.current?.expand(), 350);
    return () => clearTimeout(t);
  }, [sheetRef]);
  const didAutoExpandRef = useRef(false);
  const handleSettle = useCallback(
    (index) => {
      if (!didAutoExpandRef.current) {
        didAutoExpandRef.current = true;
        if (index === 0) sheetRef.current?.snapToIndex(1);
      }
    },
    [sheetRef]
  );

  const handleStart = useCallback(() => {
    if (mode === 'replay' && replays.length > 0) {
      onStart(replays[selectedReplay].module, 'replay');
    } else {
      onStart(null, 'live');
    }
  }, [mode, selectedReplay, replays, onStart]);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      index={1}
      animateOnMount={true}
      onSettle={handleSettle}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handleIndicator}
      enablePanDownToClose={false}
    >
      <BottomSheetView style={styles.content}>
        {/* Calibrating overlay */}
        {isCalibrating && (
          <TouchableOpacity
            style={styles.calibratingOverlay}
            activeOpacity={0.8}
            onPress={onSkipCalibration}
            testID="skip-calibration"
            accessibilityLabel="skip-calibration"
          >
            <View style={styles.calibrateCircle}>
              <Text style={styles.calibrateNumber}>{calibrateCountdown}</Text>
            </View>
            <Text style={styles.calibrateText}>Calibrating sensors...</Text>
            <Text style={styles.calibrateHint}>Hold the phone steady</Text>
            {onSkipCalibration && (
              <Text style={styles.skipHint}>Tap anywhere to skip</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Running overlay */}
        {isRunning && !isCalibrating && (
          <View style={styles.runningOverlay}>
            <View style={styles.runningDot} />
            <Text style={styles.runningText}>Recording run...</Text>
            <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.7}>
              <Text style={styles.stopBtnText}>⏹ STOP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Controls (hidden during calibration/run) */}
        {!isCalibrating && !isRunning && (
          <>
            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'replay' && styles.modeBtnActive]}
                onPress={() => setMode('replay')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeBtnText, mode === 'replay' && styles.modeBtnTextActive]}>
                  📁 Replay
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'live' && styles.modeBtnActive]}
                onPress={() => setMode('live')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeBtnText, mode === 'live' && styles.modeBtnTextActive]}>
                  📡 Live
                </Text>
              </TouchableOpacity>
            </View>

            {/* Replay file picker */}
            {mode === 'replay' && (
              <View style={styles.replayPicker}>
                {replays.map((r, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.replayItem, selectedReplay === i && styles.replayItemActive]}
                    onPress={() => setSelectedReplay(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.replayName}>{r.name}</Text>
                    <Text style={styles.replayDesc}>{r.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {mode === 'live' && (
              <View style={styles.liveInfo}>
                <Text style={styles.liveInfoText}>
                  Uses phone GPS + IMU sensors at 10Hz
                </Text>
              </View>
            )}

            {/* START button */}
            <TouchableOpacity
              style={styles.startBtn}
              onPress={handleStart}
              activeOpacity={0.8}
              testID="run-start"
              accessibilityLabel="run-start"
            >
              <Text style={styles.startBtnText}>▶ START</Text>
              <Text style={styles.startBtnSubtext}>
                {CALIBRATION_DURATION_S}s calibration → auto-run
              </Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: T.surface,
    borderTopLeftRadius: RADIUS.modal,
    borderTopRightRadius: RADIUS.modal,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  handleIndicator: {
    backgroundColor: T.surfaceBorder,
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: T.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: T.primary,
    ...SHADOW.s1,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.textSecondary,
  },
  modeBtnTextActive: {
    color: T.textOnColor,
    fontWeight: '700',
  },
  // Replay picker
  replayPicker: {
    marginBottom: 16,
    gap: 8,
  },
  replayItem: {
    padding: 12,
    borderRadius: RADIUS.card,
    backgroundColor: T.surfaceDim,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  replayItemActive: {
    borderColor: T.primary,
    backgroundColor: T.primarySoft,
  },
  replayName: {
    fontSize: 13,
    fontWeight: '600',
    color: T.textPrimary,
    fontFamily: 'monospace',
  },
  replayDesc: {
    fontSize: 11,
    color: T.textTertiary,
    marginTop: 2,
  },
  // Live info
  liveInfo: {
    padding: 12,
    borderRadius: RADIUS.card,
    backgroundColor: T.surfaceDim,
    marginBottom: 16,
  },
  liveInfoText: {
    fontSize: 13,
    color: T.textTertiary,
  },
  // START button
  startBtn: {
    backgroundColor: T.primary,
    paddingVertical: 14,
    minHeight: 56,
    borderRadius: RADIUS.modal,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.s2,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: T.textOnColor,
    letterSpacing: -0.3,
  },
  startBtnSubtext: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  // Calibrating
  calibratingOverlay: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  calibrateCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: T.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...SHADOW.s2,
  },
  calibrateNumber: {
    ...TYPE.numL,
    fontSize: 28,
    color: T.textOnColor,
  },
  calibrateText: {
    fontSize: 16,
    fontWeight: '600',
    color: T.textPrimary,
  },
  calibrateHint: {
    fontSize: 12,
    color: T.textTertiary,
    marginTop: 4,
  },
  skipHint: {
    fontSize: 11,
    fontWeight: '700',
    color: T.primary,
    marginTop: 10,
  },
  // Running
  runningOverlay: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  runningDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: T.alert,
  },
  runningText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.textPrimary,
  },
  stopBtn: {
    backgroundColor: T.alertSoft,
    paddingVertical: 10,
    paddingHorizontal: 24,
    minHeight: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  stopBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: T.alert,
  },
});
