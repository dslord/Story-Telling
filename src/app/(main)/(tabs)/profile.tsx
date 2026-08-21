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
import { useThemeContext } from '@/context/theme-context';
import { useAuth } from '@/services/auth/auth-provider';
import { deleteStory, fetchUserStories } from '@/services/firebase/story-service';
import {
  fetchSavedStories,
  fetchSavedStoryIds,
  saveStory,
  unsaveStory,
} from '@/services/firebase/save-service';
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
  const { themeMode, setThemeMode } = useThemeContext();

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

  // Saved stories state
  const [activeTab, setActiveTab] = useState<'myStories' | 'savedStories'>('myStories');
  const [savedStories, setSavedStories] = useState<Story[]>([]);
  const [savedStoriesLoading, setSavedStoriesLoading] = useState<boolean>(false);
  const [savedStoriesError, setSavedStoriesError] = useState<string | null>(null);
  const [savedStoryIds, setSavedStoryIds] = useState<Set<string>>(new Set());
  const [savingStoryIds, setSavingStoryIds] = useState<Set<string>>(new Set());

  const loadSavedStoryIds = useCallback(async () => {
    if (!user) return;
    try {
      const ids = await fetchSavedStoryIds(user.uid);
      setSavedStoryIds(new Set(ids));
    } catch (err) {
      console.warn('Failed to load saved story IDs:', err);
    }
  }, [user]);

  const loadSavedStoriesData = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      if (!silent) {
        setSavedStoriesLoading(true);
      }
      setSavedStoriesError(null);
      const storiesResult = await fetchSavedStories(user.uid);
      setSavedStories(storiesResult);
    } catch (err: any) {
      console.error('Error fetching saved stories:', err);
      setSavedStoriesError('Failed to load saved stories. Please pull down to retry.');
    } finally {
      setSavedStoriesLoading(false);
    }
  }, [user]);

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
        loadSavedStoryIds(),
        activeTab === 'savedStories' || isRefresh
          ? loadSavedStoriesData(true)
          : Promise.resolve(),
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
  }, [user, activeTab, loadSavedStoriesData, loadSavedStoryIds]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    if (activeTab === 'savedStories') {
      loadSavedStoriesData();
    }
  }, [activeTab, loadSavedStoriesData]);

  const handleToggleSave = async (storyId: string) => {
    if (!user) return;

    const wasSaved = savedStoryIds.has(storyId);

    setSavingStoryIds((prev) => {
      const next = new Set(prev);
      next.add(storyId);
      return next;
    });

    try {
      if (wasSaved) {
        await unsaveStory(storyId);
        setSavedStoryIds((prev) => {
          const next = new Set(prev);
          next.delete(storyId);
          return next;
        });
        if (activeTab === 'savedStories') {
          setSavedStories((prev) => prev.filter((s) => s.id !== storyId));
        }
      } else {
        await saveStory(storyId);
        setSavedStoryIds((prev) => {
          const next = new Set(prev);
          next.add(storyId);
          return next;
        });
      }
    } catch (err: any) {
      console.error('Failed to toggle save:', err);
      Alert.alert('Error', err?.message || 'Failed to update saved story.');
    } finally {
      setSavingStoryIds((prev) => {
        const next = new Set(prev);
        next.delete(storyId);
        return next;
      });
    }
  };

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

              {/* Stories Section with Tabs */}
              <View style={styles.myStoriesSection}>
                <View style={styles.tabHeaderContainer}>
                  <Pressable
                    style={[
                      styles.tabHeaderButton,
                      activeTab === 'myStories' && styles.activeTabHeaderButton,
                    ]}
                    onPress={() => setActiveTab('myStories')}
                  >
                    <ThemedText
                      type="subtitle"
                      style={[
                        styles.tabHeaderText,
                        activeTab === 'myStories' ? styles.activeTabHeaderText : styles.inactiveTabHeaderText,
                      ]}
                    >
                      My Stories
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.tabHeaderButton,
                      activeTab === 'savedStories' && styles.activeTabHeaderButton,
                    ]}
                    onPress={() => setActiveTab('savedStories')}
                  >
                    <ThemedText
                      type="subtitle"
                      style={[
                        styles.tabHeaderText,
                        activeTab === 'savedStories' ? styles.activeTabHeaderText : styles.inactiveTabHeaderText,
                      ]}
                    >
                      Saved Stories
                    </ThemedText>
                  </Pressable>
                </View>

                {activeTab === 'myStories' ? (
                  storiesLoading && !refreshing ? (
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
                          isSaved={savedStoryIds.has(story.id)}
                          onToggleSave={() => handleToggleSave(story.id)}
                          saving={savingStoryIds.has(story.id)}
                        />
                      ))}
                    </View>
                  )
                ) : (
                  savedStoriesLoading && !refreshing ? (
                    <View style={styles.storiesLoadingContainer}>
                      <ActivityIndicator size="small" color={theme.text} />
                      <ThemedText themeColor="textSecondary" style={styles.storiesLoadingText}>
                        Loading saved stories...
                      </ThemedText>
                    </View>
                  ) : savedStoriesError ? (
                    <View style={styles.storiesErrorBox}>
                      <ThemedText style={styles.storiesErrorText}>{savedStoriesError}</ThemedText>
                    </View>
                  ) : savedStories.length === 0 ? (
                    <ThemedView type="backgroundElement" style={styles.emptyContainer}>
                      <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                        You don't have any saved stories yet.
                      </ThemedText>
                    </ThemedView>
                  ) : (
                    <View style={styles.storiesList}>
                      {savedStories.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          onPress={() => router.push(`/story/${story.id}`)}
                          isSaved={true}
                          onToggleSave={() => handleToggleSave(story.id)}
                          saving={savingStoryIds.has(story.id)}
                        />
                      ))}
                    </View>
                  )
                )}
              </View>

              {/* Theme Section */}
              <View style={styles.themeSection}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>
                    App Theme
                  </ThemedText>
                </View>
                <View style={styles.themeSelector}>
                  {(['light', 'dark', 'system'] as const).map((mode) => {
                    const isSelected = themeMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        style={({ pressed }) => [
                          styles.themeOptionButton,
                          {
                            borderColor: theme.border,
                            backgroundColor: isSelected ? theme.backgroundSelected : 'transparent',
                          },
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() => setThemeMode(mode)}
                      >
                        <ThemedText
                          style={[
                            styles.themeOptionText,
                            isSelected && styles.themeOptionTextActive,
                          ]}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
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
  themeSection: {
    width: '100%',
    marginTop: 8,
    gap: 12,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  themeOptionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  themeOptionTextActive: {
    color: '#3b82f6',
  },
  tabHeaderContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
    marginBottom: 16,
  },
  tabHeaderButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabHeaderButton: {
    borderBottomColor: '#3b82f6',
  },
  tabHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabHeaderText: {
    color: '#3b82f6',
  },
  inactiveTabHeaderText: {
    color: '#888888',
  },
});
