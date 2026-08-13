import { getCountFromServer, getDoc, getDocs, query, where } from 'firebase/firestore';

import { auth } from '@/config/firebase';
import { UserProfile } from '@/types/models';
import { collections, docRefs } from './collections';

/**
 * Fetches the currently authenticated user's profile document from Firestore.
 * Requires an active Firebase Auth user session.
 * @returns UserProfile or null if unauthenticated or missing profile.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  const userDocRef = docRefs.user(currentUser.uid);
  const docSnap = await getDoc(userDocRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    ...docSnap.data(),
    uid: docSnap.id,
  };
}

/**
 * Gets the total number of stories published by a given user (uid).
 * Uses Firestore getCountFromServer to avoid downloading full document payloads.
 * @param uid User ID
 * @returns Count of stories authored by the user.
 */
export async function getUserStoryCount(uid: string): Promise<number> {
  if (!uid) return 0;

  try {
    const q = query(collections.stories, where('authorUid', '==', uid));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error('Error fetching user story count:', error);
    return 0;
  }
}

/**
 * Calculates the total number of likes received across all stories published by a given user (uid).
 * Uses existing Firestore schema by summing likesCount from all stories where authorUid == uid.
 * @param uid User ID
 * @returns Total likes received across user's stories.
 */
export async function getUserLikesReceived(uid: string): Promise<number> {
  if (!uid) return 0;

  try {
    const q = query(collections.stories, where('authorUid', '==', uid));
    const querySnapshot = await getDocs(q);

    let totalLikes = 0;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      totalLikes += data.likesCount || 0;
    });

    return totalLikes;
  } catch (error) {
    console.error('Error calculating user likes received:', error);
    return 0;
  }
}
