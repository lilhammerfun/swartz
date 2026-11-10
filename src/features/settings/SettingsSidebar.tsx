import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { getSettingsSection, settingsSections } from "./settings-sections";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function SettingsSidebar() {
  const [params] = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const section = getSettingsSection(params.get("section"));

  return (
    <Sidebar
      collapsible="offcanvas"
      className="settings-sidebar"
      aria-label="Settings navigation"
    >
      <SidebarHeader className="secondary-navigation-header">
        <span>Settings</span>
      </SidebarHeader>
      <SidebarContent className="sidebar-navigation">
        <SidebarGroup className="p-0">
          <nav aria-label="Settings sections">
            <SidebarMenu>
              {settingsSections.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <Button asChild variant="navigation" size="navigation">
                    <Link
                      to={
                        item.id === "model"
                          ? "/settings"
                          : `/settings?section=${item.id}`
                      }
                      aria-current={section.id === item.id ? "page" : undefined}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </Button>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
