import { useOutletContext } from "react-router";
import type { AppRouteContext } from "@/app/app-route-context";
import { HomePage } from "@/features/home/HomePage";
export const handle = { readerLocation: () => ({ scale: "home" as const }) };
export default function HomeRoute() {
  return <HomePage {...useOutletContext<AppRouteContext>().home} />;
}
