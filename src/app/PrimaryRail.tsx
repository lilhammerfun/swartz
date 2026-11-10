import type { ReactNode } from "react";
import {
  Home,
  HomeFilled,
  BookFilled,
  BookOpen,
  ListChecks,
  Settings,
  UserRound,
} from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import type { ReaderLocation } from "@/types/book";

export function PrimaryRail({
  location,
  onNavigate,
  gettingStarted,
}: {
  location: ReaderLocation;
  onNavigate: (location: ReaderLocation) => void;
  gettingStarted: ReactNode;
}) {
  const inLibrary = ["library", "project"].includes(location.scale);
  const inChats = ["home", "chat", "book", "section"].includes(location.scale);
  return (
    <nav className="primary-rail" aria-label="Main navigation">
      <IconButton
        label="Home"
        variant="navigation"
        size="icon"
        className="primary-rail-item"
        aria-current={inChats ? "page" : undefined}
        onClick={() => onNavigate({ scale: "home" })}
      >
        {inChats ? <HomeFilled /> : <Home />}
      </IconButton>
      <IconButton
        label="Library"
        variant="navigation"
        size="icon"
        className="primary-rail-item"
        aria-current={inLibrary ? "page" : undefined}
        onClick={() => onNavigate({ scale: "library" })}
      >
        {inLibrary ? <BookFilled /> : <BookOpen />}
      </IconButton>
      <div className="primary-rail-footer">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="profile-trigger"
              aria-label="Open profile menu"
            >
              <span className="profile-avatar">
                <UserRound aria-hidden="true" />
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="end"
            sideOffset={12}
            className="w-56"
          >
            {/* TODO: Populate this header with account profile data when available. */}
            <DropdownMenuLabel className="flex items-center gap-3">
              <Avatar size="lg" aria-hidden="true">
                <AvatarFallback>
                  <UserRound className="size-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">
                  Local user
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  ID: —
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => onNavigate({ scale: "settings" })}
              >
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ListChecks />
                  Getting started
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent align="end" className="w-64">
                    {gettingStarted}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
