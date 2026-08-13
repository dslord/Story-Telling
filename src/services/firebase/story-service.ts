import { query, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { collections, docRefs } from './collections';
import { Story } from '@/types/models';

/**
 * Fetches all published stories from Firestore ordered by creation date descending.
 */
export async function fetchStories(): Promise<Story[]> {
  const q = query(collections.stories, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);

  const stories: Story[] = [];
  querySnapshot.forEach((doc) => {
    stories.push({
      ...doc.data(),
      id: doc.id,
    });
  });

  return stories;
}

/**
 * Fetches a single story document by its storyId from Firestore.
 */
export async function fetchStoryById(storyId: string): Promise<Story | null> {
  if (!storyId) return null;
  const docSnap = await getDoc(docRefs.story(storyId));
  if (!docSnap.exists()) {
    return null;
  }
  return {
    ...docSnap.data(),
    id: docSnap.id,
  };
}
