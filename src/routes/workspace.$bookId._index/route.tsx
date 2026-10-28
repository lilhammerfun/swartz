import { Navigate, useOutletContext } from "react-router";
import type { AppRouteContext } from "@/app/app-route-context";
import { EmptyBook } from "@/features/reader/EmptyBook";
import { locationPath } from "@/app/route-location";
export default function WorkspaceIndex() {
  const { book } = useOutletContext<AppRouteContext>();
  const chapter = book.chapters.find((chapter) => chapter.sections.length > 0);
  // 直接打开工作区根路径时，有正文就进入第一节；空教材才展示空状态。
  if (chapter) {
    return (
      <Navigate
        replace
        to={locationPath({
          scale: "section",
          bookId: book.id,
          chapterId: chapter.id,
          sectionId: chapter.sections[0].id,
        })}
      />
    );
  }
  return <EmptyBook book={book} />;
}
