import {
  deleteDoc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth } from '@/config/firebase';
import { docRefs, userSavedStoriesCollection } from './collections';
import { fetchStoryById } from './story-service';
import { Story } from '@/types/models';

/**
 * Saves a story for the currently authenticated user.
 * Uses setDoc with explicit storyId to prevent duplicate entries.
 */
export async function saveStory(storyId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to save stories.');
  }

  if (!storyId || !storyId.trim()) {
    throw new Error('Story ID is required.');
  }

  const savedRef = docRefs.savedStory(currentUser.uid, storyId);
  await setDoc(savedRef, {
    storyId,
    savedAt: serverTimestamp(),
  });
}

/**
 * Unsaves a story for the currently authenticated user.
 * Deletes the specific saved-story document.
 */
export async function unsaveStory(storyId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to unsave stories.');
  }

  if (!storyId || !storyId.trim()) {
    throw new Error('Story ID is required.');
  }

  const savedRef = docRefs.savedStory(currentUser.uid, storyId);
  await deleteDoc(savedRef);
}

/**
 * Checks if a story is saved by the currently authenticated user.
 */
export async function isStorySaved(storyId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser || !storyId || !storyId.trim()) {
    return false;
  }

  const savedRef = docRefs.savedStory(currentUser.uid, storyId);
  const snap = await getDoc(savedRef);
  return snap.exists();
}

/**
 * Fetches all saved story document IDs for a specific user, ordered by savedAt desc.
 */
export async function fetchSavedStoryIds(uid: string): Promise<string[]> {
  if (!uid || !uid.trim()) {
    return [];
  }

  const q = query(userSavedStoriesCollection(uid), orderBy('savedAt', 'desc'));
  const querySnapshot = await getDocs(q);

  const ids: string[] = [];
  querySnapshot.forEach((doc) => {
    ids.push(doc.id);
  });

  return ids;
}

/**
 * Fetches all saved Story documents for a specific user.
 * Gracefully handles missing (deleted) stories by silently omitting them.
 */
export async function fetchSavedStories(uid: string): Promise<Story[]> {
  const storyIds = await fetchSavedStoryIds(uid);
  if (storyIds.length === 0) {
    return [];
  }

  // Fetch all stories in parallel using fetchStoryById helper
  const fetchPromises = storyIds.map((storyId) =>
    fetchStoryById(storyId).catch((err) => {
      console.warn(`Failed to fetch story ${storyId}:`, err);
      return null;
    })
  );

  const results = await Promise.all(fetchPromises);

  // Silently filter out null values (e.g. deleted stories)
  return results.filter((story): story is Story => story !== null);
}
