import {
  getLibrary,
  getProjectDetail,
} from "@/features/projects/project-service";
import { projectBook } from "@/features/projects/project-data";
import { learningBook } from "@/mock-data/book";
import {
  LIBRARY_STORAGE_KEY,
  parseLibrary,
} from "@/features/library/library-store";

// 在客户端导航时读取，支持刷新动态项目路径；旧教材记录仍能打开。
export async function loadWorkspaceBook(bookId: string) {
  const library = await getLibrary();
  const project = library.projects.find((item) => item.id === bookId);
  if (project)
    return { book: projectBook(project, await getProjectDetail(bookId)) };
  const legacy = [
    learningBook,
    ...parseLibrary(localStorage.getItem(LIBRARY_STORAGE_KEY) ?? "[]"),
  ].find((book) => book.id === bookId);
  if (!legacy) throw new Response("Project not found", { status: 404 });
  return { book: legacy };
}
