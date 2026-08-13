import {
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '@/config/firebase';
import { docRefs, storyLikesCollection } from './collections';

/**
 * Checks whether a given user (uid) has already liked a story.
 */
export async function hasUserLikedStory(storyId: string, uid: string): Promise<boolean> {
  if (!storyId || !uid) return false;
  const likeRef = docRefs.storyLike(storyId, uid);
  const snap = await getDoc(likeRef);
  return snap.exists();
}

/**
 * Likes a story atomically using a Firestore transaction.
 * Prevents race conditions and duplicate likes.
 */
export async function likeStory(storyId: string, uid: string): Promise<void> {
  if (!storyId || !uid) return;

  const likeRef = docRefs.storyLike(storyId, uid);
  const storyRef = docRefs.story(storyId);

  await runTransaction(db, async (transaction) => {
    const likeDoc = await transaction.get(likeRef);
    const storyDoc = await transaction.get(storyRef);

    if (!storyDoc.exists()) {
      throw new Error('Story does not exist.');
    }

    // If like document already exists, return early to prevent duplicate likes
    if (likeDoc.exists()) {
      return;
    }

    // Set like document under stories/{storyId}/likes/{uid}
    transaction.set(likeRef, {
      likedAt: serverTimestamp() as any,
    });

    // Atomically increment likesCount on story document
    transaction.update(storyRef, {
      likesCount: increment(1),
    });
  });
}

/**
 * Unlikes a story atomically using a Firestore transaction.
 * Prevents race conditions and duplicate unlikes.
 */
export async function unlikeStory(storyId: string, uid: string): Promise<void> {
  if (!storyId || !uid) return;

  const likeRef = docRefs.storyLike(storyId, uid);
  const storyRef = docRefs.story(storyId);

  await runTransaction(db, async (transaction) => {
    const likeDoc = await transaction.get(likeRef);
    const storyDoc = await transaction.get(storyRef);

    if (!storyDoc.exists()) {
      throw new Error('Story does not exist.');
    }

    // If like document does not exist, return early to prevent extra decrements
    if (!likeDoc.exists()) {
      return;
    }

    // Delete like document
    transaction.delete(likeRef);

    // Atomically decrement likesCount on story document
    transaction.update(storyRef, {
      likesCount: increment(-1),
    });
  });
}

