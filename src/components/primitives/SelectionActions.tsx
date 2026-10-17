import { useEffect, useState, type RefObject } from "react";
import { Button } from "../atoms/Button";
import { MessageCircle } from "../TukdamIcons";

/** Beautiful UI's contextual action bar, bound to real reader selections. */
export default function SelectionActions({
  container,
  onQuote,
}: {
  container: RefObject<HTMLElement | null>;
  onQuote: (text: string, messageIds: string[]) => void;
}) {
  const [picked, setPicked] = useState<{
    text: string;
    messageIds: string[];
  } | null>(null);
  useEffect(() => {
    const read = () => {
      const selection = window.getSelection();
      if (
        !selection?.rangeCount ||
        selection.isCollapsed ||
        !container.current?.contains(selection.anchorNode) ||
        !container.current?.contains(selection.focusNode)
      ) {
        setPicked(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const text = selection.toString().trim();
      if (!/[\p{L}\p{N}]/u.test(text)) {
        setPicked(null);
        return;
      }
      const messageIds = [
        ...container.current.querySelectorAll<HTMLElement>(
          "[data-source-message]",
        ),
      ]
        .filter((node) => range.intersectsNode(node))
        .map((node) => node.dataset.sourceMessage!)
        .filter(Boolean);
      setPicked(text ? { text, messageIds: [...new Set(messageIds)] } : null);
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [container]);
  if (!picked) return null;
  return (
    <div className="reader-selection-actions">
      <Button
        variant="secondary"
        size="sm"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          onQuote(picked.text, picked.messageIds);
          window.getSelection()?.removeAllRanges();
          setPicked(null);
        }}
      >
        <MessageCircle size={15} />
        引用追问
      </Button>
    </div>
  );
}
