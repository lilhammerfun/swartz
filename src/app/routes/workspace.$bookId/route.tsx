import { Outlet, useOutletContext } from "react-router";
import type { Route } from "./+types/route";
import { loadWorkspaceBook } from "@/app/workspace-loader";
import type { AppRouteContext } from "@/app/app-route-context";
export { RouteError as ErrorBoundary } from "@/app/RouteFeedback";
export const handle = {
  readerLocation: (params: Record<string, string>) => ({
    scale: "book" as const,
    bookId: params.bookId,
  }),
};
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return loadWorkspaceBook(params.bookId);
}
export default function WorkspaceLayout() {
  return <Outlet context={useOutletContext<AppRouteContext>()} />;
}
