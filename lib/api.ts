import { auth, db, app } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// ============ HELPERS ============

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out — check Firestore security rules in Firebase console`)), ms)
    ),
  ]);
}

// ============ AUTH ============

export async function signUp(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  // Create profile doc
  await setDoc(doc(db, "profiles", cred.user.uid), {
    id: cred.user.uid,
    name,
    theme: "pink",
    created_at: serverTimestamp(),
  });
  return { data: { user: cred.user }, error: null };
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  // Create profile doc if it doesn't exist
  const profileSnap = await getDoc(doc(db, "profiles", cred.user.uid));
  if (!profileSnap.exists()) {
    await setDoc(doc(db, "profiles", cred.user.uid), {
      id: cred.user.uid,
      name: cred.user.displayName || "User",
      theme: "pink",
      created_at: serverTimestamp(),
    });
  }
  return { data: { user: cred.user }, error: null };
}

export async function signIn(email: string, password: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { data: { user: cred.user, session: { user: cred.user } }, error: null };
  } catch (err: any) {
    return { data: { user: null, session: null }, error: { message: err.message } };
  }
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function getUser(): Promise<User | null> {
  return auth.currentUser;
}

export function onAuthChange(callback: (session: any) => void) {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    callback(user ? { user } : null);
  });
  return { data: { subscription: { unsubscribe } } };
}

// ============ PROFILE ============

export async function getProfile(userId: string): Promise<any> {
  const snap = await getDoc(doc(db, "profiles", userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateUserProfile(userId: string, updates: { name?: string; theme?: string }) {
  await withTimeout(
    setDoc(doc(db, "profiles", userId), updates, { merge: true }),
    10000,
    "Updating profile"
  );
  const snap = await getDoc(doc(db, "profiles", userId));
  return { data: snap.exists() ? { id: snap.id, ...snap.data() } : null, error: null };
}

// ============ JOURNEYS ============

export async function createJourney(params: {
  userId: string;
  title: string;
  startWeight: number;
  goalWeight: number;
  milestones: Array<{
    targetKg: number;
    rewardText: string;
    emoji1: string;
    emoji2: string;
    themeMsg: string;
  }>;
}) {
  // Generate a unique 6-char invite code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let inviteCode = "";
  for (let i = 0; i < 6; i++) inviteCode += chars[Math.floor(Math.random() * chars.length)];

  const journeyRef = await withTimeout(
    addDoc(collection(db, "journeys"), {
      user_id: params.userId,
      title: params.title,
      start_weight: params.startWeight,
      goal_weight: params.goalWeight,
      invite_code: inviteCode,
      is_active: true,
      created_at: serverTimestamp(),
    }),
    10000,
    "Creating journey"
  );

  // Store in invite_codes collection so partners can look it up
  await withTimeout(
    setDoc(doc(db, "invite_codes", inviteCode), {
      code: inviteCode,
      journey_id: journeyRef.id,
      user_id: params.userId,
      created_at: serverTimestamp(),
    }),
    10000,
    "Saving invite code"
  );

  const journey = { id: journeyRef.id, user_id: params.userId, title: params.title, start_weight: params.startWeight, goal_weight: params.goalWeight, invite_code: inviteCode, is_active: true };

  for (let i = 0; i < params.milestones.length; i++) {
    const m = params.milestones[i];
    await withTimeout(
      addDoc(collection(db, "milestones"), {
        journey_id: journeyRef.id,
        target_kg: m.targetKg,
        reward_text: m.rewardText,
        emoji_1: m.emoji1,
        emoji_2: m.emoji2,
        theme_msg: m.themeMsg,
        sort_order: i,
      }),
      10000,
      "Saving milestone"
    );
  }

  return { journey, error: null };
}

export async function getMyJourneys(userId: string) {
  const q = query(
    collection(db, "journeys"),
    where("user_id", "==", userId),
    where("is_active", "==", true),
    orderBy("created_at", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getJourneyFull(journeyId: string) {
  const journeySnap = await getDoc(doc(db, "journeys", journeyId));
  if (!journeySnap.exists()) return null;
  const journey = { id: journeySnap.id, ...journeySnap.data() };

  const milestones = await getMilestones(journeyId);
  const journalEntries = await getJournalEntries(journeyId);

  return { ...journey, milestones, journal_entries: journalEntries };
}

// ============ MILESTONES ============

export async function updateMilestone(milestoneId: string, data: { target_kg?: number; reward_text?: string; emoji_1?: string; emoji_2?: string; theme_msg?: string; sort_order?: number }) {
  await updateDoc(doc(db, "milestones", milestoneId), data);
}

export async function addMilestone(journeyId: string, data: { targetKg: number; rewardText: string; emoji1: string; emoji2: string; sortOrder: number }) {
  const ref = await addDoc(collection(db, "milestones"), {
    journey_id: journeyId,
    target_kg: data.targetKg,
    reward_text: data.rewardText,
    emoji_1: data.emoji1,
    emoji_2: data.emoji2,
    theme_msg: "",
    sort_order: data.sortOrder,
  });
  return { id: ref.id, journey_id: journeyId, target_kg: data.targetKg, reward_text: data.rewardText, emoji_1: data.emoji1, emoji_2: data.emoji2, theme_msg: "", sort_order: data.sortOrder, milestone_completions: [] };
}

export async function deleteMilestone(milestoneId: string) {
  // Delete completions first
  const compSnap = await getDocs(query(collection(db, "milestone_completions"), where("milestone_id", "==", milestoneId)));
  for (const d of compSnap.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db, "milestones", milestoneId));
}

export async function updateJourney(journeyId: string, data: { goal_weight?: number; start_weight?: number; title?: string }) {
  await updateDoc(doc(db, "journeys", journeyId), data);
}

export async function getMilestones(journeyId: string) {
  const q = query(
    collection(db, "milestones"),
    where("journey_id", "==", journeyId),
    orderBy("sort_order")
  );
  const snap = await getDocs(q);
  const milestones = [];

  for (const d of snap.docs) {
    const ms = { id: d.id, ...d.data() };
    // Get completions for this milestone
    const compQ = query(
      collection(db, "milestone_completions"),
      where("milestone_id", "==", d.id)
    );
    const compSnap = await getDocs(compQ);
    (ms as any).milestone_completions = compSnap.docs.map((c) => ({ id: c.id, ...c.data() }));
    milestones.push(ms);
  }

  return milestones;
}

export async function completeMilestone(milestoneId: string, journeyId: string, userId: string) {
  const ref = await addDoc(collection(db, "milestone_completions"), {
    milestone_id: milestoneId,
    journey_id: journeyId,
    completed_by: userId,
    created_at: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { data: { id: ref.id, ...snap.data() }, error: null };
}

export async function uncompleteMilestone(milestoneId: string) {
  const q = query(
    collection(db, "milestone_completions"),
    where("milestone_id", "==", milestoneId)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
  return { data: null, error: null };
}

// ============ JOURNAL ============

export async function addJournalEntry(params: {
  journeyId: string;
  userId: string;
  weight?: number;
  mood?: string;
  note?: string;
}) {
  const ref = await addDoc(collection(db, "journal_entries"), {
    journey_id: params.journeyId,
    user_id: params.userId,
    weight: params.weight || null,
    mood: params.mood || null,
    note: params.note || null,
    created_at: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { data: { id: ref.id, ...snap.data() }, error: null };
}

export async function getJournalEntries(journeyId: string) {
  const q = query(
    collection(db, "journal_entries"),
    where("journey_id", "==", journeyId),
    orderBy("created_at", "desc"),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteJournalEntry(entryId: string) {
  await deleteDoc(doc(db, "journal_entries", entryId));
  return { error: null };
}

// ============ PARTNERSHIPS ============

export async function joinByInviteCode(code: string): Promise<{ data: any; error: any }> {
  // For now, query invite_codes collection to find matching journey
  const q = query(
    collection(db, "invite_codes"),
    where("code", "==", code.toUpperCase()),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return { data: null, error: { message: "Invalid invite code" } };

  const invite = snap.docs[0].data();
  const userId = auth.currentUser?.uid;
  if (!userId) return { data: null, error: { message: "Not logged in" } };

  await addDoc(collection(db, "partnerships"), {
    journey_id: invite.journey_id,
    partner_id: userId,
    status: "accepted",
    created_at: serverTimestamp(),
  });

  return { data: true, error: null };
}

export async function getPartnerJourneys(userId: string) {
  const q = query(
    collection(db, "partnerships"),
    where("partner_id", "==", userId),
    where("status", "==", "accepted")
  );
  const snap = await getDocs(q);
  const results = [];

  for (const d of snap.docs) {
    const partnership = d.data();
    const journeySnap = await getDoc(doc(db, "journeys", partnership.journey_id));
    if (journeySnap.exists()) {
      results.push({ id: d.id, ...partnership, journeys: { id: journeySnap.id, ...journeySnap.data() } });
    }
  }

  return results;
}

// ============ REALTIME ============

export function subscribeToJourney(
  journeyId: string,
  callbacks: {
    onMilestoneCompleted?: (data: any) => void;
    onMilestoneUncompleted?: (data: any) => void;
    onJournalEntry?: (data: any) => void;
  }
) {
  const unsubs: (() => void)[] = [];

  // Listen for milestone completions
  const compQ = query(
    collection(db, "milestone_completions"),
    where("journey_id", "==", journeyId)
  );
  let firstCompSnap = true;
  unsubs.push(
    onSnapshot(compQ, (snap) => {
      if (firstCompSnap) { firstCompSnap = false; return; }
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          callbacks.onMilestoneCompleted?.({ id: change.doc.id, ...change.doc.data() });
        }
        if (change.type === "removed") {
          callbacks.onMilestoneUncompleted?.({ id: change.doc.id, ...change.doc.data() });
        }
      });
    })
  );

  // Listen for journal entries
  const journalQ = query(
    collection(db, "journal_entries"),
    where("journey_id", "==", journeyId),
    orderBy("created_at", "desc"),
    limit(1)
  );
  let firstJournalSnap = true;
  unsubs.push(
    onSnapshot(journalQ, (snap) => {
      if (firstJournalSnap) { firstJournalSnap = false; return; }
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          callbacks.onJournalEntry?.({ id: change.doc.id, ...change.doc.data() });
        }
      });
    })
  );

  return () => unsubs.forEach((u) => u());
}

// ============ PUSH NOTIFICATIONS ============

// ============ REWARD CLAIMS ============

export async function claimReward(milestoneId: string, userId: string) {
  await setDoc(doc(db, "reward_claims", `${milestoneId}_${userId}`), {
    milestone_id: milestoneId,
    user_id: userId,
    claimed_at: serverTimestamp(),
  });
  return { error: null };
}

export async function unclaimReward(milestoneId: string, userId: string) {
  await deleteDoc(doc(db, "reward_claims", `${milestoneId}_${userId}`));
  return { error: null };
}

export async function getRewardClaims(journeyId: string, milestoneIds: string[]) {
  if (milestoneIds.length === 0) return {};
  const claims: Record<string, boolean> = {};
  // Firestore 'in' queries support max 30 items
  for (let i = 0; i < milestoneIds.length; i += 30) {
    const batch = milestoneIds.slice(i, i + 30);
    const q = query(collection(db, "reward_claims"), where("milestone_id", "in", batch));
    const snap = await getDocs(q);
    snap.docs.forEach(d => { claims[d.data().milestone_id] = true; });
  }
  return claims;
}

// ============ JOURNAL REACTIONS ============

export async function addReaction(entryId: string, userId: string, emoji: string) {
  const reactionId = `${entryId}_${userId}`;
  await setDoc(doc(db, "journal_reactions", reactionId), {
    entry_id: entryId,
    user_id: userId,
    emoji,
    created_at: serverTimestamp(),
  });
  return { error: null };
}

export async function removeReaction(entryId: string, userId: string) {
  await deleteDoc(doc(db, "journal_reactions", `${entryId}_${userId}`));
  return { error: null };
}

export async function getReactionsForJourney(journeyId: string, entryIds: string[]) {
  if (entryIds.length === 0) return {};
  const reactions: Record<string, Array<{ userId: string; emoji: string }>> = {};
  for (let i = 0; i < entryIds.length; i += 30) {
    const batch = entryIds.slice(i, i + 30);
    const q = query(collection(db, "journal_reactions"), where("entry_id", "in", batch));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      const data = d.data();
      if (!reactions[data.entry_id]) reactions[data.entry_id] = [];
      reactions[data.entry_id].push({ userId: data.user_id, emoji: data.emoji });
    });
  }
  return reactions;
}

// ============ PUSH NOTIFICATIONS ============

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (!("Notification" in window)) return null;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "",
      serviceWorkerRegistration: await navigator.serviceWorker.register("/firebase-messaging-sw.js"),
    });
    return token || null;
  } catch (err) {
    console.error("Failed to get notification token:", err);
    return null;
  }
}

export async function saveNotificationToken(userId: string, token: string) {
  await setDoc(doc(db, "notification_tokens", `${userId}_${token.slice(-8)}`), {
    user_id: userId,
    token,
    created_at: serverTimestamp(),
  });
}

export async function onForegroundMessage(callback: (payload: any) => void) {
  try {
    const { getMessaging, onMessage } = await import("firebase/messaging");
    const messaging = getMessaging(app);
    return onMessage(messaging, callback);
  } catch {
    return () => {};
  }
}
