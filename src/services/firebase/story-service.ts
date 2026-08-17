import {
  addDoc,
  DocumentSnapshot,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  OrderByDirection,
  query,
  QueryConstraint,
  runTransaction,
  serverTimestamp,
  startAfter,
  startAt,
  where,
} from 'firebase/firestore';

import { auth, db } from '@/config/firebase';
import { collections, docRefs, storyLikesCollection } from './collections';
import { Story, SortMode } from '@/types/models';

const PAGE_SIZE = 10;

export interface CreateStoryInput {
  title: string;
  description: string;
  story: string;
  moral: string;
}

export interface UpdateStoryInput {
  title: string;
  description: string;
  story: string;
  moral: string;
}

export interface PaginatedStories {
  stories: Story[];
  lastDoc: DocumentSnapshot<unknown> | null;
  hasMore: boolean;
}

/**
 * Fetches the first page of published stories from Firestore with pagination support.
 * @param sortMode The sorting mode: 'latest' (default), 'mostLiked', or 'mostCommented'
 * @returns PaginatedStories object containing stories, cursor, and hasMore flag
 */
export async function fetchStories(sortMode: SortMode = 'latest'): Promise<PaginatedStories> {
  const orderByClause = getOrderByClause(sortMode);

  const q = query(collections.stories, orderByClause, limit(PAGE_SIZE));
  const querySnapshot = await getDocs(q);

  const stories: Story[] = [];
  querySnapshot.forEach((doc) => {
    stories.push({
      ...doc.data(),
      id: doc.id,
    } as Story);
  });

  const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
  const hasMore = querySnapshot.docs.length === PAGE_SIZE;

  return {
    stories,
    lastDoc,
    hasMore,
  };
}

/**
 * Fetches the next page of stories using a cursor (lastDoc).
 * @param sortMode The sorting mode for consistent ordering
 * @param lastDoc The last document from the previous query (cursor)
 * @returns PaginatedStories object containing stories, cursor, and hasMore flag
 */
export async function fetchMoreStories(
  sortMode: SortMode,
  lastDoc: DocumentSnapshot<unknown>
): Promise<PaginatedStories> {
  const orderByClause = getOrderByClause(sortMode);

  const q = query(collections.stories, orderByClause, startAfter(lastDoc), limit(PAGE_SIZE));
  const querySnapshot = await getDocs(q);

  const stories: Story[] = [];
  querySnapshot.forEach((doc) => {
    stories.push({
      ...doc.data(),
      id: doc.id,
    } as Story);
  });

  const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
  const hasMore = querySnapshot.docs.length === PAGE_SIZE;

  return {
    stories,
    lastDoc: newLastDoc,
    hasMore,
  };
}

/**
 * Helper function to get the orderBy clause based on sort mode.
 */
function getOrderByClause(sortMode: SortMode): QueryConstraint {
  switch (sortMode) {
    case 'mostLiked':
      return orderBy('likesCount', 'desc');
    case 'mostCommented':
      return orderBy('commentsCount', 'desc');
    case 'latest':
    default:
      return orderBy('createdAt', 'desc');
  }
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
    commentsCount: 0,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Fetches all stories authored by a specific user (uid) ordered by creation date descending.
 * @param uid The Firebase Auth UID of the story author.
 * @returns Array of Story objects belonging to the user, newest first.
 */
export async function fetchUserStories(uid: string): Promise<Story[]> {
  if (!uid || !uid.trim()) {
    return [];
  }

  const q = query(
    collections.stories,
    where('authorUid', '==', uid),
    orderBy('createdAt', 'desc')
  );

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
 * Searches published stories by title prefix using Firestore startAt/endAt.
 * Results are ordered alphabetically by title and capped at 30 items.
 * @param searchTerm The search term to query against story titles.
 * @returns Array of matching Story objects.
 */
export async function searchStories(searchTerm: string): Promise<Story[]> {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }

  const trimmedTerm = searchTerm.trim();

  const q = query(
    collections.stories,
    orderBy('title'),
    startAt(trimmedTerm),
    endAt(trimmedTerm + '\uf8ff'),
    limit(30)
  );

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
 * Updates an existing story document in Firestore.
 * Verifies that the authenticated user is the original author before making updates.
 * Only editable fields (title, description, story, moral) can be updated.
 */
export async function updateStory(storyId: string, input: UpdateStoryInput): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to update a story.');
  }

  if (!storyId || !storyId.trim()) {
    throw new Error('Story ID is required.');
  }

  if (!input) {
    throw new Error('Story update input is required.');
  }

  const title = input.title?.trim() || '';
  const description = input.description?.trim() || '';
  const storyText = input.story?.trim() || '';
  const moral = input.moral?.trim() || '';

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

  const storyRef = docRefs.story(storyId);

  await runTransaction(db, async (transaction) => {
    const storyDoc = await transaction.get(storyRef);
    if (!storyDoc.exists()) {
      throw new Error('Story does not exist.');
    }

    const storyData = storyDoc.data();
    if (storyData.authorUid !== currentUser.uid) {
      throw new Error('Unauthorized: You can only update your own stories.');
    }

    transaction.update(storyRef, {
      title,
      description,
      story: storyText,
      moral,
    });
  });
}

/**
 * Deletes a story document and its likes subcollection from Firestore.
 * Verifies that the authenticated user is the original author before deletion.
 */
export async function deleteStory(storyId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to delete a story.');
  }

  if (!storyId || !storyId.trim()) {
    throw new Error('Story ID is required.');
  }

  const storyRef = docRefs.story(storyId);
  const likesRef = storyLikesCollection(storyId);

  // Fetch likes subcollection documents to clean up orphaned likes
  const likesSnapshot = await getDocs(likesRef);

  await runTransaction(db, async (transaction) => {
    const storyDoc = await transaction.get(storyRef);
    if (!storyDoc.exists()) {
      throw new Error('Story does not exist.');
    }

    const storyData = storyDoc.data();
    if (storyData.authorUid !== currentUser.uid) {
      throw new Error('Unauthorized: You can only delete your own stories.');
    }

    const storyLikes = storyData.likesCount || 0;

    // Delete all like documents in subcollection to prevent orphaned documents
    likesSnapshot.forEach((likeDoc) => {
      transaction.delete(likeDoc.ref);
    });

    // Delete main story document
    transaction.delete(storyRef);

    // If story had likes, decrement the author's totalLikesReceived by storyLikes
    if (storyLikes > 0) {
      const authorRef = docRefs.user(currentUser.uid);
      const authorDoc = await transaction.get(authorRef);
      const currentTotalLikes = authorDoc.exists() ? (authorDoc.data().totalLikesReceived || 0) : 0;
      const newTotalLikes = Math.max(0, currentTotalLikes - storyLikes);
      transaction.set(authorRef, {
        totalLikesReceived: newTotalLikes,
      }, { merge: true });
    }
  });
}





