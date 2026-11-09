import {
  Home,
  HomeFilled,
  BookFilled,
  Library,
  ListChecks,
  Search,
  Settings,
  UserRound,
} from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import type { ReaderLocation } from "@/types/book";

export function PrimaryRail({
  location,
  onNavigate,
  onSearch,
  onGettingStarted,
}: {
  location: ReaderLocation;
  onNavigate: (location: ReaderLocation) => void;
  onSearch: () => void;
  onGettingStarted: () => void;
}) {
  const { isMobile, setOpenMobile, setOpen } = useSidebar();
  const inLibrary = ["library", "project", "book", "section"].includes(
    location.scale,
  );
  return (
    <nav className="primary-rail" aria-label="Main navigation">
      <IconButton
        label="Home"
        variant="navigation"
        size="icon"
        className="primary-rail-item"
        aria-current={
          location.scale === "home" || (location.scale === "chat" && !inLibrary)
            ? "page"
            : undefined
        }
        onClick={() => onNavigate({ scale: "home" })}
      >
        {location.scale === "home" || location.scale === "chat" ? (
          <HomeFilled />
        ) : (
          <Home />
        )}
      </IconButton>
      <IconButton
        label="Search"
        variant="navigation"
        size="icon"
        className="primary-rail-item"
        onClick={onSearch}
      >
        <Search />
      </IconButton>
      <IconButton
        label="Library"
        variant="navigation"
        size="icon"
        className="primary-rail-item"
        aria-current={inLibrary ? "page" : undefined}
        onClick={() => onNavigate({ scale: "library" })}
      >
        {inLibrary ? <BookFilled /> : <Library />}
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
            <DropdownMenuLabel>You · Personal workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => onNavigate({ scale: "settings" })}
              >
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  onGettingStarted();
                  if (isMobile) setOpenMobile(true);
                  else setOpen(true);
                }}
              >
                <ListChecks />
                Getting started
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
