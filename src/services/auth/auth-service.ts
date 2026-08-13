import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  User,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth } from '@/config/firebase';
import { docRefs } from '@/services/firebase/collections';

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
}

export async function syncUserProfile(user: User): Promise<void> {
  const userRef = docRefs.user(user.uid);

  let existingDocData: any = null;
  try {
    const existingDoc = await getDoc(userRef);
    if (existingDoc.exists()) {
      existingDocData = existingDoc.data();
    }
  } catch (error) {
    console.warn('Could not read existing user profile (client offline or initial connection pending):', error);
  }

  const displayNameParts = (user.displayName || '').trim().split(' ');
  const firstName = displayNameParts[0] || '';
  const lastName = displayNameParts.slice(1).join(' ') || '';

  if (!existingDocData) {
    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email || '',
        firstName,
        lastName,
        profilePicture: user.photoURL || null,
        themePreference: 'dark',
        createdAt: serverTimestamp() as any,
      },
      { merge: true }
    );
  } else {
    await setDoc(
      userRef,
      {
        email: user.email || '',
        firstName: firstName || existingDocData?.firstName || '',
        lastName: lastName || existingDocData?.lastName || '',
        profilePicture: user.photoURL || existingDocData?.profilePicture || null,
      },
      { merge: true }
    );
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;

    if (!idToken) {
      throw new Error('Google Sign-In failed: No ID Token returned');
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);

    if (result.user) {
      try {
        await syncUserProfile(result.user);
      } catch (error) {
        console.error('Non-critical user profile sync error:', error);
      }
    }

    return result.user;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore native sign out errors if already signed out
  }
  await firebaseSignOut(auth);
}
