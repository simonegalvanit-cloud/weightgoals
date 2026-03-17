import { createClient } from "./supabase";

let _supabase: ReturnType<typeof createClient>;
function getSupabase() {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}
const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) { return (getSupabase() as any)[prop]; },
});

// ============ AUTH ============

export async function signUp(email: string, password: string, name: string) {
  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : undefined;
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo: redirectTo },
  });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthChange(callback: (session: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// ============ PROFILE ============

export async function getProfile(userId: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data;
}

export async function updateProfile(userId: string, updates: { name?: string; theme?: string }) {
  return supabase.from("profiles").update(updates).eq("id", userId).select().single();
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
  const { data: journey, error } = await supabase
    .from("journeys")
    .insert({
      user_id: params.userId,
      title: params.title,
      start_weight: params.startWeight,
      goal_weight: params.goalWeight,
    })
    .select()
    .single();

  if (error || !journey) return { journey: null, error };

  const milestoneRows = params.milestones.map((m, i) => ({
    journey_id: journey.id,
    target_kg: m.targetKg,
    reward_text: m.rewardText,
    emoji_1: m.emoji1,
    emoji_2: m.emoji2,
    theme_msg: m.themeMsg,
    sort_order: i,
  }));

  const { error: msError } = await supabase.from("milestones").insert(milestoneRows);
  return { journey, error: msError };
}

export async function getMyJourneys(userId: string) {
  const { data } = await supabase
    .from("journeys")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function getJourneyFull(journeyId: string) {
  const { data } = await supabase.rpc("get_journey_full", { j_id: journeyId });
  return data;
}

// ============ MILESTONES ============

export async function getMilestones(journeyId: string) {
  const { data } = await supabase
    .from("milestones")
    .select("*, milestone_completions(*)")
    .eq("journey_id", journeyId)
    .order("sort_order");
  return data || [];
}

export async function completeMilestone(milestoneId: string, journeyId: string, userId: string) {
  return supabase.from("milestone_completions").insert({
    milestone_id: milestoneId,
    journey_id: journeyId,
    completed_by: userId,
  }).select().single();
}

export async function uncompleteMilestone(milestoneId: string) {
  return supabase.from("milestone_completions").delete().eq("milestone_id", milestoneId);
}

// ============ JOURNAL ============

export async function addJournalEntry(params: {
  journeyId: string;
  userId: string;
  weight?: number;
  mood?: string;
  note?: string;
}) {
  return supabase.from("journal_entries").insert({
    journey_id: params.journeyId,
    user_id: params.userId,
    weight: params.weight || null,
    mood: params.mood || null,
    note: params.note || null,
  }).select().single();
}

export async function getJournalEntries(journeyId: string) {
  const { data } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("journey_id", journeyId)
    .order("created_at", { ascending: false })
    .limit(100);
  return data || [];
}

export async function deleteJournalEntry(entryId: string) {
  return supabase.from("journal_entries").delete().eq("id", entryId);
}

// ============ PARTNERSHIPS ============

export async function joinByInviteCode(code: string) {
  return supabase.rpc("join_journey_by_code", { code: code.toUpperCase() });
}

export async function getPartnerJourneys(userId: string) {
  const { data } = await supabase
    .from("partnerships")
    .select("*, journeys(*)")
    .eq("partner_id", userId)
    .eq("status", "accepted");
  return data || [];
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
  const channel = supabase
    .channel(`journey-${journeyId}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "milestone_completions",
      filter: `journey_id=eq.${journeyId}`,
    }, (payload) => callbacks.onMilestoneCompleted?.(payload.new))
    .on("postgres_changes", {
      event: "DELETE", schema: "public", table: "milestone_completions",
      filter: `journey_id=eq.${journeyId}`,
    }, (payload) => callbacks.onMilestoneUncompleted?.(payload.old))
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "journal_entries",
      filter: `journey_id=eq.${journeyId}`,
    }, (payload) => callbacks.onJournalEntry?.(payload.new))
    .subscribe();

  return () => supabase.removeChannel(channel);
}
