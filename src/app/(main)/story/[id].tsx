import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { fetchStoryById } from '@/services/firebase/story-service';
import { Story } from '@/types/models';

export default function FullStoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<boolean>(false);

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

  const hasValidImage = Boolean(story?.previewImage && story.previewImage.trim() !== '' && !imageError);
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
            <ActivityIndicator size="large" />
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
            {hasValidImage && (
              <Image
                source={{ uri: story.previewImage }}
                style={styles.image}
                onError={() => setImageError(true)}
                resizeMode="cover"
              />
            )}

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
                    ❤️ {story.likesCount ?? 0}
                  </ThemedText>
                  {Boolean(formattedDate) && (
                    <ThemedText type="small" themeColor="textSecondary">
                      • {formattedDate}
                    </ThemedText>
                  )}
                </View>
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
  image: {
    width: '100%',
    height: 240,
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
