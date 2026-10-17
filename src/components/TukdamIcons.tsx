import * as Iconoir from "iconoir-react";
import type { ComponentType, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
function shellIcon(Icon: ComponentType<SVGProps<SVGSVGElement>>) {
  return function ShellIcon({ size = 24, ...props }: IconProps) {
    return (
      <Icon
        width={size}
        height={size}
        strokeWidth={1.5}
        aria-hidden="true"
        {...props}
      />
    );
  };
}

export const ArrowLeft = shellIcon(Iconoir.ArrowLeft);
export const PanelLeft = shellIcon(Iconoir.SidebarCollapse);
export const SquarePen = shellIcon(Iconoir.EditPencil);
export const Bell = shellIcon(Iconoir.Bell);
export const Search = shellIcon(Iconoir.Search);
export const ChevronDown = shellIcon(Iconoir.NavArrowDown);
export const Plus = shellIcon(Iconoir.Plus);
export const SlidersHorizontal = shellIcon(Iconoir.Settings);
export const MessageCircle = shellIcon(Iconoir.ChatBubble);
export const Maximize2 = shellIcon(Iconoir.Expand);
export const Minus = shellIcon(Iconoir.Minus);
export const X = shellIcon(Iconoir.Xmark);
export const Check = shellIcon(Iconoir.Check);
export const Network = shellIcon(Iconoir.Network);
export const BookOpen = shellIcon(Iconoir.Book);

export const Folder = shellIcon(Iconoir.Folder);
