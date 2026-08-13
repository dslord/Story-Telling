import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/services/auth/auth-provider';
import {
  getCurrentUserProfile,
  getUserLikesReceived,
  getUserStoryCount,
} from '@/services/firebase/user-service';
import { UserProfile } from '@/types/models';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const theme = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [storyCount, setStoryCount] = useState<number>(0);
  const [likesReceived, setLikesReceived] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState<boolean>(false);

  const loadProfileData = useCallback(async (isRefresh = false) => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [fetchedProfile, count, likes] = await Promise.all([
        getCurrentUserProfile(),
        getUserStoryCount(user.uid),
        getUserLikesReceived(user.uid),
      ]);

      if (fetchedProfile) {
        setProfile(fetchedProfile);
      } else {
        // Fallback for user without Firestore profile document yet
        const nameParts = (user.displayName || '').trim().split(' ');
        const fallbackFirst = nameParts[0] || (user.email ? user.email.split('@')[0] : 'User');
        const fallbackLast = nameParts.slice(1).join(' ') || '';

        setProfile({
          uid: user.uid,
          email: user.email || '',
          firstName: fallbackFirst,
          lastName: fallbackLast,
          profilePicture: null,
          themePreference: 'dark',
          createdAt: null as any,
        });
      }

      setStoryCount(count);
      setLikesReceived(likes);
    } catch (err: any) {
      console.error('Error loading profile data:', err);
      setError('Failed to load profile data. Please pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (err: any) {
      console.error('Error signing out:', err);
      setError(err?.message || 'Failed to sign out. Please try again.');
      setSigningOut(false);
    }
  };

  const getInitials = (): string => {
    const first = profile?.firstName?.trim() || '';
    const last = profile?.lastName?.trim() || '';
    if (first || last) {
      const fLetter = first[0] || '';
      const lLetter = last[0] || '';
      return (fLetter + lLetter).toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'User Profile';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadProfileData(true)}
              tintColor={theme.text}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              Profile
            </ThemedText>
          </View>

          {Boolean(error) && (
            <View style={styles.errorBox}>
              <ThemedText style={styles.errorBoxText}>{error}</ThemedText>
            </View>
          )}

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.text} />
              <ThemedText themeColor="textSecondary" style={styles.loadingText}>
                Loading profile...
              </ThemedText>
            </View>
          ) : (
            <View style={styles.profileSection}>
              {/* Initials Avatar */}
              <View style={[styles.avatarCircle, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={styles.avatarInitials}>
                  {getInitials()}
                </ThemedText>
              </View>

              {/* User Identity Info */}
              <View style={styles.identityContainer}>
                <ThemedText type="subtitle" style={styles.userName}>
                  {fullName}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.userEmail}>
                  {profile?.email || user?.email || ''}
                </ThemedText>
              </View>

              {/* Statistics Row */}
              <View style={styles.statsContainer}>
                <ThemedView type="backgroundElement" style={styles.statCard}>
                  <ThemedText style={styles.statNumber}>{storyCount}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                    Stories Published
                  </ThemedText>
                </ThemedView>

                <ThemedView type="backgroundElement" style={styles.statCard}>
                  <ThemedText style={styles.statNumber}>{likesReceived}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                    Likes Received
                  </ThemedText>
                </ThemedView>
              </View>

              {/* Sign Out Button */}
              <View style={styles.signOutContainer}>
                <Pressable
                  style={[
                    styles.signOutButton,
                    signingOut && styles.disabledButton,
                  ]}
                  onPress={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#ef4444" />
                      <ThemedText style={styles.signOutButtonText}>Signing Out...</ThemedText>
                    </View>
                  ) : (
                    <ThemedText style={styles.signOutButtonText}>Sign Out</ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorBoxText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    gap: 24,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(150, 150, 150, 0.3)',
    marginTop: 8,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1,
  },
  identityContainer: {
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 15,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.15)',
    gap: 4,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  signOutContainer: {
    width: '100%',
    marginTop: 16,
  },
  signOutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  signOutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
