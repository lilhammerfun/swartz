import { useOutletContext } from "react-router";
import type { Route } from "./+types/route";
import type { AppRouteContext } from "@/app/app-route-context";
import { ProjectPage } from "@/features/projects/ProjectPage";
import { getProjectDetail } from "@/features/projects/project-service";
export { RouteError as ErrorBoundary } from "@/app/RouteFeedback";
export const handle = {
  readerLocation: (params: Record<string, string>) => ({
    scale: "project" as const,
    projectId: params.projectId,
  }),
};
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return getProjectDetail(params.projectId);
}
export default function ProjectRoute({ loaderData }: Route.ComponentProps) {
  return (
    <ProjectPage
      key={loaderData.project.id}
      detail={loaderData}
      onStart={useOutletContext<AppRouteContext>().project.onStart}
    />
  );
}
