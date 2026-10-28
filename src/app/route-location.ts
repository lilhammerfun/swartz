import type { ReaderLocation } from "../types/book.ts";

// 兼容现有阅读器/最近访问记录的数据形状；路径匹配和导航历史交给 React Router。
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
