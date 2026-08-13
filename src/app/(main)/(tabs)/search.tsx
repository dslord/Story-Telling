import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryCard } from '@/components/story/StoryCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { searchStories } from '@/services/firebase/story-service';
import { Story } from '@/types/models';

export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedTerm, setSearchedTerm] = useState('');

  // Keeps track of the latest query sequence to prevent race conditions / stale results
  const queryCounter = useRef(0);

  useEffect(() => {
    const trimmed = searchTerm.trim();

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      setSearchedTerm('');
      return;
    }

    const currentQueryId = ++queryCounter.current;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const data = await searchStories(trimmed);
        if (currentQueryId === queryCounter.current) {
          setResults(data);
          setSearchedTerm(trimmed);
        }
      } catch (err: any) {
        if (currentQueryId === queryCounter.current) {
          console.error('Error searching stories:', err);
          setError(err?.message || 'Failed to search stories. Please try again.');
        }
      } finally {
        if (currentQueryId === queryCounter.current) {
          setLoading(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    setSearchedTerm('');
    setError(null);
  };

  const handleRetry = () => {
    const term = searchTerm;
    setSearchTerm('');
    setTimeout(() => setSearchTerm(term), 50);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            Discover Stories
          </ThemedText>

          {/* Search Input Bar */}
          <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.searchIcon}>🔍</ThemedText>
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by story title..."
              placeholderTextColor={theme.textSecondary}
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {Boolean(searchTerm.length > 0) && (
              <Pressable
                onPress={handleClear}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
                hitSlop={8}
              >
                <ThemedText themeColor="textSecondary" style={styles.clearText}>
                  ✕
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.text} />
              <ThemedText themeColor="textSecondary" style={styles.stateText}>
                Searching stories...
              </ThemedText>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <Pressable style={styles.retryButton} onPress={handleRetry}>
                <ThemedText type="linkPrimary">Try Search Again</ThemedText>
              </Pressable>
            </View>
          ) : !searchTerm.trim() ? (
            <View style={styles.centerContainer}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                🔍 Search Stories
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.stateText}>
                Search for a story to discover.
              </ThemedText>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.centerContainer}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                No stories found
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.stateText}>
                No stories found for "{searchedTerm}".
              </ThemedText>
            </View>
          ) : (
            <View style={styles.resultsList}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.resultsCount}>
                Found {results.length} story{results.length === 1 ? '' : 's'} matching "{searchedTerm}"
              </ThemedText>
              {results.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onPress={() => router.push(`/story/${story.id}`)}
                />
              ))}
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.2)',
    gap: 10,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  clearText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    fontSize: 15,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    padding: 8,
  },
  resultsList: {
    gap: 4,
  },
  resultsCount: {
    marginBottom: 8,
  },
});
