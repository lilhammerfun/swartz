import {
  isRouteErrorResponse,
  useRevalidator,
  useRouteError,
  Link,
  useLocation,
} from "react-router";
import { RuntimeErrorNotice } from "@/components/ui/feedback";
import { PageLayout } from "@/components/ui/page-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function RouteLoading({
  conversation = false,
}: {
  conversation?: boolean;
}) {
  const { pathname } = useLocation();
  const reader = pathname.startsWith("/workspace/") && !conversation;
  if (conversation)
    return (
      <div className="conversation-content" role="status">
        <span className="sr-only">Loading conversation…</span>
        <div aria-hidden="true" className="conversation-loading">
          <Skeleton className="h-12 w-3/4 self-end" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  return (
    <PageLayout
      label="Loading page"
      className={reader ? "page-feedback reading-document" : "page-feedback"}
      rememberScroll={false}
    >
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <div aria-hidden="true">
          <Skeleton className="page-skeleton-heading" />
          <Skeleton className="page-skeleton-line" />
          {pathname === "/library" ? (
            <div className="library-bookshelf mt-10">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="aspect-4/5" />
              ))}
            </div>
          ) : (
            <div className="page-skeleton-body">
              <Skeleton className="page-skeleton-block" />
              <Skeleton className="page-skeleton-block" />
            </div>
          )}
        </div>
      </div>
    </PageLayout>
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
    <PageLayout
      label={missing ? "Page not found" : "Unable to load page"}
      className="page-feedback"
      rememberScroll={false}
    >
      <RuntimeErrorNotice
        title={missing ? "Page not found" : "Unable to load page"}
        action={
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
        }
      >
        {message}
      </RuntimeErrorNotice>
    </PageLayout>
  );
}
