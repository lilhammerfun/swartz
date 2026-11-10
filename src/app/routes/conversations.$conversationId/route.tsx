import { useOutletContext } from "react-router";
import type { AppRouteContext } from "@/app/app-route-context";
import type { Route } from "./+types/route";
import { readChat } from "@/features/chat/chat-store";
import { loadWorkspaceBook } from "@/app/workspace-loader";
export { RouteError as ErrorBoundary } from "@/app/RouteFeedback";
export const handle = {
  readerLocation: (params: Record<string, string>) => ({
    scale: "chat" as const,
    conversationId: params.conversationId,
  }),
};
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const session = readChat(localStorage).sessions.find(
    (session) => session.id === params.conversationId,
  );
  if (!session) throw new Response("Conversation not found", { status: 404 });
  return session.bookId ? loadWorkspaceBook(session.bookId) : { book: null };
}
export default function ConversationRoute() {
  return useOutletContext<AppRouteContext>().conversation;
}
