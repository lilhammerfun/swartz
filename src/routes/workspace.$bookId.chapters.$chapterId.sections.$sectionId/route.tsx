import { useOutletContext } from "react-router";
import type { AppRouteContext } from "@/app/app-route-context";
import { ReadingDocument } from "@/features/reader/ReadingDocument";
export const handle = {
  readerLocation: (params: Record<string, string>) => ({
    scale: "section" as const,
    bookId: params.bookId,
    chapterId: params.chapterId,
    sectionId: params.sectionId,
  }),
};
export default function SectionRoute() {
  const { reader } = useOutletContext<AppRouteContext>();
  if (!reader) throw new Error("This section could not be found.");
  return <ReadingDocument {...reader} />;
}
