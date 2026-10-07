"use server";

/**
 * User Preferences Server Actions
 * Actions for managing user preferences and settings
 */

import { revalidatePath } from "next/cache.js";

import { auth } from "@/auth";
import { userPreferenceDal } from "@/dal/user-preferences-dal";
import { pushPreferenceFacts } from "@/lib/supermemory";

import type { ActionResult } from "@/types/actions-types";
import type { UpdateUserPreferenceInput, UserPreference } from "@/types/user-preferences";

/**
 * Get user preferences
 */
export async function getUserPreferencesAction(): Promise<ActionResult<UserPreference>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const prefs = await userPreferenceDal.getByUserId(session.user.id);
    return { ok: true, data: prefs };
  } catch (error) {
    console.error("[getUserPreferencesAction]", error);
    return { ok: false, error: "Failed to fetch preferences" };
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferencesAction(
  input: UpdateUserPreferenceInput,
): Promise<ActionResult<UserPreference>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const prefs = await userPreferenceDal.updatePreferences(session.user.id, input);

    if (!prefs) {
      // If preferences don't exist, create them
      const newPrefs = await userPreferenceDal.upsertPreferences(session.user.id, input);
      revalidatePath("/settings");
      return { ok: true, data: newPrefs };
    }

    revalidatePath("/settings");
    return { ok: true, data: prefs };
  } catch (error) {
    console.error("[updateUserPreferencesAction]", error);
    return { ok: false, error: "Failed to update preferences" };
  } finally {
    // Best effort: mirror changed facts to Supermemory (item 3). Never
    // throws, no-ops without SUPERMEMORY_API_KEY — DB write already won.
    if (session?.user?.id) {
      void pushPreferenceFacts(session.user.id, input).then((r) => {
        if (!r.ok) {
          console.error("[supermemory] pref mirror failed:", r.error);
        }
      });
    }
  }
}

/**
 * Update theme preference
 */
export async function updateThemeAction(theme: "dark" | "light" | "system"): Promise<ActionResult<UserPreference>> {
  return await updateUserPreferencesAction({ theme });
}

/**
 * Update reading layout preference
 */
export async function updateLayoutPreferenceAction(
  layout: "book" | "comic" | "webtoon",
): Promise<ActionResult<UserPreference>> {
  return await updateUserPreferencesAction({ defaultLayout: layout });
}

/**
 * Update notification settings
 */
export async function updateNotificationSettingsAction(input: {
  notifyBookmarkUpdates?: boolean;
  notifyComments?: boolean;
  notifyNewChapters?: boolean;
}): Promise<ActionResult<UserPreference>> {
  return await updateUserPreferencesAction(input);
}

/**
 * Update privacy settings
 */
export async function updatePrivacySettingsAction(input: {
  profilePublic?: boolean;
  showReadingHistory?: boolean;
}): Promise<ActionResult<UserPreference>> {
  return await updateUserPreferencesAction(input);
}
