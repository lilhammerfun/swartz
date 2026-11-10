import { useOutletContext } from "react-router";
import type { AppRouteContext } from "@/app/app-route-context";
import { SettingsPage } from "@/features/settings/SettingsPage";
export const handle = {
  readerLocation: () => ({ scale: "settings" as const }),
};
export default function SettingsRoute() {
  return <SettingsPage {...useOutletContext<AppRouteContext>().settings} />;
}
