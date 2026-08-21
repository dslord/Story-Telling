import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  hasUserLikedStory,
  likeStory,
  unlikeStory,
} from '@/services/firebase/like-service';
import { fetchStoryById } from '@/services/firebase/story-service';
import { isStorySaved, saveStory, unsaveStory } from '@/services/firebase/save-service';
import {
  createComment,
  deleteComment,
  fetchComments,
} from '@/services/firebase/comment-service';
import { Story, StoryComment } from '@/types/models';

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

  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [saveChecking, setSaveChecking] = useState<boolean>(true);
  const [saveActionPending, setSaveActionPending] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Comments state
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState<boolean>(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');
  const [commentSubmitting, setCommentSubmitting] = useState<boolean>(false);
  const [commentValidationError, setCommentValidationError] = useState<string | null>(null);

  const loadComments = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) {
        setCommentsLoading(true);
      }
      setCommentsError(null);
      const data = await fetchComments(id);
      setComments(data);
    } catch (err: any) {
      console.error('Failed to load comments:', err);
      setCommentsError(err?.message || 'Failed to load comments.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!id || commentSubmitting) return;

    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentValidationError('Comment cannot be empty.');
      return;
    }

    if (trimmed.length > 1000) {
      setCommentValidationError('Comment cannot exceed 1000 characters.');
      return;
    }

    setCommentSubmitting(true);
    setCommentValidationError(null);

    try {
      await createComment(id, trimmed);
      setCommentText('');
      await loadComments(true); // silent reload
    } catch (err: any) {
      console.error('Failed to submit comment:', err);
      setCommentValidationError(err?.message || 'Failed to post comment. Please try again.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id) return;

    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Optimistically update UI
              setComments((prev) => prev.filter((c) => c.id !== commentId));
              await deleteComment(id, commentId);
            } catch (err: any) {
              console.error('Failed to delete comment:', err);
              Alert.alert('Error', err?.message || 'Failed to delete comment. Please try again.');
              // Reload in case optimistic update was wrong
              loadComments(true);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  useEffect(() => {
    loadComments();
  }, [id]);

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

  useEffect(() => {
    let isMounted = true;

    async function checkSaveStatus() {
      if (!id || !user?.uid) {
        setSaveChecking(false);
        setIsSaved(false);
        return;
      }

      try {
        setSaveChecking(true);
        setSaveError(null);
        const saved = await isStorySaved(id);
        if (isMounted) {
          setIsSaved(saved);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error checking save status:', err);
          setSaveError('Could not verify save status.');
        }
      } finally {
        if (isMounted) {
          setSaveChecking(false);
        }
      }
    }

    checkSaveStatus();

    return () => {
      isMounted = false;
    };
  }, [id, user?.uid]);

  const handleToggleSave = async () => {
    if (!id || !user?.uid || saveActionPending || saveChecking) return;

    setSaveActionPending(true);
    setSaveError(null);

    const currentlySaved = isSaved;

    try {
      if (currentlySaved) {
        await unsaveStory(id);
        setIsSaved(false);
      } else {
        await saveStory(id);
        setIsSaved(true);
      }
    } catch (err: any) {
      console.error('Failed to toggle save:', err);
      setSaveError(err?.message || 'Failed to update save state. Please try again.');
    } finally {
      setSaveActionPending(false);
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
                <View style={styles.actionButtonsRow}>
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

                  {user && (
                    <Pressable
                      style={[
                        styles.saveButton,
                        isSaved ? styles.savedButton : styles.unsavedButton,
                        (saveActionPending || saveChecking) && styles.disabledSaveButton,
                      ]}
                      onPress={handleToggleSave}
                      disabled={saveActionPending || saveChecking}
                    >
                      {saveChecking || saveActionPending ? (
                        <ActivityIndicator size="small" color={isSaved ? '#3b82f6' : theme.text} />
                      ) : (
                        <ThemedText
                          style={[
                            styles.saveButtonText,
                            isSaved ? styles.savedButtonText : styles.unsavedButtonText,
                          ]}
                        >
                          {isSaved ? '🔖 Saved' : '🏷️ Save'}
                        </ThemedText>
                      )}
                    </Pressable>
                  )}
                </View>
                {(likeError || saveError) && (
                  <View style={styles.errorContainer}>
                    {likeError && (
                      <ThemedText style={styles.likeErrorText}>{likeError}</ThemedText>
                    )}
                    {saveError && (
                      <ThemedText style={styles.saveErrorText}>{saveError}</ThemedText>
                    )}
                  </View>
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

              {/* Comments Section */}
              <View style={styles.commentsSection}>
                <View style={styles.commentsHeader}>
                  <ThemedText type="subtitle" style={styles.commentsTitle}>
                    Comments ({comments.length})
                  </ThemedText>
                </View>

                {/* Comment Input (for authenticated users) */}
                {user ? (
                  <View style={styles.commentInputContainer}>
                    <TextInput
                      style={[
                        styles.commentInput,
                        {
                          borderColor: theme.border,
                          color: theme.text,
                          backgroundColor: theme.backgroundSelected,
                        },
                      ]}
                      placeholder="Add a public comment..."
                      placeholderTextColor={theme.textSecondary}
                      value={commentText}
                      onChangeText={(val) => {
                        setCommentText(val);
                        if (commentValidationError) setCommentValidationError(null);
                      }}
                      maxLength={1000}
                      multiline
                    />
                    {commentValidationError && (
                      <ThemedText style={styles.validationErrorText}>
                        {commentValidationError}
                      </ThemedText>
                    )}
                    <Pressable
                      style={[
                        styles.commentSubmitButton,
                        { backgroundColor: theme.tint },
                        (commentSubmitting || !commentText.trim()) && styles.commentSubmitButtonDisabled,
                      ]}
                      onPress={handleSubmitComment}
                      disabled={commentSubmitting || !commentText.trim()}
                    >
                      {commentSubmitting ? (
                        <ActivityIndicator size="small" color={theme.background} />
                      ) : (
                        <ThemedText style={[styles.commentSubmitButtonText, { color: theme.background }]}>
                          Post Comment
                        </ThemedText>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.loginPromptContainer}>
                    <ThemedText themeColor="textSecondary" type="small">
                      Please sign in to post comments.
                    </ThemedText>
                  </View>
                )}

                {/* Comments List */}
                {commentsLoading && comments.length === 0 ? (
                  <View style={styles.commentsLoadingContainer}>
                    <ActivityIndicator size="small" color={theme.text} />
                  </View>
                ) : commentsError ? (
                  <View style={styles.commentsErrorContainer}>
                    <ThemedText style={styles.commentsErrorText}>{commentsError}</ThemedText>
                    <Pressable style={styles.retryButton} onPress={() => loadComments()}>
                      <ThemedText type="linkPrimary">Retry</ThemedText>
                    </Pressable>
                  </View>
                ) : comments.length === 0 ? (
                  <View style={styles.emptyCommentsContainer}>
                    <ThemedText themeColor="textSecondary" style={styles.emptyCommentsText}>
                      No comments yet. Be the first to share your thoughts!
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.commentsList}>
                    {comments.map((comment) => {
                      const canDelete =
                        user &&
                        (comment.authorUid === user.uid || story.authorUid === user.uid);
                      return (
                        <ThemedView
                          key={comment.id}
                          type="backgroundElement"
                          style={styles.commentItem}
                        >
                          <View style={styles.commentItemHeader}>
                            <ThemedText type="smallBold" style={styles.commentAuthor}>
                              {comment.authorName}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary" style={styles.commentTime}>
                              {formatRelativeTime(comment.createdAt)}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                          {canDelete && (
                            <Pressable
                              style={styles.commentDeleteButton}
                              onPress={() => handleDeleteComment(comment.id)}
                            >
                              <ThemedText type="small" style={styles.deleteText}>
                                Delete
                              </ThemedText>
                            </Pressable>
                          )}
                        </ThemedView>
                      );
                    })}
                  </View>
                )}
              </View>
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

function formatRelativeTime(timestamp: any): string {
  if (!timestamp) return '';
  let date: Date;
  if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
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
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    marginTop: 2,
    fontSize: 13,
    color: '#ef4444',
  },
  saveButton: {
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
  savedButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3b82f6',
  },
  unsavedButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderColor: 'rgba(150, 150, 150, 0.3)',
  },
  disabledSaveButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  savedButtonText: {
    color: '#3b82f6',
  },
  unsavedButtonText: {},
  saveErrorText: {
    marginTop: 2,
    fontSize: 13,
    color: '#ef4444',
  },
  errorContainer: {
    marginTop: 6,
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
  commentsSection: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    paddingTop: 24,
    gap: 16,
  },
  commentsHeader: {
    marginBottom: 4,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  commentInputContainer: {
    gap: 8,
  },
  commentInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  validationErrorText: {
    color: '#ef4444',
    fontSize: 13,
  },
  commentSubmitButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  commentSubmitButtonDisabled: {
    opacity: 0.6,
  },
  commentSubmitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loginPromptContainer: {
    paddingVertical: 8,
  },
  commentsLoadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  commentsErrorContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  commentsErrorText: {
    color: '#ef4444',
    textAlign: 'center',
    fontSize: 14,
  },
  retryButton: {
    padding: 6,
  },
  emptyCommentsContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyCommentsText: {
    textAlign: 'center',
    fontSize: 14,
  },
  commentsList: {
    gap: 12,
  },
  commentItem: {
    padding: 14,
    borderRadius: 8,
    gap: 6,
  },
  commentItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentAuthor: {
    fontSize: 14,
  },
  commentTime: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentDeleteButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  deleteText: {
    color: '#ef4444',
    fontWeight: '500',
  },
});

