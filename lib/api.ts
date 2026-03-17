import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
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

// ============ AUTH ============

export async function signUp(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
  // Create profile doc
  await setDoc(doc(db, "profiles", cred.user.uid), {
    id: cred.user.uid,
    name,
    theme: "pink",
    created_at: serverTimestamp(),
  });
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
  await updateDoc(doc(db, "profiles", userId), updates);
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
  const journeyRef = await addDoc(collection(db, "journeys"), {
    user_id: params.userId,
    title: params.title,
    start_weight: params.startWeight,
    goal_weight: params.goalWeight,
    is_active: true,
    created_at: serverTimestamp(),
  });

  const journey = { id: journeyRef.id, user_id: params.userId, title: params.title, start_weight: params.startWeight, goal_weight: params.goalWeight, is_active: true };

  for (let i = 0; i < params.milestones.length; i++) {
    const m = params.milestones[i];
    await addDoc(collection(db, "milestones"), {
      journey_id: journeyRef.id,
      target_kg: m.targetKg,
      reward_text: m.rewardText,
      emoji_1: m.emoji1,
      emoji_2: m.emoji2,
      theme_msg: m.themeMsg,
      sort_order: i,
    });
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
