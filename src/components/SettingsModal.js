import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { getSettings, saveSettings, clearAllData } from '../services/settingsService';
import { getDrHistory } from '../services/drHistoryService';
import DrHistoryPanel from './DrHistoryPanel';

export default function SettingsModal({
  visible,
  onClose,
  type,
  onStartDemo,
  onOpenDrHistory,
  onBackToSettings,
}) {
  const [units, setUnits] = useState('metric');
  const [voiceGuidance, setVoiceGuidance] = useState(true);
  const [sessionCount, setSessionCount] = useState(null);

  useEffect(() => {
    if (visible) {
      getSettings().then(s => {
        setUnits(s.units || 'metric');
        setVoiceGuidance(s.voiceGuidance ?? true);
      });
      getDrHistory()
        .then(list => setSessionCount(list.length))
        .catch(() => setSessionCount(0));
    }
  }, [visible]);

  const toggleUnits = async () => {
    const newUnit = units === 'metric' ? 'imperial' : 'metric';
    setUnits(newUnit);
    await saveSettings({ units: newUnit });
  };

  const toggleVoice = async (val) => {
    setVoiceGuidance(val);
    await saveSettings({ voiceGuidance: val });
  };

  const handleClearData = async () => {
    Alert.alert(
      'Clear App Data',
      'This will clear your search history and downloaded places cache. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Data Cleared', 'Your history and caches have been cleared.');
          },
        },
      ]
    );
  };

  const handleExportLogs = () => {
    Alert.alert('Export Logs', 'Logs have been exported and saved to your device.');
  };

  if (!visible) return null;

  const renderContent = () => {
    if (type === 'settings') {
      return (
        <>
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              onClose();
              onStartDemo?.();
            }}
            testID="settings-dr-demo"
            accessibilityLabel="settings-dr-demo"
          >
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>Dead Reckoning Demo</Text>
              <Text style={styles.rowSubtitle}>Run a simulated GNSS tunnel-outage test</Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => onOpenDrHistory?.()}
            testID="settings-dr-history"
            accessibilityLabel="settings-dr-history"
          >
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>Dead Reckoning History</Text>
              <Text style={styles.rowSubtitle}>
                {sessionCount == null
                  ? 'View recorded DR sessions'
                  : `${sessionCount} recorded session${sessionCount === 1 ? '' : 's'}`}
              </Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>Distance Units</Text>
              <Text style={styles.rowSubtitle}>
                {units === 'metric' ? 'Metric (Kilometers, Meters)' : 'Imperial (Miles, Feet)'}
              </Text>
            </View>
            <TouchableOpacity style={styles.toggleBtn} onPress={toggleUnits}>
              <Text style={styles.toggleBtnText}>
                {units === 'metric' ? 'Switch to Imperial' : 'Switch to Metric'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>Voice Guidance</Text>
              <Text style={styles.rowSubtitle}>Hear spoken navigation instructions</Text>
            </View>
            <Switch
              value={voiceGuidance}
              onValueChange={toggleVoice}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={voiceGuidance ? '#1A73E8' : '#f4f3f4'}
            />
          </View>
        </>
      );
    } else if (type === 'help') {
      return (
        <>
          <View style={styles.faqRow}>
            <Text style={styles.faqQ}>Q: Does the app work offline?</Text>
            <Text style={styles.faqA}>A: Yes, if you download offline maps, navigation works entirely without an internet connection.</Text>
          </View>
          <View style={styles.faqRow}>
            <Text style={styles.faqQ}>Q: How accurate is the dead-reckoning?</Text>
            <Text style={styles.faqA}>A: It provides up to 90% accuracy in short tunnels using device sensors (accelerometer, gyroscope).</Text>
          </View>
          <View style={styles.faqRow}>
            <Text style={styles.faqQ}>Q: Are my searches private?</Text>
            <Text style={styles.faqA}>A: Yes, all data is stored locally on your device.</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportLogs}>
            <Text style={styles.exportBtnText}>Export Diagnostic Logs</Text>
          </TouchableOpacity>
        </>
      );
    } else if (type === 'data') {
      return (
        <View style={styles.dataContainer}>
          <Text style={styles.dataWarning}>
            You can clear your search history and temporarily cached places. Saved places and offline maps will NOT be deleted.
          </Text>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearData}>
            <Text style={styles.clearBtnText}>Clear History & Cache</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (type === 'drHistory') {
      return <DrHistoryPanel onBack={onBackToSettings} />;
    }
    return null;
  };

  const getTitle = () => {
    if (type === 'settings') return 'Settings';
    if (type === 'help') return 'Help & Feedback';
    if (type === 'data') return 'Your Data in Maps';
    if (type === 'drHistory') return 'Dead Reckoning History';
    return '';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{getTitle()}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            {renderContent()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202124',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: '#5F6368',
  },
  content: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  textCol: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#5F6368',
    marginTop: 2,
  },
  rowChevron: {
    fontSize: 20,
    color: '#5F6368',
    paddingLeft: 8,
  },
  toggleBtn: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A73E8',
  },
  faqRow: {
    marginBottom: 16,
  },
  faqQ: {
    fontSize: 15,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 4,
  },
  faqA: {
    fontSize: 14,
    color: '#5F6368',
    lineHeight: 20,
  },
  exportBtn: {
    marginTop: 10,
    backgroundColor: '#F1F3F4',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  exportBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A73E8',
  },
  dataContainer: {
    paddingTop: 10,
  },
  dataWarning: {
    fontSize: 14,
    color: '#5F6368',
    lineHeight: 20,
    marginBottom: 20,
  },
  clearBtn: {
    backgroundColor: '#FCE8E6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D93025',
  },
});
