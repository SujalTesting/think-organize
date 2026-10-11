import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadLearningData(
  supabase: SupabaseClient,
  userId: string,
): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("learning_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.data ?? null;
}

export async function saveLearningData(
  supabase: SupabaseClient,
  userId: string,
  data: unknown,
): Promise<void> {
  const { error } = await supabase.from("learning_data").upsert(
    {
      user_id: userId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
