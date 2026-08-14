import { Timestamp } from 'firebase/firestore';

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
  createdAt: Timestamp;
}

export interface StoryLike {
  likedAt: Timestamp;
}
