// PS168 — User Profile & Settings Menu Modal (Google Maps / Mappls style)
// Triggered by the circular User Avatar button on the search bar
// Houses Map Features, GNSS Diagnostics, and App Settings (with In-App Update Checker & Channel Selection)

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { CURRENT_APP_VERSION } from '../services/updateService';
import { COLORS, RADIUS, SHADOW, TYPE, APP_NAME } from '../utils/theme';

export default function UserMenuModal({
  visible,
  onClose,
  onCheckUpdates,
  onOpenDiagnostics,
  onOpenOfflineMaps,
  onOpenSavedPlaces,
  onOpenSettings,
  onOpenHelp,
  onOpenData,
  mapType,
  onMapTypeChange,
}) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header with User Info & Close */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>B</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{APP_NAME}</Text>
              <Text style={styles.userSubtitle}>Offline-First GNSS Engine</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            {/* Maps Features Section */}
            <Text style={styles.sectionHeading}>MAP FEATURES</Text>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onClose?.();
                onOpenOfflineMaps?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>🗺️</Text>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Offline Maps</Text>
                <Text style={styles.menuSubtitle}>Downloaded areas & cache</Text>
              </View>
              <Text style={styles.arrow}>➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onClose?.();
                onOpenSavedPlaces?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>⭐</Text>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Saved Places</Text>
                <Text style={styles.menuSubtitle}>Favorites & Want to go</Text>
              </View>
              <Text style={styles.arrow}>➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onClose?.();
                Linking.openURL('https://www.openstreetmap.org/note/new');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>➕</Text>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Add a missing place</Text>
                <Text style={styles.menuSubtitle}>Contribute to OpenStreetMap</Text>
              </View>
              <Text style={styles.arrow}>➔</Text>
            </TouchableOpacity>

            {/* Map Type Selector */}
            <View style={styles.channelCard}>
              <View style={styles.channelHeader}>
                <Text style={styles.channelLabel}>Map Type</Text>
              </View>
              <View style={styles.channelTabs}>
                <TouchableOpacity
                  style={[
                    styles.channelBtn,
                    mapType === 'default' && styles.channelBtnActive,
                  ]}
                  onPress={() => onMapTypeChange?.('default')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.channelBtnText,
                      mapType === 'default' && styles.channelBtnTextActive,
                    ]}
                  >
                    🗺️ Default
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.channelBtn,
                    mapType === 'satellite' && styles.channelBtnActive,
                  ]}
                  onPress={() => onMapTypeChange?.('satellite')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.channelBtnText,
                      mapType === 'satellite' && styles.channelBtnTextActive,
                    ]}
                  >
                    🛰️ Satellite
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Settings & Help Section */}
            <Text style={styles.sectionHeading}>SETTINGS & HELP</Text>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onClose?.();
                onOpenSettings?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>⚙️</Text>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Settings</Text>
                <Text style={styles.menuSubtitle}>Units & Navigation Voice</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onClose?.();
                onOpenHelp?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>❓</Text>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Help & Feedback</Text>
                <Text style={styles.menuSubtitle}>FAQ & Export Logs</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onClose?.();
                onOpenData?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>🛡️</Text>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Your data in Maps</Text>
                <Text style={styles.menuSubtitle}>Manage cache & history</Text>
              </View>
            </TouchableOpacity>

            {/* Diagnostics & Dead Reckoning */}
            <Text style={styles.sectionHeading}>DEVELOPER / DEBUG</Text>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onClose?.();
                onOpenDiagnostics?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>⚡</Text>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>GNSS & DR Diagnostics</Text>
                <Text style={styles.menuSubtitle}>Simulate tunnel outage & inspect IMU</Text>
              </View>
              <Text style={styles.arrow}>➔</Text>
            </TouchableOpacity>

            {/* In-App Update Checker Button inside Settings */}
            <TouchableOpacity
              style={styles.updateCardBtn}
              onPress={() => {
                onClose?.();
                onCheckUpdates?.();
              }}
              activeOpacity={0.75}
            >
              <View style={styles.updateIconWrap}>
                <Text style={styles.updateIcon}>🔄</Text>
              </View>
              <View style={styles.updateTextCol}>
                <Text style={styles.updateBtnTitle}>Check for Updates</Text>
                <Text style={styles.updateBtnSub}>
                  v{CURRENT_APP_VERSION}
                </Text>
              </View>
              <View style={styles.updateBadge}>
                <Text style={styles.updateBadgeText}>GitHub OTA</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {APP_NAME} • Version {CURRENT_APP_VERSION}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.modal,
    paddingTop: 20,
    paddingBottom: 12,
    ...SHADOW.s4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: COLORS.textOnColor,
    fontSize: 19,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: COLORS.textPrimary,
  },
  userSubtitle: {
    ...TYPE.sub,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 15,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  menuScroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sectionHeading: {
    ...TYPE.caption,
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceDim,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 16,
    width: 26,
    textAlign: 'center',
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: COLORS.textPrimary,
  },
  menuSubtitle: {
    ...TYPE.sub,
    fontSize: 12,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.navGreen,
    backgroundColor: COLORS.navGreenSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.tag,
  },
  arrow: {
    fontSize: 13,
    color: COLORS.textHint,
  },
  channelCard: {
    backgroundColor: COLORS.surfaceDim,
    borderRadius: RADIUS.card,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  channelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  channelActiveBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.tag,
  },
  channelTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: RADIUS.full,
    padding: 3,
  },
  channelBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelBtnActive: {
    backgroundColor: COLORS.surface,
    ...SHADOW.s1,
  },
  channelBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textTertiary,
  },
  channelBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  channelSubtext: {
    ...TYPE.caption,
    fontWeight: '400',
    marginTop: 8,
    lineHeight: 15,
  },
  updateCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.card,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D2E3FC',
  },
  updateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  updateIcon: {
    fontSize: 18,
  },
  updateTextCol: {
    flex: 1,
  },
  updateBtnTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
    color: COLORS.primary,
  },
  updateBtnSub: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  updateBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  updateBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: COLORS.textOnColor,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textHint,
  },
});
