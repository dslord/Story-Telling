import { Timestamp } from 'firebase/firestore';

export type SortMode = 'latest' | 'mostLiked' | 'mostCommented';

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  themePreference: 'dark' | 'light';
  createdAt: Timestamp;
  totalLikesReceived?: number;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  story: string;
  moral: string;
  authorUid: string;
  authorName: string;
  likesCount: number;
  commentsCount: number;
  createdAt: Timestamp;
}

export interface StoryLike {
  likedAt: Timestamp;
}

export interface StoryComment {
  id: string;
  storyId: string;
  authorUid: string;
  authorName: string;
  text: string;
  createdAt: Timestamp;
}
