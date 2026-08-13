import { addDoc, getDoc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';

import { auth } from '@/config/firebase';
import { collections, docRefs } from './collections';
import { Story } from '@/types/models';

export interface CreateStoryInput {
  title: string;
  description: string;
  story: string;
  moral: string;
}

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

/**
 * Validates user input and creates a new story document in Firestore.
 * Requires an authenticated Firebase user session.
 * @returns The newly created Firestore story document ID.
 */
export async function createStory(input: CreateStoryInput): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to create a story.');
  }

  if (!input) {
    throw new Error('Story inputs are required.');
  }

  const title = input.title?.trim() || '';
  const description = input.description?.trim() || '';
  const storyText = input.story?.trim() || '';
  const moral = input.moral?.trim() || '';

  // Required non-empty field validations
  if (!title) {
    throw new Error('Story title cannot be empty.');
  }
  if (!description) {
    throw new Error('Story description cannot be empty.');
  }
  if (!storyText) {
    throw new Error('Story content cannot be empty.');
  }
  if (!moral) {
    throw new Error('Story moral cannot be empty.');
  }

  // Maximum character length validations (reject excessive input without silent truncation)
  if (title.length > 200) {
    throw new Error('Story title exceeds maximum limit of 200 characters.');
  }
  if (description.length > 1000) {
    throw new Error('Story description exceeds maximum limit of 1000 characters.');
  }
  if (storyText.length > 50000) {
    throw new Error('Story content exceeds maximum limit of 50000 characters.');
  }
  if (moral.length > 500) {
    throw new Error('Story moral exceeds maximum limit of 500 characters.');
  }

  // Derive author information from authenticated user session
  const authorUid = currentUser.uid;
  const authorName =
    currentUser.displayName?.trim() ||
    (currentUser.email ? currentUser.email.split('@')[0] : 'Anonymous');

  const docRef = await addDoc(collections.stories as any, {
    title,
    description,
    story: storyText,
    moral,
    authorUid,
    authorName,
    likesCount: 0,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

