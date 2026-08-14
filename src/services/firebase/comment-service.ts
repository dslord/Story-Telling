import {
  addDoc,
  deleteDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { auth } from '@/config/firebase';
import { docRefs, storyCommentsCollection } from './collections';
import { StoryComment } from '@/types/models';
import { getCurrentUserProfile } from './user-service';

/**
 * Creates a comment on a specific story.
 * @param storyId The ID of the story to comment on.
 * @param text The comment text.
 * @returns The generated comment ID.
 */
export async function createComment(storyId: string, text: string): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Unauthenticated: User must be signed in to create comments.');
  }

  if (!storyId) {
    throw new Error('Invalid storyId.');
  }

  const trimmedText = (text || '').trim();
  if (!trimmedText) {
    throw new Error('Comment text cannot be empty.');
  }

  if (trimmedText.length > 1000) {
    throw new Error('Comment text exceeds the 1000 character limit.');
  }

  // Get current user's profile to retrieve their display name
  const userProfile = await getCurrentUserProfile();
  let authorName = 'Anonymous';
  if (userProfile) {
    const first = (userProfile.firstName || '').trim();
    const last = (userProfile.lastName || '').trim();
    authorName = [first, last].filter(Boolean).join(' ') || userProfile.email.split('@')[0] || 'User';
  } else if (currentUser.displayName) {
    authorName = currentUser.displayName;
  } else if (currentUser.email) {
    authorName = currentUser.email.split('@')[0];
  }

  const commentData = {
    storyId,
    authorUid: currentUser.uid,
    authorName,
    text: trimmedText,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(storyCommentsCollection(storyId), commentData);
  return docRef.id;
}

/**
 * Fetches comments for a story, ordered by creation date descending, limited to 50 comments.
 * @param storyId The ID of the story.
 * @returns An array of comments.
 */
export async function fetchComments(storyId: string): Promise<StoryComment[]> {
  if (!storyId) return [];

  const q = query(
    storyCommentsCollection(storyId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const querySnapshot = await getDocs(q);
  const comments: StoryComment[] = [];

  querySnapshot.forEach((doc) => {
    comments.push({
      ...doc.data(),
      id: doc.id,
    } as StoryComment);
  });

  return comments;
}

/**
 * Deletes a comment document.
 * @param storyId The ID of the story.
 * @param commentId The ID of the comment to delete.
 */
export async function deleteComment(storyId: string, commentId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Unauthenticated: User must be signed in to delete comments.');
  }

  if (!storyId || !commentId) {
    throw new Error('storyId and commentId are required.');
  }

  const commentRef = docRefs.storyComment(storyId, commentId);
  await deleteDoc(commentRef);
}
