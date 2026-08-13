import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryCard } from '@/components/story/StoryCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/services/auth/auth-provider';
import { deleteStory, fetchUserStories } from '@/services/firebase/story-service';
import {
  getCurrentUserProfile,
  getUserLikesReceived,
  getUserStoryCount,
} from '@/services/firebase/user-service';
import { Story, UserProfile } from '@/types/models';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const theme = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [storyCount, setStoryCount] = useState<number>(0);
  const [likesReceived, setLikesReceived] = useState<number>(0);
  const [userStories, setUserStories] = useState<Story[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [storiesLoading, setStoriesLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState<boolean>(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProfileData = useCallback(async (isRefresh = false) => {
    if (!user) {
      setLoading(false);
      setStoriesLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setStoriesLoading(true);
    }
    setError(null);
    setStoriesError(null);

    try {
      const [fetchedProfile, count, likes, storiesResult] = await Promise.all([
        getCurrentUserProfile(),
        getUserStoryCount(user.uid),
        getUserLikesReceived(user.uid),
        fetchUserStories(user.uid).catch((err) => {
          console.error('Error fetching user stories:', err);
          setStoriesError('Failed to load your stories. Please pull down to retry.');
          return null;
        }),
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
      if (storiesResult !== null) {
        setUserStories(storiesResult);
      }
    } catch (err: any) {
      console.error('Error loading profile data:', err);
      setError('Failed to load profile data. Please pull down to retry.');
    } finally {
      setLoading(false);
      setStoriesLoading(false);
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

  const handleDeleteStory = (storyId: string, storyTitle: string, storyLikes: number) => {
    if (deletingId) return;

    Alert.alert(
      'Delete Story',
      `Are you sure you want to delete "${storyTitle}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (deletingId) return;
            setDeletingId(storyId);
            try {
              await deleteStory(storyId);
              setUserStories((prev) => prev.filter((s) => s.id !== storyId));
              setStoryCount((prev) => Math.max(0, prev - 1));
              setLikesReceived((prev) => Math.max(0, prev - (storyLikes || 0)));
              Alert.alert('Success', 'Story deleted successfully.');
            } catch (err: any) {
              console.error('Failed to delete story:', err);
              Alert.alert('Error', err?.message || 'Failed to delete story. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
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

              {/* My Stories Section */}
              <View style={styles.myStoriesSection}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>
                    My Stories
                  </ThemedText>
                </View>

                {storiesLoading && !refreshing ? (
                  <View style={styles.storiesLoadingContainer}>
                    <ActivityIndicator size="small" color={theme.text} />
                    <ThemedText themeColor="textSecondary" style={styles.storiesLoadingText}>
                      Loading your stories...
                    </ThemedText>
                  </View>
                ) : storiesError ? (
                  <View style={styles.storiesErrorBox}>
                    <ThemedText style={styles.storiesErrorText}>{storiesError}</ThemedText>
                  </View>
                ) : userStories.length === 0 ? (
                  <ThemedView type="backgroundElement" style={styles.emptyContainer}>
                    <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                      You haven't published any stories yet.
                    </ThemedText>
                    <Pressable
                      style={({ pressed }) => [
                        styles.createButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => router.push('/create')}
                    >
                      <ThemedText style={styles.createButtonText}>
                        Create a Story
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                ) : (
                  <View style={styles.storiesList}>
                    {userStories.map((story) => (
                      <StoryCard
                        key={story.id}
                        story={story}
                        onPress={() => router.push(`/story/${story.id}`)}
                        onEdit={() => router.push(`/story/edit/${story.id}`)}
                        onDelete={() => handleDeleteStory(story.id, story.title, story.likesCount)}
                        deleting={deletingId === story.id}
                      />
                    ))}
                  </View>
                )}
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
  myStoriesSection: {
    width: '100%',
    marginTop: 8,
    gap: 12,
  },
  sectionHeader: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  storiesLoadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  storiesLoadingText: {
    fontSize: 14,
  },
  storiesErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  storiesErrorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.15)',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  storiesList: {
    width: '100%',
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
