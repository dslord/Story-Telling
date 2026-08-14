import {
  collection,
  doc,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';

import { db } from '@/config/firebase';
import { UserProfile, Story, StoryLike, StoryComment } from '@/types/models';

export const collections = {
  users: collection(db, 'users') as CollectionReference<UserProfile>,
  stories: collection(db, 'stories') as CollectionReference<Story>,
};

export const docRefs = {
  user: (uid: string): DocumentReference<UserProfile> =>
    doc(db, 'users', uid) as DocumentReference<UserProfile>,
  story: (storyId: string): DocumentReference<Story> =>
    doc(db, 'stories', storyId) as DocumentReference<Story>,
  storyLike: (storyId: string, uid: string): DocumentReference<StoryLike> =>
    doc(db, 'stories', storyId, 'likes', uid) as DocumentReference<StoryLike>,
  storyComment: (storyId: string, commentId: string): DocumentReference<StoryComment> =>
    doc(db, 'stories', storyId, 'comments', commentId) as DocumentReference<StoryComment>,
};

export const storyLikesCollection = (storyId: string): CollectionReference<StoryLike> =>
  collection(db, 'stories', storyId, 'likes') as CollectionReference<StoryLike>;

export const storyCommentsCollection = (storyId: string): CollectionReference<StoryComment> =>
  collection(db, 'stories', storyId, 'comments') as CollectionReference<StoryComment>;
