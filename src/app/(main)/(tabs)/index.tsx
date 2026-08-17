import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DocumentSnapshot } from 'firebase/firestore';

import { StoryCard } from '@/components/story/StoryCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { fetchMoreStories, fetchStories } from '@/services/firebase/story-service';
import { Story, SortMode } from '@/types/models';
import { Spacing } from '@/constants/theme';

interface SortButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: Record<string, string>;
}

function SortButton({ label, active, onPress, theme }: SortButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sortButton,
        {
          backgroundColor: active ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: active ? theme.text : theme.border,
        },
        pressed && styles.sortButtonPressed,
      ]}
    >
      <ThemedText style={[styles.sortButtonText, { color: theme.text }]}>{label}</ThemedText>
    </Pressable>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot<unknown> | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const loadingMoreRef = useRef<boolean>(false);

  const loadStories = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
        loadingMoreRef.current = false;
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetchStories(sortMode);
        setStories(result.stories);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
        loadingMoreRef.current = false;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stories. Please try again.';
        setError(errorMessage);
        loadingMoreRef.current = false;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sortMode]
  );

  const loadMoreStories = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !lastDoc || loadingMore) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const result = await fetchMoreStories(sortMode, lastDoc);
      setStories((prev) => [...prev, ...result.stories]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn('Failed to load more stories:', errorMessage);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [sortMode, lastDoc, hasMore, loadingMore]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const handleRefresh = () => {
    loadStories(true);
  };

  const handleStoryPress = (id: string) => {
    router.push(`/story/${id}`);
  };

  const handleEndReached = () => {
    if (hasMore && !loadingMore && !loadingMoreRef.current) {
      loadMoreStories();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.headerContainer}>
          <ThemedText type="title">Feed</ThemedText>
        </View>

        <View style={styles.sortContainer}>
          <SortButton
            label="Latest"
            active={sortMode === 'latest'}
            onPress={() => setSortMode('latest')}
            theme={theme}
          />
          <SortButton
            label="Most Liked"
            active={sortMode === 'mostLiked'}
            onPress={() => setSortMode('mostLiked')}
            theme={theme}
          />
          <SortButton
            label="Most Commented"
            active={sortMode === 'mostCommented'}
            onPress={() => setSortMode('mostCommented')}
            theme={theme}
          />
        </View>

        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText themeColor="textSecondary" style={styles.stateText}>
              Loading stories...
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={stories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <StoryCard story={item} onPress={() => handleStoryPress(item.id)} />
            )}
            contentContainerStyle={styles.listContent}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                {error ? (
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                ) : (
                  <ThemedText themeColor="textSecondary" style={styles.stateText}>
                    No stories available yet.
                  </ThemedText>
                )}
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={theme.text} />
                </View>
              ) : null
            }
          />
        )}
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
  headerContainer: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  sortButton: {
    flex: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortButtonPressed: {
    opacity: 0.7,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    minHeight: 300,
  },
  stateText: {
    marginTop: Spacing.two,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingMoreContainer: {
    paddingVertical: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
