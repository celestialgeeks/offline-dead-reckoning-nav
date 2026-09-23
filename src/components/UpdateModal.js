// PS168 — UpdateModal (Google Play / System Style In-App Updater)
// Prompts the user when a new GitHub release is available, shows changelog, and initiates 1-tap download

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';

export default function UpdateModal({ visible, updateInfo, onClose }) {
  if (!visible || !updateInfo) return null;

  const handleUpdateNow = async () => {
    if (updateInfo.downloadUrl) {
      try {
        await Linking.openURL(updateInfo.downloadUrl);
      } catch (err) {
        console.warn('Could not open download URL:', err);
      }
    }
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Text style={styles.rocketIcon}>🚀</Text>
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>Update Available!</Text>
          {updateInfo.channelLabel && (
            <View style={styles.channelBadgeWrap}>
              <Text style={styles.channelBadgeText}>{updateInfo.channelLabel}</Text>
            </View>
          )}
          <View style={styles.versionRow}>
            <View style={styles.oldVerBadge}>
              <Text style={styles.verOldText}>v{updateInfo.currentVersion}</Text>
            </View>
            <Text style={styles.arrow}>➔</Text>
            <View style={styles.newVerBadge}>
              <Text style={styles.verNewText}>v{updateInfo.latestVersion}</Text>
            </View>
          </View>

          {updateInfo.apkSizeMb && (
            <Text style={styles.sizeText}>Download size: ~{updateInfo.apkSizeMb} MB</Text>
          )}

          {/* Changelog preview */}
          <Text style={styles.changelogHeader}>What's New:</Text>
          <ScrollView style={styles.notesBox} showsVerticalScrollIndicator={false}>
            <Text style={styles.notesText}>
              {updateInfo.releaseNotes?.trim() || 'General improvements and performance enhancements.'}
            </Text>
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.laterBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.laterBtnText}>Later</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.updateBtn}
              onPress={handleUpdateNow}
              activeOpacity={0.8}
            >
              <Text style={styles.updateBtnText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D2E3FC',
  },
  rocketIcon: {
    fontSize: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#202124',
    marginBottom: 6,
    textAlign: 'center',
  },
  channelBadgeWrap: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  channelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A73E8',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  oldVerBadge: {
    backgroundColor: '#F1F3F4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verOldText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#70757A',
  },
  arrow: {
    fontSize: 12,
    color: '#5F6368',
  },
  newVerBadge: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verNewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#137333',
  },
  sizeText: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 12,
  },
  changelogHeader: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '700',
    color: '#3C4043',
    marginBottom: 6,
  },
  notesBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  notesText: {
    fontSize: 12,
    color: '#4A4D51',
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  laterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F3F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5F6368',
  },
  updateBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#1A73E8', // Google Blue
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  updateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
