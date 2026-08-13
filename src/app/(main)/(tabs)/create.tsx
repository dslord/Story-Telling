import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { createStory } from '@/services/firebase/story-service';

export default function CreateStoryScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [storyContent, setStoryContent] = useState('');
  const [moral, setMoral] = useState('');

  const [publishing, setPublishing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    story?: string;
    moral?: string;
  }>({});

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

  const handlePublish = async () => {
    if (publishing) return;

    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setPublishing(true);

    try {
      const storyId = await createStory({
        title,
        description,
        story: storyContent,
        moral,
        previewImage: '',
      });

      setTitle('');
      setDescription('');
      setStoryContent('');
      setMoral('');
      setErrors({});

      router.push({
        pathname: '/story/[id]',
        params: { id: storyId },
      });
    } catch (err: any) {
      console.error('Failed to publish story:', err);
      setSubmitError(err?.message || 'Failed to publish story. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
                Create Story
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.headerSubtitle}>
                Craft and publish your original story for readers.
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
                returnKeyType="next"
                editable={!publishing}
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
                editable={!publishing}
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
                editable={!publishing}
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
                editable={!publishing}
              />
              {Boolean(errors.moral) && (
                <ThemedText style={styles.fieldError}>{errors.moral}</ThemedText>
              )}
            </View>

            {/* Preview Image Placeholder Area */}
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Preview Image</ThemedText>
              <View
                style={[
                  styles.imagePlaceholder,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText style={styles.placeholderIcon}>🖼️</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Image Upload (Coming Soon)
                </ThemedText>
              </View>
            </View>

            {/* Publish Button */}
            <Pressable
              style={[
                styles.publishButton,
                publishing && styles.disabledPublishButton,
              ]}
              onPress={handlePublish}
              disabled={publishing}
            >
              {publishing ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <ThemedText style={styles.publishButtonText}>Publishing...</ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.publishButtonText}>Publish Story</ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
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
  imagePlaceholder: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.25)',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderIcon: {
    fontSize: 24,
  },
  publishButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disabledPublishButton: {
    opacity: 0.6,
  },
  publishButtonText: {
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

