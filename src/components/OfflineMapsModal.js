import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  hasOfflinePack,
  downloadOfflinePack,
  deleteOfflinePack,
} from '../map/OfflineTileManager';

export default function OfflineMapsModal({ visible, onClose, currentCenter }) {
  const [hasPack, setHasPack] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const checkPack = async () => {
    const exists = await hasOfflinePack();
    setHasPack(exists);
  };

  useEffect(() => {
    if (visible) {
      checkPack();
    }
  }, [visible]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setProgress(0);
    try {
      await downloadOfflinePack(currentCenter, (pct) => {
        setProgress(pct);
      });
      await checkPack();
    } catch (e) {
      Alert.alert('Download Failed', e.message || 'An error occurred during download.');
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete Offline Maps', 'Are you sure you want to delete the downloaded maps?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteOfflinePack();
          await checkPack();
        },
      },
    ]);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Offline Maps</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Download the current area to navigate without an internet connection.
            </Text>

            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Current Status</Text>
              <Text style={[styles.statusValue, hasPack ? styles.statusActive : styles.statusInactive]}>
                {hasPack ? '✅ Area Downloaded' : '❌ No offline areas'}
              </Text>
            </View>

            {isDownloading ? (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>Downloading... {Math.round(progress)}%</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>
                <ActivityIndicator size="small" color="#1A73E8" style={{ marginTop: 10 }} />
              </View>
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.primaryBtn]}
                  onPress={handleDownload}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>
                    {hasPack ? 'Update Current Area' : 'Download Current Area'}
                  </Text>
                </TouchableOpacity>
                {hasPack && (
                  <TouchableOpacity
                    style={[styles.btn, styles.secondaryBtn]}
                    onPress={handleDelete}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    fontWeight: '600',
  },
  content: {},
  subtitle: {
    fontSize: 14,
    color: '#5F6368',
    marginBottom: 20,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  statusLabel: {
    fontSize: 12,
    color: '#5F6368',
    fontWeight: '700',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusActive: {
    color: '#137333',
  },
  statusInactive: {
    color: '#D93025',
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 8,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#E8EAED',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1A73E8',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#1A73E8',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryBtn: {
    backgroundColor: '#F1F3F4',
  },
  secondaryBtnText: {
    color: '#D93025',
    fontWeight: '700',
    fontSize: 14,
  },
});
