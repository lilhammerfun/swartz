import type { ReaderLocation } from "../types/book.ts";

// Preserve the reader and recent-location data shapes; React Router owns path matching and navigation history.
export function locationPath(location: ReaderLocation): string {
  const segment = encodeURIComponent;
  switch (location.scale) {
    case "home":
      return "/";
    case "library":
      return "/library";
    case "settings":
      return "/settings";
    case "project":
      return `/projects/${segment(location.projectId)}`;
    case "chat":
      return `/conversations/${segment(location.conversationId)}`;
    case "book":
      return `/workspace/${segment(location.bookId)}`;
    case "section":
      return `/workspace/${segment(location.bookId)}/chapters/${segment(location.chapterId)}/sections/${segment(location.sectionId)}`;
  }
}

export interface ReaderRouteHandle {
  readerLocation: (
    params: Record<string, string | undefined>,
  ) => ReaderLocation;
}
