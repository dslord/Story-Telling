const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp, increment } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

let testEnv;

describe('Firestore Security Rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'storytelling-test',
      firestore: {
        rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // Helper to get firestore instance for an authenticated user
  function getFirestore(auth) {
    return testEnv.authenticatedContext(auth?.uid, {
      sub: auth?.uid,
    }).firestore();
  }

  // Helper to get unauthenticated firestore instance
  function getUnauthenticatedFirestore() {
    return testEnv.unauthenticatedContext().firestore();
  }

  // --- 1. AUTHENTICATION TESTS ---
  describe('Authentication', () => {
    test('PASS: Unauthenticated user can read public stories feed', async () => {
      const db = getUnauthenticatedFirestore();
      await assertSucceeds(getDoc(doc(db, 'stories/story1')));
    });

    test('FAIL: Unauthenticated user cannot read user profiles', async () => {
      const db = getUnauthenticatedFirestore();
      await assertFails(getDoc(doc(db, 'users/userA')));
    });

    test('FAIL: Unauthenticated user cannot create stories', async () => {
      const db = getUnauthenticatedFirestore();
      await assertFails(setDoc(doc(db, 'stories/story1'), {
        title: 'Story Title',
        description: 'Story Description',
        story: 'Story body content',
        moral: 'Moral of the story',
        authorUid: 'userA',
        authorName: 'User A',
        likesCount: 0,
        createdAt: new Date(),
      }));
    });
  });

  // --- 2. USER PROFILE TESTS ---
  describe('User Profiles', () => {
    test('PASS: Authenticated user can read/write their own profile', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertSucceeds(setDoc(doc(db, 'users/userA'), { name: 'User A', email: 'a@test.com' }));
      await assertSucceeds(getDoc(doc(db, 'users/userA')));
    });

    test('FAIL: Authenticated user cannot read/write another user\'s profile', async () => {
      // Setup: Populate userB profile
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/userB'), { name: 'User B' });
      });

      const db = getFirestore({ uid: 'userA' });
      await assertFails(getDoc(doc(db, 'users/userB')));
      await assertFails(setDoc(doc(db, 'users/userB'), { name: 'Tampered B' }));
    });

    test('FAIL: User cannot directly modify totalLikesReceived on their own profile', async () => {
      // Setup: Populate userA profile with 5 likes
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/userA'), { name: 'User A', email: 'a@test.com', totalLikesReceived: 5 });
      });

      const db = getFirestore({ uid: 'userA' });
      const userRef = doc(db, 'users/userA');
      await assertFails(updateDoc(userRef, { totalLikesReceived: 10 })); // direct modification
    });

    test('FAIL: User cannot set totalLikesReceived to a negative value', async () => {
      // Setup: Populate userA profile
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/userA'), { name: 'User A', email: 'a@test.com', totalLikesReceived: 0 });
      });

      const db = getFirestore({ uid: 'userB' }); // other user
      const userRef = doc(db, 'users/userA');
      await assertFails(updateDoc(userRef, { totalLikesReceived: -1 })); // negative
    });
  });

  // --- 3. STORY CRUD & OWNERSHIP TESTS ---
  describe('Story CRUD & Ownership', () => {
    test('PASS: Authenticated user can create story for themselves with valid fields & sizes', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertSucceeds(setDoc(doc(db, 'stories/storyA'), {
        title: 'Valid Title',
        description: 'Valid Description',
        story: 'Valid Story body text',
        moral: 'Valid Moral',
        authorUid: 'userA',
        authorName: 'User A',
        likesCount: 0,
        createdAt: serverTimestamp(),
      }));
    });

    test('FAIL: Story creation with mismatched authorUid', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertFails(setDoc(doc(db, 'stories/storyA'), {
        title: 'Valid Title',
        description: 'Valid Description',
        story: 'Valid Story body text',
        moral: 'Valid Moral',
        authorUid: 'userB', // Mismatch!
        authorName: 'User A',
        likesCount: 0,
        createdAt: serverTimestamp(),
      }));
    });

    test('FAIL: Story creation exceeding title character limit (>200)', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertFails(setDoc(doc(db, 'stories/storyA'), {
        title: 'a'.repeat(201), // Exceeds 200
        description: 'Valid Description',
        story: 'Valid Story body text',
        moral: 'Valid Moral',
        authorUid: 'userA',
        authorName: 'User A',
        likesCount: 0,
        createdAt: serverTimestamp(),
      }));
    });

    test('FAIL: Story creation exceeding moral character limit (>500)', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertFails(setDoc(doc(db, 'stories/storyA'), {
        title: 'Valid Title',
        description: 'Valid Description',
        story: 'Valid Story body text',
        moral: 'm'.repeat(501), // Exceeds 500
        authorUid: 'userA',
        authorName: 'User A',
        likesCount: 0,
        createdAt: serverTimestamp(),
      }));
    });

    test('FAIL: Story creation with arbitrary extra field', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertFails(setDoc(doc(db, 'stories/storyA'), {
        title: 'Valid Title',
        description: 'Valid Description',
        story: 'Valid Story body text',
        moral: 'Valid Moral',
        authorUid: 'userA',
        authorName: 'User A',
        likesCount: 0,
        createdAt: serverTimestamp(),
        extraField: 'unauthorized', // Extra key!
      }));
    });

    test('PASS: Owner can update allowed story content fields within size limits', async () => {
      // Setup
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'stories/storyA'), {
          title: 'Old Title',
          description: 'Old Description',
          story: 'Old Story',
          moral: 'Old Moral',
          authorUid: 'userA',
          authorName: 'User A',
          likesCount: 0,
          createdAt: new Date(),
        });
      });

      const db = getFirestore({ uid: 'userA' });
      await assertSucceeds(updateDoc(doc(db, 'stories/storyA'), {
        title: 'New Title',
        moral: 'New Moral',
      }));
    });

    test('FAIL: Owner cannot update protected fields (authorUid, authorName, createdAt, likesCount)', async () => {
      // Setup
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'stories/storyA'), {
          title: 'Old Title',
          description: 'Old Description',
          story: 'Old Story',
          moral: 'Old Moral',
          authorUid: 'userA',
          authorName: 'User A',
          likesCount: 0,
          createdAt: new Date(),
        });
      });

      const db = getFirestore({ uid: 'userA' });
      await assertFails(updateDoc(doc(db, 'stories/storyA'), {
        authorUid: 'userB',
      }));
      await assertFails(updateDoc(doc(db, 'stories/storyA'), {
        likesCount: 50,
      }));
    });

    test('FAIL: Non-owner cannot edit story content fields', async () => {
      // Setup
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'stories/storyA'), {
          title: 'Old Title',
          description: 'Old Description',
          story: 'Old Story',
          moral: 'Old Moral',
          authorUid: 'userA',
          authorName: 'User A',
          likesCount: 0,
          createdAt: new Date(),
        });
      });

      const db = getFirestore({ uid: 'userB' }); // Not owner
      await assertFails(updateDoc(doc(db, 'stories/storyA'), {
        title: 'Tampered Title',
      }));
    });

    test('PASS: Owner can delete their own story', async () => {
      // Setup
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'stories/storyA'), { authorUid: 'userA' });
      });

      const db = getFirestore({ uid: 'userA' });
      await assertSucceeds(deleteDoc(doc(db, 'stories/storyA')));
    });

    test('FAIL: Non-owner cannot delete story', async () => {
      // Setup
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'stories/storyA'), { authorUid: 'userA' });
      });

      const db = getFirestore({ uid: 'userB' });
      await assertFails(deleteDoc(doc(db, 'stories/storyA')));
    });
  });

  // --- 4. LIKE/UNLIKE TRANSACTION & CORRELATION TESTS ---
  describe('Likes & Transactions', () => {
    test('PASS: User can like a story via atomic transaction (increment, create like doc, increment author profile totalLikesReceived)', async () => {
      // Setup
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/userA'), {
          name: 'User A',
          email: 'a@test.com',
          totalLikesReceived: 0,
        });
        await setDoc(doc(db, 'stories/storyA'), {
          title: 'Title',
          description: 'Desc',
          story: 'Story',
          moral: 'Moral',
          authorUid: 'userA',
          authorName: 'User A',
          likesCount: 0,
          createdAt: new Date(),
        });
      });

      const db = getFirestore({ uid: 'userB' });
      const storyRef = doc(db, 'stories/storyA');
      const likeRef = doc(db, 'stories/storyA/likes/userB');
      const authorRef = doc(db, 'users/userA');

      await assertSucceeds(runTransaction(db, async (transaction) => {
        const storySnap = await transaction.get(storyRef);
        const newLikesCount = storySnap.data().likesCount + 1;
        transaction.update(storyRef, { likesCount: newLikesCount });
        transaction.set(likeRef, { likedAt: serverTimestamp() });
        transaction.set(authorRef, { totalLikesReceived: increment(1) }, { merge: true });
      }));
    });

    test('FAIL: User cannot update likesCount without creating like document or updating author profile', async () => {
      // Setup
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/userA'), {
          name: 'User A',
          email: 'a@test.com',
          totalLikesReceived: 0,
        });
        await setDoc(doc(db, 'stories/storyA'), {
          title: 'Title',
          description: 'Desc',
          story: 'Story',
          moral: 'Moral',
          authorUid: 'userA',
          authorName: 'User A',
          likesCount: 0,
          createdAt: new Date(),
        });
      });

      const db = getFirestore({ uid: 'userB' });
      const storyRef = doc(db, 'stories/storyA');

      await assertFails(updateDoc(storyRef, { likesCount: 1 }));
    });

    test('FAIL: User cannot create like document without updating story likesCount and author profile', async () => {
      const db = getFirestore({ uid: 'userB' });
      const likeRef = doc(db, 'stories/storyA/likes/userB');
      await assertFails(setDoc(likeRef, { likedAt: serverTimestamp() }));
    });

    test('PASS: User can unlike a story via atomic transaction (decrement, delete like doc, decrement author profile)', async () => {
      // Setup: Populate story with 1 like and the corresponding userB like document
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/userA'), {
          name: 'User A',
          email: 'a@test.com',
          totalLikesReceived: 1,
        });
        await setDoc(doc(db, 'stories/storyA'), {
          title: 'Title',
          description: 'Desc',
          story: 'Story',
          moral: 'Moral',
          authorUid: 'userA',
          authorName: 'User A',
          likesCount: 1,
          createdAt: new Date(),
        });
        await setDoc(doc(db, 'stories/storyA/likes/userB'), { likedAt: new Date() });
      });

      const db = getFirestore({ uid: 'userB' });
      const storyRef = doc(db, 'stories/storyA');
      const likeRef = doc(db, 'stories/storyA/likes/userB');
      const authorRef = doc(db, 'users/userA');

      await assertSucceeds(runTransaction(db, async (transaction) => {
        const storySnap = await transaction.get(storyRef);
        const newLikesCount = storySnap.data().likesCount - 1;
        transaction.update(storyRef, { likesCount: newLikesCount });
        transaction.delete(likeRef);
        transaction.set(authorRef, { totalLikesReceived: increment(-1) }, { merge: true });
      }));
    });

    test('FAIL: Unlike transaction cannot result in negative likesCount', async () => {
      // Setup: Populate story with 0 likes but userB has a like document (inconsistent state)
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/userA'), {
          name: 'User A',
          email: 'a@test.com',
          totalLikesReceived: 0,
        });
        await setDoc(doc(db, 'stories/storyA'), {
          title: 'Title',
          description: 'Desc',
          story: 'Story',
          moral: 'Moral',
          authorUid: 'userA',
          authorName: 'User A',
          likesCount: 0, // 0 likes
          createdAt: new Date(),
        });
        await setDoc(doc(db, 'stories/storyA/likes/userB'), { likedAt: new Date() });
      });

      const db = getFirestore({ uid: 'userB' });
      const storyRef = doc(db, 'stories/storyA');
      const likeRef = doc(db, 'stories/storyA/likes/userB');
      const authorRef = doc(db, 'users/userA');

      await assertFails(runTransaction(db, async (transaction) => {
        const storySnap = await transaction.get(storyRef);
        const newLikesCount = storySnap.data().likesCount - 1; // -1
        transaction.update(storyRef, { likesCount: newLikesCount });
        transaction.delete(likeRef);
        transaction.set(authorRef, { totalLikesReceived: increment(-1) }, { merge: true });
      }));
    });

    test('FAIL: Unlike transaction cannot result in negative profile totalLikesReceived', async () => {
      // Setup: Story has 1 like, but profile totalLikesReceived is 0 (inconsistent state)
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/userA'), {
          name: 'User A',
          email: 'a@test.com',
          totalLikesReceived: 0, // already 0!
        });
        await setDoc(doc(db, 'stories/storyA'), {
          title: 'Title',
          description: 'Desc',
          story: 'Story',
          moral: 'Moral',
          authorUid: 'userA',
          authorName: 'User A',
          likesCount: 1,
          createdAt: new Date(),
        });
        await setDoc(doc(db, 'stories/storyA/likes/userB'), { likedAt: new Date() });
      });

      const db = getFirestore({ uid: 'userB' });
      const storyRef = doc(db, 'stories/storyA');
      const likeRef = doc(db, 'stories/storyA/likes/userB');
      const authorRef = doc(db, 'users/userA');

      await assertFails(runTransaction(db, async (transaction) => {
        const storySnap = await transaction.get(storyRef);
        const newLikesCount = storySnap.data().likesCount - 1;
        transaction.update(storyRef, { likesCount: newLikesCount });
        transaction.delete(likeRef);
        transaction.set(authorRef, { totalLikesReceived: increment(-1) }, { merge: true }); // -1!
      }));
    });

    test('FAIL: User cannot create like document for a different userId', async () => {
      const db = getFirestore({ uid: 'userB' });
      const likeRef = doc(db, 'stories/storyA/likes/userC'); // Different ID!
      await assertFails(setDoc(likeRef, { likedAt: serverTimestamp() }));
    });
  });

  // --- 5. STORY COMMENTS SECURITY TESTS ---
  describe('Story Comments', () => {
    test('PASS: Authenticated user can create a valid comment', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertSucceeds(setDoc(doc(db, 'stories/storyA/comments/comment1'), {
        storyId: 'storyA',
        authorUid: 'userA',
        authorName: 'User A',
        text: 'This is a valid comment!',
        createdAt: serverTimestamp(),
      }));
    });

    test('FAIL: Unauthenticated user cannot create a comment', async () => {
      const db = getUnauthenticatedFirestore();
      await assertFails(setDoc(doc(db, 'stories/storyA/comments/comment1'), {
        storyId: 'storyA',
        authorUid: 'userA',
        authorName: 'User A',
        text: 'This is a comment.',
        createdAt: serverTimestamp(),
      }));
    });

    test('FAIL: User cannot create a comment with another user\'s authorUid', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertFails(setDoc(doc(db, 'stories/storyA/comments/comment1'), {
        storyId: 'storyA',
        authorUid: 'userB', // Impersonating userB
        authorName: 'User B',
        text: 'This is a comment.',
        createdAt: serverTimestamp(),
      }));
    });

    test('FAIL: Empty comment is rejected', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertFails(setDoc(doc(db, 'stories/storyA/comments/comment1'), {
        storyId: 'storyA',
        authorUid: 'userA',
        authorName: 'User A',
        text: '', // Empty
        createdAt: serverTimestamp(),
      }));
    });

    test('FAIL: Comment longer than 1000 characters is rejected', async () => {
      const db = getFirestore({ uid: 'userA' });
      const longText = 'a'.repeat(1001);
      await assertFails(setDoc(doc(db, 'stories/storyA/comments/comment1'), {
        storyId: 'storyA',
        authorUid: 'userA',
        authorName: 'User A',
        text: longText,
        createdAt: serverTimestamp(),
      }));
    });

    test('PASS: Authenticated user can read comments', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertSucceeds(getDoc(doc(db, 'stories/storyA/comments/comment1')));
    });

    test('FAIL: Unauthenticated user cannot read comments', async () => {
      const db = getUnauthenticatedFirestore();
      await assertFails(getDoc(doc(db, 'stories/storyA/comments/comment1')));
    });

    test('PASS: Comment author can delete their comment', async () => {
      // Setup: Create a comment with security rules disabled
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'stories/storyA/comments/comment1'), {
          storyId: 'storyA',
          authorUid: 'userA',
          authorName: 'User A',
          text: 'Comment',
          createdAt: new Date(),
        });
      });

      const db = getFirestore({ uid: 'userA' });
      await assertSucceeds(deleteDoc(doc(db, 'stories/storyA/comments/comment1')));
    });

    test('PASS: Story owner can delete comments on their story', async () => {
      // Setup: Story created by userA, comment created by userB
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'stories/storyA'), {
          authorUid: 'userA',
        });
        await setDoc(doc(db, 'stories/storyA/comments/comment1'), {
          storyId: 'storyA',
          authorUid: 'userB',
          authorName: 'User B',
          text: 'Comment',
          createdAt: new Date(),
        });
      });

      const db = getFirestore({ uid: 'userA' }); // Story owner
      await assertSucceeds(deleteDoc(doc(db, 'stories/storyA/comments/comment1')));
    });

    test('FAIL: Unrelated user cannot delete comments', async () => {
      // Setup: Story created by userA, comment created by userB
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'stories/storyA'), {
          authorUid: 'userA',
        });
        await setDoc(doc(db, 'stories/storyA/comments/comment1'), {
          storyId: 'storyA',
          authorUid: 'userB',
          authorName: 'User B',
          text: 'Comment',
          createdAt: new Date(),
        });
      });

      const db = getFirestore({ uid: 'userC' }); // Unrelated user
      await assertFails(deleteDoc(doc(db, 'stories/storyA/comments/comment1')));
    });

    test('FAIL: Invalid/extra fields in comment document are rejected', async () => {
      const db = getFirestore({ uid: 'userA' });
      await assertFails(setDoc(doc(db, 'stories/storyA/comments/comment1'), {
        storyId: 'storyA',
        authorUid: 'userA',
        authorName: 'User A',
        text: 'Valid text',
        createdAt: serverTimestamp(),
        extraField: 'not allowed', // Extra field!
      }));
    });
  });
});
