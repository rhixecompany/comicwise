/**
 * Supermemory integration for comicwise (item 3 of the SandBox onboarding).
 *
 * Mirrors user preferences into Supermemory as entity-centric memories
 * (POST /v4/memories — immediately searchable, feeds /v4/profile) scoped to
 * one containerTag per user: `user_<userId>` (format ^[a-zA-Z0-9_:-]+$).
 *
 * The API key is read from process.env.SUPERMEMORY_API_KEY only. Every
 * function degrades gracefully: missing key, invalid tag, or any request
 * failure returns { ok: false } and NEVER throws — the host app's behavior
 * is unchanged when Supermemory is unavailable.
 */

import type { UpdateUserPreferenceInput, UserPreference } from "@/types/user-preferences";

const API_BASE = process.env.SUPERMEMORY_API_BASE ?? "https://api.supermemory.ai";
const TIMEOUT_MS = 8_000;

export interface SupertagMemoryResult {
  ok: boolean;
  written?: number;
  error?: string;
}

/** Build the (single, singular) containerTag for a user, or null when invalid. */
export function containerTagForUser(userId: string): string | null {
  const tag = `user_${userId}`;
  if (tag.length > 100 || !/^[a-zA-Z0-9_:-]+$/.test(tag)) {
    return null;
  }
  return tag;
}

const LAYOUT_LABEL: Record<NonNullable<UserPreference["defaultLayout"]>, string> = {
  book: "book format",
  comic: "comic format",
  webtoon: "webtoon format",
};
const THEME_LABEL: Record<NonNullable<UserPreference["theme"]>, string> = {
  dark: "dark theme",
  light: "light theme",
  system: "system theme",
};

function factFor(key: string, value: unknown, userId: string): string | null {
  switch (key) {
    case "theme":
      return `user ${userId} prefers ${THEME_LABEL[value as NonNullable<UserPreference["theme"]>] ?? String(value)}`;
    case "defaultLayout":
      return `user ${userId} prefers reading in ${LAYOUT_LABEL[value as NonNullable<UserPreference["defaultLayout"]>] ?? String(value)}`;
    case "fontSize":
      return `user ${userId} prefers font size ${value}`;
    case "lineHeight":
      return `user ${userId} prefers ${value} line height`;
    case "pageNavigationStyle":
      return `user ${userId} prefers ${value} page navigation`;
    case "notifyNewChapters":
      return `user ${userId}${value ? " wants" : " does not want"} email about new chapters`;
    case "notifyComments":
      return `user ${userId}${value ? " wants" : " does not want"} notifications about comments`;
    case "notifyBookmarkUpdates":
      return `user ${userId}${value ? " wants" : " does not want"} bookmark update notifications`;
    case "profilePublic":
      return `user ${userId}${value ? " has a public" : " keeps private"} profile`;
    case "showReadingHistory":
      return `user ${userId}${value ? " shows" : " hides"} reading history`;
    default:
      return null;
  }
}

/**
 * Push changed preference facts to Supermemory. Fire-and-forget friendly:
 * safe to call without awaiting; failures are logged, never thrown.
 */
export async function pushPreferenceFacts(
  userId: string,
  input: UpdateUserPreferenceInput,
): Promise<SupertagMemoryResult> {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  const tag = containerTagForUser(userId);
  if (!apiKey || !tag) {
    return { ok: false, error: "supermemory unavailable (key or tag)" };
  }

  const facts: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }
    const fact = factFor(key, value, userId);
    if (fact) {
      facts.push(fact);
    }
  }
  if (facts.length === 0) {
    return { ok: true, written: 0 };
  }

  try {
    const res = await fetch(`${API_BASE}/v4/memories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        memories: facts.map((content) => ({
          content,
          isStatic: false,
          metadata: { source: "comicwise_prefs" },
        })),
        containerTag: tag,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[supermemory] /v4/memories -> HTTP ${res.status}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { memories?: unknown[] };
    return { ok: true, written: data.memories?.length ?? facts.length };
  } catch (error) {
    console.error("[supermemory] pushPreferenceFacts failed", error);
    return { ok: false, error: "request failed" };
  }
}

/**
 * Query prior context for a user (informational read path; comicwise DB
 * remains the source of truth for preferences).
 */
export async function searchUserContext(
  userId: string,
  query: string,
): Promise<Array<{ content: string; score: number; source: string }>> {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  const tag = containerTagForUser(userId);
  if (!apiKey || !tag || !query.trim()) {
    return [];
  }
  try {
    const res = await fetch(`${API_BASE}/v4/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ q: query, containerTag: tag, searchMode: "hybrid", limit: 5 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as {
      results?: Array<{ memory?: string; chunk?: string; similarity?: number }>;
    };
    return (data.results ?? []).map((r) => ({
      content: r.memory ?? r.chunk ?? "",
      score: Number(r.similarity ?? 0),
      source: r.chunk ? "document" : "memory",
    }));
  } catch {
    return [];
  }
}