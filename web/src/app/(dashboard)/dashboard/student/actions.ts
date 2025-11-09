"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const recordReadingProgress = async (input: {
  bookId: number;
  currentPage: number;
}) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to save progress.");
  }

  const { error } = await supabase.from("student_books").upsert(
    {
      student_id: user.id,
      book_id: input.bookId,
      current_page: input.currentPage,
    },
    { onConflict: "student_id,book_id" },
  );

  if (error) {
    throw error;
  }

  revalidatePath("/dashboard/student");
};

export const evaluateAchievements = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to evaluate achievements.");
  }

  const { data: completions } = await supabase
    .from("student_books")
    .select("current_page, books(page_count)")
    .eq("student_id", user.id);

  const finishedCount =
    completions?.filter((entry) => {
      // Extract book data from array if it exists
      const bookData =
        Array.isArray(entry.books) && entry.books.length > 0
          ? entry.books[0]
          : entry.books;
      const book = bookData as { page_count?: number } | null;
      const pageCount = book?.page_count ?? 0;
      const current = entry.current_page ?? 0;
      return pageCount > 0 && current >= pageCount;
    }).length ?? 0;

  const { data: achievements } = await supabase
    .from("achievements")
    .select("*");
  const { data: earned } = await supabase
    .from("student_achievements")
    .select("achievement_id")
    .eq("student_id", user.id);

  const earnedIds = new Set(
    (earned ?? []).map((record) => record.achievement_id),
  );

  const toAward =
    achievements?.filter((achievement) => {
      if (earnedIds.has(achievement.id)) {
        return false;
      }
      const criteria =
        (achievement.criteria as { type?: string; count?: number } | null) ??
        {};
      if (
        criteria.type === "books_read" &&
        typeof criteria.count === "number"
      ) {
        return finishedCount >= criteria.count;
      }
      return false;
    }) ?? [];

  if (!toAward.length) {
    return { awarded: 0 };
  }

  await supabase
    .from("student_achievements")
    .insert(
      toAward.map((achievement) => ({
        student_id: user.id,
        achievement_id: achievement.id,
      })),
    );

  revalidatePath("/dashboard/student");
  return { awarded: toAward.length };
};
