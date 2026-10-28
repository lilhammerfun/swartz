import {
  useOutletContext,
  useRevalidator,
  useSearchParams,
  Navigate,
} from "react-router";
import type { Route } from "./+types/route";
import type { AppRouteContext } from "@/app/app-route-context";
import { LibraryPage } from "@/features/library/LibraryPage";
import { getLibrary } from "@/features/projects/project-service";
export { RouteError as ErrorBoundary } from "@/app/RouteFeedback";
export const handle = { readerLocation: () => ({ scale: "library" as const }) };
export async function clientLoader() {
  return getLibrary();
}
export default function LibraryRoute({ loaderData }: Route.ComponentProps) {
  const { library } = useOutletContext<AppRouteContext>();
  const revalidator = useRevalidator();
  const [params] = useSearchParams();
  const sectionId = params.get("section");
  if (
    sectionId &&
    !loaderData.sections.some((section) => section.id === sectionId)
  )
    return <Navigate to="/library" replace />;
  return (
    <LibraryPage
      {...library}
      projects={loaderData.projects}
      sections={loaderData.sections}
      saving={library.saving || revalidator.state !== "idle"}
      key={
        sectionId ??
        (params.get("view") === "recent" ? "all-recent" : "overview")
      }
      sectionId={sectionId}
      showAll={params.get("view") === "recent"}
      onChange={async (change) => {
        await library.onChange(change);
        await revalidator.revalidate();
      }}
    />
  );
}
