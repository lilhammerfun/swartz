// Tabler Icons 3.50.0, MIT. See /licenses/icons.txt.
import IconAdjustmentsHorizontal from "@tabler/icons-react/dist/esm/icons/IconAdjustmentsHorizontal.mjs";
import IconAlertCircle from "@tabler/icons-react/dist/esm/icons/IconAlertCircle.mjs";
import IconArrowLeft from "@tabler/icons-react/dist/esm/icons/IconArrowLeft.mjs";
import IconArrowRight from "@tabler/icons-react/dist/esm/icons/IconArrowRight.mjs";
import IconArrowUp from "@tabler/icons-react/dist/esm/icons/IconArrowUp.mjs";
import IconArrowsMaximize from "@tabler/icons-react/dist/esm/icons/IconArrowsMaximize.mjs";
import IconArrowsMinimize from "@tabler/icons-react/dist/esm/icons/IconArrowsMinimize.mjs";
import IconBell from "@tabler/icons-react/dist/esm/icons/IconBell.mjs";
import IconBook from "@tabler/icons-react/dist/esm/icons/IconBook.mjs";
import IconBookFilled from "@tabler/icons-react/dist/esm/icons/IconBookFilled.mjs";
import IconBooks from "@tabler/icons-react/dist/esm/icons/IconBooks.mjs";
import IconCheck, {
  __iconNode as checkNodes,
} from "@tabler/icons-react/dist/esm/icons/IconCheck.mjs";
import IconChevronDown from "@tabler/icons-react/dist/esm/icons/IconChevronDown.mjs";
import IconChevronLeft from "@tabler/icons-react/dist/esm/icons/IconChevronLeft.mjs";
import IconChevronRight from "@tabler/icons-react/dist/esm/icons/IconChevronRight.mjs";
import IconCircle, {
  __iconNode as circleNodes,
} from "@tabler/icons-react/dist/esm/icons/IconCircle.mjs";
import IconCircleCheck from "@tabler/icons-react/dist/esm/icons/IconCircleCheck.mjs";
import IconCircleDot, {
  __iconNode as circleDotNodes,
} from "@tabler/icons-react/dist/esm/icons/IconCircleDot.mjs";
import IconCopy from "@tabler/icons-react/dist/esm/icons/IconCopy.mjs";
import IconCpu from "@tabler/icons-react/dist/esm/icons/IconCpu.mjs";
import IconDatabase from "@tabler/icons-react/dist/esm/icons/IconDatabase.mjs";
import IconDots from "@tabler/icons-react/dist/esm/icons/IconDots.mjs";
import IconEye from "@tabler/icons-react/dist/esm/icons/IconEye.mjs";
import IconEyeOff from "@tabler/icons-react/dist/esm/icons/IconEyeOff.mjs";
import IconFileText from "@tabler/icons-react/dist/esm/icons/IconFileText.mjs";
import IconFolder from "@tabler/icons-react/dist/esm/icons/IconFolder.mjs";
import IconFolderOpen from "@tabler/icons-react/dist/esm/icons/IconFolderOpen.mjs";
import IconHome from "@tabler/icons-react/dist/esm/icons/IconHome.mjs";
import IconHomeFilled from "@tabler/icons-react/dist/esm/icons/IconHomeFilled.mjs";
import IconInbox from "@tabler/icons-react/dist/esm/icons/IconInbox.mjs";
import IconInfoCircle from "@tabler/icons-react/dist/esm/icons/IconInfoCircle.mjs";
import IconLayoutDashboard from "@tabler/icons-react/dist/esm/icons/IconLayoutDashboard.mjs";
import IconLayoutSidebar from "@tabler/icons-react/dist/esm/icons/IconLayoutSidebar.mjs";
import IconLayoutSidebarRight from "@tabler/icons-react/dist/esm/icons/IconLayoutSidebarRight.mjs";
import IconListCheck from "@tabler/icons-react/dist/esm/icons/IconListCheck.mjs";
import IconLoader2 from "@tabler/icons-react/dist/esm/icons/IconLoader2.mjs";
import IconMaximize from "@tabler/icons-react/dist/esm/icons/IconMaximize.mjs";
import IconMessage from "@tabler/icons-react/dist/esm/icons/IconMessage.mjs";
import IconMessageCirclePlus from "@tabler/icons-react/dist/esm/icons/IconMessageCirclePlus.mjs";
import IconMessages from "@tabler/icons-react/dist/esm/icons/IconMessages.mjs";
import IconMinus from "@tabler/icons-react/dist/esm/icons/IconMinus.mjs";
import IconPalette from "@tabler/icons-react/dist/esm/icons/IconPalette.mjs";
import IconPlus from "@tabler/icons-react/dist/esm/icons/IconPlus.mjs";
import IconSearch from "@tabler/icons-react/dist/esm/icons/IconSearch.mjs";
import IconSettings from "@tabler/icons-react/dist/esm/icons/IconSettings.mjs";
import IconSquare from "@tabler/icons-react/dist/esm/icons/IconSquare.mjs";
import IconUser from "@tabler/icons-react/dist/esm/icons/IconUser.mjs";
import IconX from "@tabler/icons-react/dist/esm/icons/IconX.mjs";
import { forwardRef, type SVGProps } from "react";
import type { TablerIcon } from "@tabler/icons-react";
import { cn } from "cn";

export type AppIconProps = Omit<
  SVGProps<SVGSVGElement>,
  "ref" | "fill" | "stroke" | "strokeWidth"
> & {
  size?: number | string;
  title?: string;
};

// Same official glyphs and rendering contract as the reference client.
function productIcon(
  Glyph: TablerIcon,
  name: string,
  variant: "outline" | "filled" = "outline",
) {
  const Icon = forwardRef<SVGSVGElement, AppIconProps>(function Icon(
    { size, width, height, className, title, children, ...props },
    ref,
  ) {
    return (
      <Glyph
        aria-hidden="true"
        focusable="false"
        {...props}
        ref={ref}
        data-icon={name}
        data-icon-style={variant}
        size={size ?? width ?? height ?? 16}
        width={width ?? size ?? height ?? 16}
        height={height ?? size ?? width ?? 16}
        className={cn("client-icon shrink-0", className)}
        fill={variant === "filled" ? "currentColor" : "none"}
        stroke={variant === "filled" ? 0 : "var(--icon-stroke-width)"}
        strokeLinecap="round"
        strokeLinejoin="round"
        shapeRendering="geometricPrecision"
      >
        {title ? <title>{title}</title> : null}
        {children}
      </Glyph>
    );
  });
  Icon.displayName = name;
  return Icon;
}

export const ArrowLeft = /* @__PURE__ */ productIcon(
  IconArrowLeft,
  "arrow-left",
);
export const ArrowRight = /* @__PURE__ */ productIcon(
  IconArrowRight,
  "arrow-right",
);
export const ArrowUp = /* @__PURE__ */ productIcon(IconArrowUp, "arrow-up");
export const Bell = /* @__PURE__ */ productIcon(IconBell, "bell");
export const BookFilled = /* @__PURE__ */ productIcon(
  IconBookFilled,
  "book",
  "filled",
);
export const BookOpen = /* @__PURE__ */ productIcon(IconBook, "book");
export const Check = /* @__PURE__ */ productIcon(IconCheck, "check");
export const CheckCircle2 = /* @__PURE__ */ productIcon(
  IconCircleCheck,
  "circle-check",
);
export const ChevronDown = /* @__PURE__ */ productIcon(
  IconChevronDown,
  "chevron-down",
);
export const ChevronRight = /* @__PURE__ */ productIcon(
  IconChevronRight,
  "chevron-right",
);
export const ChevronLeft = /* @__PURE__ */ productIcon(
  IconChevronLeft,
  "chevron-left",
);
export const Circle = /* @__PURE__ */ productIcon(IconCircle, "circle");
export const CircleAlert = /* @__PURE__ */ productIcon(
  IconAlertCircle,
  "alert-circle",
);
export const CircleDot = /* @__PURE__ */ productIcon(
  IconCircleDot,
  "circle-dot",
);
export const Copy = /* @__PURE__ */ productIcon(IconCopy, "copy");
export const Cpu = /* @__PURE__ */ productIcon(IconCpu, "cpu");
export const Database = /* @__PURE__ */ productIcon(IconDatabase, "database");
export const Eye = /* @__PURE__ */ productIcon(IconEye, "eye");
export const EyeOff = /* @__PURE__ */ productIcon(IconEyeOff, "eye-off");
export const FileText = /* @__PURE__ */ productIcon(IconFileText, "file-text");
export const Folder = /* @__PURE__ */ productIcon(IconFolder, "folder");
export const FolderOpen = /* @__PURE__ */ productIcon(
  IconFolderOpen,
  "folder-open",
);
export const Fullscreen = /* @__PURE__ */ productIcon(IconMaximize, "maximize");
export const Home = /* @__PURE__ */ productIcon(IconHome, "home");
export const HomeFilled = /* @__PURE__ */ productIcon(
  IconHomeFilled,
  "home",
  "filled",
);
export const Inbox = /* @__PURE__ */ productIcon(IconInbox, "inbox");
export const Info = /* @__PURE__ */ productIcon(IconInfoCircle, "info-circle");
export const LayoutDashboard = /* @__PURE__ */ productIcon(
  IconLayoutDashboard,
  "layout-dashboard",
);
export const Library = /* @__PURE__ */ productIcon(IconBooks, "books");
export const ListChecks = /* @__PURE__ */ productIcon(
  IconListCheck,
  "list-check",
);
export const MessageCirclePlus = /* @__PURE__ */ productIcon(
  IconMessageCirclePlus,
  "message-circle-plus",
);
export const LoaderCircle = /* @__PURE__ */ productIcon(IconLoader2, "loader2");
export const Maximize = /* @__PURE__ */ productIcon(
  IconArrowsMaximize,
  "arrows-maximize",
);
export const MessageSquare = /* @__PURE__ */ productIcon(
  IconMessage,
  "message",
);
export const MessagesSquare = /* @__PURE__ */ productIcon(
  IconMessages,
  "messages",
);
export const Minimize = /* @__PURE__ */ productIcon(
  IconArrowsMinimize,
  "arrows-minimize",
);
export const Minus = /* @__PURE__ */ productIcon(IconMinus, "minus");
export const MoreHorizontal = /* @__PURE__ */ productIcon(IconDots, "dots");
export const Palette = /* @__PURE__ */ productIcon(IconPalette, "palette");
export const PanelLeft = /* @__PURE__ */ productIcon(
  IconLayoutSidebar,
  "layout-sidebar",
);
export const PanelRight = /* @__PURE__ */ productIcon(
  IconLayoutSidebarRight,
  "layout-sidebar-right",
);
export const Plus = /* @__PURE__ */ productIcon(IconPlus, "plus");
export const Search = /* @__PURE__ */ productIcon(IconSearch, "search");
export const Settings = /* @__PURE__ */ productIcon(IconSettings, "settings");
export const Settings2 = /* @__PURE__ */ productIcon(
  IconAdjustmentsHorizontal,
  "adjustments-horizontal",
);
export const Square = /* @__PURE__ */ productIcon(IconSquare, "square");
export const UserRound = /* @__PURE__ */ productIcon(IconUser, "user");
export const X = /* @__PURE__ */ productIcon(IconX, "x");

export { Check as CheckIcon };
export { ChevronRight as ChevronRightIcon };
export { Copy as CopyIcon };
export { PanelLeft as PanelLeftIcon };
export { X as XIcon };

/** Official glyph nodes for renderers that own their DOM outside React. */
export function createIconElement(name: "check" | "circle" | "circle-dot") {
  const nodes = {
    check: checkNodes,
    circle: circleNodes,
    "circle-dot": circleDotNodes,
  }[name];
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "var(--icon-stroke-width)",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "shape-rendering": "geometricPrecision",
    "aria-hidden": "true",
  }))
    svg.setAttribute(key, value);
  for (const [tag, attributes] of nodes) {
    const child = document.createElementNS(namespace, tag);
    for (const [key, value] of Object.entries(attributes))
      if (key !== "key") child.setAttribute(key, value);
    svg.append(child);
  }
  return svg;
}
