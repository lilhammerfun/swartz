import {
  isRouteErrorResponse,
  useRevalidator,
  useRouteError,
  Link,
} from "react-router";
import { Button } from "@/components/ui/button";

export function RouteLoading() {
  return (
    <section
      className="p-6 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      Loading…
    </section>
  );
}

export function RouteError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  const message = missing
    ? "This page could not be found."
    : typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "This page could not be loaded.";
  return (
    <section className="space-y-4 p-6" role="alert">
      <h1 className="text-base font-medium">
        {missing ? "Page not found" : "Unable to load page"}
      </h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        {!missing && (
          <Button
            variant="outline"
            disabled={revalidator.state !== "idle"}
            onClick={() => {
              void revalidator.revalidate();
            }}
          >
            Retry
          </Button>
        )}
        <Button variant="ghost" asChild>
          <Link to="/library">Back to Library</Link>
        </Button>
      </div>
    </section>
  );
}
