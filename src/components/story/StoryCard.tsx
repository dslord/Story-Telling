import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Story } from '@/types/models';

export interface StoryCardProps {
  story: Story;
  onPress?: () => void;
}

export function StoryCard({ story, onPress }: StoryCardProps) {
  const formattedDate = formatDate(story.createdAt);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.content}>
          <ThemedText style={styles.title} numberOfLines={2}>
            {story.title}
          </ThemedText>

          {Boolean(story.description) && (
            <ThemedText themeColor="textSecondary" style={styles.description} numberOfLines={3}>
              {story.description}
            </ThemedText>
          )}

          <View style={styles.footer}>
            <View style={styles.authorContainer}>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                By <ThemedText type="smallBold">{story.authorName || 'Anonymous'}</ThemedText>
              </ThemedText>
            </View>

            <View style={styles.metaContainer}>
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
        </View>
      </ThemedView>
    </Pressable>
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
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  content: {
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  authorContainer: {
    flex: 1,
    marginRight: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
