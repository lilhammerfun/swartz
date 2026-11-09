import { useRef } from "react";
import { Search } from "./icons";
import { CloseButton } from "./close-button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group";
import { Button } from "./button";
import { Kbd } from "./kbd";

export function SearchTrigger({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="search-trigger"
      aria-label={label}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={onClick}
    >
      <Search />
      <span>{label}…</span>
      <Kbd aria-hidden>{/Mac/.test(navigator.platform) ? "⌘ K" : "Ctrl K"}</Kbd>
    </Button>
  );
}

export function SearchInput({
  value,
  onClear,
  ...props
}: React.ComponentProps<"input"> & { value: string; onClear: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <InputGroup className="search-input">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput ref={input} type="search" value={value} {...props} />
      {value && (
        <InputGroupAddon align="inline-end">
          <CloseButton
            size="icon-xs"
            label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onClear();
              input.current?.focus();
            }}
          />
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
