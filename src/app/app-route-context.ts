import type { ComponentProps, ReactNode } from "react";
import type { HomePage } from "@/features/home/HomePage";
import type { LibraryPage } from "@/features/library/LibraryPage";
import type { SettingsPage } from "@/features/settings/SettingsPage";
import type { ReadingDocument } from "@/features/reader/ReadingDocument";
import type { LearningBook } from "@/types/book";
import type { ProjectDetail } from "@/features/projects/project-data";

// 共享布局持有持续运行的会话和草稿，子路由只接收渲染所需接口。
export interface AppRouteContext {
  home: ComponentProps<typeof HomePage>;
  library: ComponentProps<typeof LibraryPage>;
  settings: ComponentProps<typeof SettingsPage>;
  project: { onStart: (detail: ProjectDetail) => void };
  conversation: ReactNode;
  reader: ComponentProps<typeof ReadingDocument> | null;
  book: LearningBook;
}
