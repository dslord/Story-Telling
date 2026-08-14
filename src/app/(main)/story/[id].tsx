import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
  hasUserLikedStory,
  likeStory,
  unlikeStory,
} from '@/services/firebase/like-service';
import { fetchStoryById } from '@/services/firebase/story-service';
import { Story } from '@/types/models';

export default function FullStoryScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [likeChecking, setLikeChecking] = useState<boolean>(true);
  const [likeActionPending, setLikeActionPending] = useState<boolean>(false);
  const [likeError, setLikeError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStory() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await fetchStoryById(id);
        if (isMounted) {
          setStory(data);
          setLikesCount(data?.likesCount ?? 0);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load story details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadStory();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    let isMounted = true;

    async function checkLikeStatus() {
      if (!id || !user?.uid) {
        setLikeChecking(false);
        setIsLiked(false);
        return;
      }

      try {
        setLikeChecking(true);
        setLikeError(null);
        const liked = await hasUserLikedStory(id, user.uid);
        if (isMounted) {
          setIsLiked(liked);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error checking like status:', err);
          setLikeError('Could not verify like status.');
        }
      } finally {
        if (isMounted) {
          setLikeChecking(false);
        }
      }
    }

    checkLikeStatus();

    return () => {
      isMounted = false;
    };
  }, [id, user?.uid]);

  const handleToggleLike = async () => {
    if (!id || !user?.uid || likeActionPending || likeChecking) return;

    setLikeActionPending(true);
    setLikeError(null);

    const currentlyLiked = isLiked;

    try {
      if (currentlyLiked) {
        await unlikeStory(id, user.uid);
        setIsLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      } else {
        await likeStory(id, user.uid);
        setIsLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    } catch (err: any) {
      console.error('Failed to toggle like:', err);
      setLikeError(err?.message || 'Failed to update like state. Please try again.');
    } finally {
      setLikeActionPending(false);
    }
  };

  const formattedDate = formatDate(story?.createdAt);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: story?.title || 'Story Details',
          headerBackTitle: 'Back',
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText themeColor="textSecondary" style={styles.stateText}>
              Loading story...
            </ThemedText>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <ThemedText type="linkPrimary">Go Back</ThemedText>
            </Pressable>
          </View>
        ) : !story ? (
          <View style={styles.centerContainer}>
            <ThemedText style={styles.stateText}>Story not found.</ThemedText>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <ThemedText type="linkPrimary">Go Back to Feed</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.bodyContent}>
              <ThemedText type="subtitle" style={styles.title}>
                {story.title}
              </ThemedText>

              <View style={styles.authorRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  By <ThemedText type="smallBold">{story.authorName || 'Anonymous'}</ThemedText>
                </ThemedText>
                <View style={styles.metaRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    ❤️ {likesCount}
                  </ThemedText>
                  {Boolean(formattedDate) && (
                    <ThemedText type="small" themeColor="textSecondary">
                      • {formattedDate}
                    </ThemedText>
                  )}
                </View>
              </View>

              <View style={styles.likeSection}>
                <Pressable
                  style={[
                    styles.likeButton,
                    isLiked ? styles.likedButton : styles.unlikedButton,
                    (likeActionPending || likeChecking || !user) && styles.disabledLikeButton,
                  ]}
                  onPress={handleToggleLike}
                  disabled={likeActionPending || likeChecking || !user}
                >
                  {likeChecking || likeActionPending ? (
                    <ActivityIndicator size="small" color={isLiked ? '#ef4444' : theme.text} />
                  ) : (
                    <ThemedText
                      style={[
                        styles.likeButtonText,
                        isLiked ? styles.likedButtonText : styles.unlikedButtonText,
                      ]}
                    >
                      {isLiked ? '❤️ Liked' : '🤍 Like'}
                    </ThemedText>
                  )}
                </Pressable>
                {likeError && (
                  <ThemedText style={styles.likeErrorText}>{likeError}</ThemedText>
                )}
              </View>

              {Boolean(story.description) && (
                <ThemedView type="backgroundElement" style={styles.descriptionBox}>
                  <ThemedText themeColor="textSecondary" style={styles.descriptionText}>
                    {story.description}
                  </ThemedText>
                </ThemedView>
              )}

              <View style={styles.storySection}>
                <ThemedText style={styles.storyText}>{story.story}</ThemedText>
              </View>

              {Boolean(story.moral) && (
                <ThemedView type="backgroundSelected" style={styles.moralBox}>
                  <ThemedText type="smallBold" style={styles.moralTitle}>
                    💡 Moral of the Story
                  </ThemedText>
                  <ThemedText style={styles.moralText}>{story.moral}</ThemedText>
                </ThemedView>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '';
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  stateText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 16,
    padding: 8,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  bodyContent: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  likeSection: {
    marginVertical: 4,
    alignItems: 'flex-start',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 110,
    height: 40,
  },
  likedButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  unlikedButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderColor: 'rgba(150, 150, 150, 0.3)',
  },
  disabledLikeButton: {
    opacity: 0.6,
  },
  likeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  likedButtonText: {
    color: '#ef4444',
  },
  unlikedButtonText: {},
  likeErrorText: {
    marginTop: 6,
    fontSize: 13,
    color: '#ef4444',
  },
  descriptionBox: {
    padding: 14,
    borderRadius: 8,
  },
  descriptionText: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  storySection: {
    marginVertical: 8,
  },
  storyText: {
    fontSize: 16,
    lineHeight: 26,
  },
  moralBox: {
    padding: 16,
    borderRadius: 10,
    marginTop: 8,
    gap: 6,
  },
  moralTitle: {
    fontSize: 15,
  },
  moralText: {
    fontSize: 15,
    lineHeight: 22,
  },
});

