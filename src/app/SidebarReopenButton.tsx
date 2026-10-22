import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarReopenButton() {
  const { open, openMobile, isMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;
  const label = expanded ? "Collapse sidebar" : "Open sidebar";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarTrigger
          aria-label={label}
          aria-expanded={expanded}
          className="size-8 text-muted-foreground"
        />
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}
