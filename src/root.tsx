import type { ReactNode } from "react";
import { Links, Meta, Scripts, ScrollRestoration } from "react-router";
import "@fontsource/source-serif-4/latin-400.css";
import "@fontsource/source-serif-4/latin-600.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "@/app/App";
import { RouteError, RouteLoading } from "@/app/RouteFeedback";
import "@/app/styles.css";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="swartz-client" content="book-reader" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <title>Swartz</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Prerender only this SPA fallback; App storage and native APIs run exclusively on the client.
export function HydrateFallback() {
  return <RouteLoading />;
}
export function ErrorBoundary() {
  return <RouteError />;
}
export default function Root() {
  return (
    <TooltipProvider delayDuration={400}>
      <App />
    </TooltipProvider>
  );
}
