export type ReadingLocation =
  | { scale: "book"; bookId: string }
  | { scale: "section"; bookId: string; chapterId: string; sectionId: string };

export type RecentLearningLocation =
  ReadingLocation | { scale: "chat"; conversationId: string };

export type RecentLearningEntry = {
  id: string;
  bookId?: string;
  updatedAt: string;
  location: RecentLearningLocation;
  readingLocation?: ReadingLocation;
};

type RecentStorage = Pick<Storage, "getItem" | "setItem">;
export const RECENT_LEARNING_STORAGE_KEY = "tukdam.learning.recent.v1";
const MAX_ENTRIES = 20;

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= 200
  );
}

function parseLocation(value: unknown): RecentLearningLocation {
  if (!value || typeof value !== "object")
    throw new Error("Invalid learning destination.");
  const item = value as Record<string, unknown>;
  if (item.scale === "chat" && validId(item.conversationId))
    return { scale: "chat", conversationId: item.conversationId };
  if (item.scale === "book" && validId(item.bookId))
    return { scale: "book", bookId: item.bookId };
  if (
    item.scale === "section" &&
    validId(item.bookId) &&
    validId(item.chapterId) &&
    validId(item.sectionId)
  )
    return {
      scale: "section",
      bookId: item.bookId,
      chapterId: item.chapterId,
      sectionId: item.sectionId,
    };
  throw new Error("Invalid learning destination.");
}

function identity(location: RecentLearningLocation, bookId?: string) {
  return location.scale === "chat" && !bookId
    ? `chat:${location.conversationId}`
    : `book:${location.scale === "chat" ? bookId : location.bookId}`;
}

export function loadRecentLearning(
  storage: Pick<Storage, "getItem">,
): RecentLearningEntry[] {
  const raw = storage.getItem(RECENT_LEARNING_STORAGE_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > MAX_ENTRIES)
    throw new Error("Invalid recent learning history.");
  const seen = new Set<string>();
  return parsed
    .map((value: unknown) => {
      if (!value || typeof value !== "object")
        throw new Error("Invalid recent learning entry.");
      const item = value as Record<string, unknown>;
      const location = parseLocation(item.location);
      if (item.bookId !== undefined && !validId(item.bookId))
        throw new Error("Invalid recent book.");
      const bookId =
        location.scale === "chat"
          ? (item.bookId as string | undefined)
          : location.bookId;
      if (item.bookId !== undefined && item.bookId !== bookId)
        throw new Error("Mismatched recent book.");
      const id = identity(location, bookId);
      if (
        item.id !== id ||
        seen.has(id) ||
        typeof item.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(item.updatedAt)) ||
        new Date(item.updatedAt).toISOString() !== item.updatedAt
      )
        throw new Error("Invalid recent learning entry.");
      let readingLocation: ReadingLocation | undefined;
      if (item.readingLocation !== undefined) {
        const reading = parseLocation(item.readingLocation);
        if (reading.scale === "chat" || reading.bookId !== bookId)
          throw new Error("Invalid saved reading destination.");
        readingLocation = reading;
      }
      seen.add(id);
      return {
        id,
        ...(bookId ? { bookId } : {}),
        updatedAt: item.updatedAt,
        location,
        ...(readingLocation ? { readingLocation } : {}),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function recordRecentLearning(
  storage: RecentStorage,
  location: RecentLearningLocation,
  boundBookId?: string,
): RecentLearningEntry[] {
  const destination = parseLocation(location);
  if (boundBookId !== undefined && !validId(boundBookId))
    throw new Error("Invalid recent book.");
  const entries = loadRecentLearning(storage);
  const bookId =
    destination.scale === "chat" ? boundBookId : destination.bookId;
  const id = identity(destination, bookId);
  const previous = entries.find((entry) => entry.id === id);
  if (
    entries[0]?.id === id &&
    JSON.stringify(previous?.location) === JSON.stringify(destination)
  )
    return entries;
  const readingLocation =
    destination.scale === "chat"
      ? (previous?.readingLocation ??
        (previous?.location.scale !== "chat" ? previous?.location : undefined))
      : destination;
  const entry: RecentLearningEntry = {
    id,
    ...(bookId ? { bookId } : {}),
    updatedAt: new Date().toISOString(),
    location: destination,
    ...(readingLocation ? { readingLocation } : {}),
  };
  // Binding a previously independent chat should remove its separate history row.
  const next = [
    entry,
    ...entries.filter(
      (item) =>
        item.id !== id &&
        !(
          destination.scale === "chat" &&
          item.location.scale === "chat" &&
          item.location.conversationId === destination.conversationId
        ),
    ),
  ].slice(0, MAX_ENTRIES);
  storage.setItem(RECENT_LEARNING_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function latestReadingLocations(
  entries: readonly RecentLearningEntry[],
): Record<string, ReadingLocation> {
  const result: Record<string, ReadingLocation> = Object.create(null);
  for (const entry of [...entries].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )) {
    const reading =
      entry.location.scale === "chat" ? entry.readingLocation : entry.location;
    if (reading && !result[reading.bookId]) result[reading.bookId] = reading;
  }
  return result;
}
