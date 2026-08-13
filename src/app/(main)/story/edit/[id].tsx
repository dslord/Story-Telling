import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/services/auth/auth-provider';
import { fetchStoryById, updateStory } from '@/services/firebase/story-service';

export default function EditStoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [storyContent, setStoryContent] = useState('');
  const [moral, setMoral] = useState('');

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    story?: string;
    moral?: string;
  }>({});

  useEffect(() => {
    let isMounted = true;

    async function loadStoryForEditing() {
      if (!id) {
        setLoading(false);
        setLoadError('Story ID is missing.');
        return;
      }

      try {
        setLoading(true);
        setLoadError(null);

        const story = await fetchStoryById(id);

        if (!isMounted) return;

        if (!story) {
          setLoadError('Story not found.');
          return;
        }

        if (user && story.authorUid !== user.uid) {
          setLoadError('Unauthorized: You can only edit your own stories.');
          return;
        }

        setTitle(story.title || '');
        setDescription(story.description || '');
        setStoryContent(story.story || '');
        setMoral(story.moral || '');
      } catch (err: any) {
        if (isMounted) {
          console.error('Error loading story for editing:', err);
          setLoadError(err?.message || 'Failed to load story for editing.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadStoryForEditing();

    return () => {
      isMounted = false;
    };
  }, [id, user?.uid]);

  const validate = (): boolean => {
    const newErrors: {
      title?: string;
      description?: string;
      story?: string;
      moral?: string;
    } = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required.';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required.';
    }
    if (!storyContent.trim()) {
      newErrors.story = 'Story content is required.';
    }
    if (!moral.trim()) {
      newErrors.moral = 'Moral is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (saving || !id) return;

    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      await updateStory(id, {
        title: title.trim(),
        description: description.trim(),
        story: storyContent.trim(),
        moral: moral.trim(),
      });

      router.replace({
        pathname: '/story/[id]',
        params: { id },
      });
    } catch (err: any) {
      console.error('Failed to update story:', err);
      setSubmitError(err?.message || 'Failed to update story. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Story',
          headerBackTitle: 'Cancel',
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText themeColor="textSecondary" style={styles.loadingText}>
              Loading story details...
            </ThemedText>
          </View>
        ) : loadError ? (
          <View style={styles.centerContainer}>
            <ThemedText style={styles.errorBoxText}>{loadError}</ThemedText>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <ThemedText type="linkPrimary">Go Back</ThemedText>
            </Pressable>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.flexOne}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.header}>
                <ThemedText type="subtitle" style={styles.headerTitle}>
                  Edit Story
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.headerSubtitle}>
                  Update your story content and moral.
                </ThemedText>
              </View>

              {Boolean(submitError) && (
                <View style={styles.errorBox}>
                  <ThemedText style={styles.errorBoxText}>{submitError}</ThemedText>
                </View>
              )}

              {/* Title Field */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <ThemedText type="smallBold">
                    Title <ThemedText style={styles.requiredAsterisk}>*</ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {title.length}/200
                  </ThemedText>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderColor: errors.title ? '#ef4444' : 'rgba(150, 150, 150, 0.25)',
                    },
                  ]}
                  placeholder="Enter story title"
                  placeholderTextColor={theme.textSecondary}
                  value={title}
                  onChangeText={(text) => {
                    setTitle(text);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  maxLength={200}
                  editable={!saving}
                />
                {Boolean(errors.title) && (
                  <ThemedText style={styles.fieldError}>{errors.title}</ThemedText>
                )}
              </View>

              {/* Description Field */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <ThemedText type="smallBold">
                    Short Summary / Description <ThemedText style={styles.requiredAsterisk}>*</ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {description.length}/1000
                  </ThemedText>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    styles.multilineInputSmall,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderColor: errors.description ? '#ef4444' : 'rgba(150, 150, 150, 0.25)',
                    },
                  ]}
                  placeholder="A brief overview of your story"
                  placeholderTextColor={theme.textSecondary}
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  maxLength={1000}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!saving}
                />
                {Boolean(errors.description) && (
                  <ThemedText style={styles.fieldError}>{errors.description}</ThemedText>
                )}
              </View>

              {/* Story Content Field */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <ThemedText type="smallBold">
                    Story Content <ThemedText style={styles.requiredAsterisk}>*</ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {storyContent.length}/50000
                  </ThemedText>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    styles.multilineInputLarge,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderColor: errors.story ? '#ef4444' : 'rgba(150, 150, 150, 0.25)',
                    },
                  ]}
                  placeholder="Write your full story here..."
                  placeholderTextColor={theme.textSecondary}
                  value={storyContent}
                  onChangeText={(text) => {
                    setStoryContent(text);
                    if (errors.story) setErrors((prev) => ({ ...prev, story: undefined }));
                  }}
                  maxLength={50000}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
                  editable={!saving}
                />
                {Boolean(errors.story) && (
                  <ThemedText style={styles.fieldError}>{errors.story}</ThemedText>
                )}
              </View>

              {/* Moral Field */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <ThemedText type="smallBold">
                    Moral of the Story <ThemedText style={styles.requiredAsterisk}>*</ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {moral.length}/500
                  </ThemedText>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    styles.multilineInputSmall,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderColor: errors.moral ? '#ef4444' : 'rgba(150, 150, 150, 0.25)',
                    },
                  ]}
                  placeholder="What key lesson or moral does this story teach?"
                  placeholderTextColor={theme.textSecondary}
                  value={moral}
                  onChangeText={(text) => {
                    setMoral(text);
                    if (errors.moral) setErrors((prev) => ({ ...prev, moral: undefined }));
                  }}
                  maxLength={500}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  editable={!saving}
                />
                {Boolean(errors.moral) && (
                  <ThemedText style={styles.fieldError}>{errors.moral}</ThemedText>
                )}
              </View>

              {/* Save Button */}
              <Pressable
                style={[
                  styles.saveButton,
                  saving && styles.disabledSaveButton,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <ThemedText style={styles.saveButtonText}>Saving Changes...</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
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
  flexOne: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
  backButton: {
    marginTop: 16,
    padding: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 4,
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
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requiredAsterisk: {
    color: '#ef4444',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multilineInputSmall: {
    minHeight: 80,
  },
  multilineInputLarge: {
    minHeight: 180,
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disabledSaveButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
