import { RouteError } from "@/app/RouteFeedback";
export function clientLoader() {
  throw new Response("Page not found", { status: 404 });
}
export const ErrorBoundary = RouteError;
export default function NotFoundRoute() {
  return null;
}
