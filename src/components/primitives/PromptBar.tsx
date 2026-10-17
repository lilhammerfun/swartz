import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../atoms/Button";
import GlideMenu from "./GlideMenu";
import { Plus, ChevronDown, Check } from "../TukdamIcons";
import { ArrowUp } from "iconoir-react";
const models = ["DeepSeek", "Claude", "自定义模型"];
/** Beautiful UI's multi-line composer, with controlled product data. */
export default function PromptBar({
  draftValue,
  onDraftChange,
  onSend,
  selectedModel,
  onModelChange,
  onOpenTutorial,
  disabled,
  placeholder,
}: {
  draftValue: string;
  onDraftChange: (text: string) => void;
  onSend: (text: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onOpenTutorial: () => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const model = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{
    bottom: number;
    left: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height =
        Math.max(72, Math.min(180, input.current.scrollHeight)) + "px";
    }
  }, [draftValue]);
  useEffect(() => {
    if (!position) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-model-picker]"))
        setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPosition(null);
        model.current?.focus();
      }
    };
    const resize = () => setPosition(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", resize);
    };
  }, [position]);
  const send = () => {
    if (draftValue.trim() && !disabled) onSend(draftValue.trim());
  };
  return (
    <div className="rounded-[20px] bg-surface p-3 shadow-card">
      <textarea
        ref={input}
        aria-label="问题"
        rows={2}
        value={draftValue}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            send();
          }
        }}
        className="block w-full resize-none bg-transparent px-2 py-2 text-[14px] leading-5 text-ink placeholder:text-ink-3"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="quiet"
          size="xs"
          className="icon-control"
          aria-label="打开教程"
          onClick={onOpenTutorial}
        >
          <Plus size={17} />
        </Button>
        <div data-model-picker>
          <button
            ref={model}
            type="button"
            aria-label="选择模型"
            aria-haspopup="menu"
            aria-expanded={!!position}
            className="flex h-7 items-center gap-1.5 rounded-[7px] px-1.5 text-[12px] text-ink-2 hover:bg-hover"
            onClick={() => {
              const box = model.current!.getBoundingClientRect();
              setPosition(
                position
                  ? null
                  : {
                      bottom: window.innerHeight - box.top + 6,
                      left: Math.max(
                        8,
                        Math.min(box.left, window.innerWidth - 220),
                      ),
                    },
              );
            }}
          >
            {selectedModel}
            <ChevronDown size={13} />
          </button>
        </div>
        <Button
          variant="primary"
          size="xs"
          className="ml-auto size-7 p-0"
          aria-label="发送"
          disabled={!draftValue.trim() || disabled}
          onClick={send}
        >
          <ArrowUp width={16} height={16} />
        </Button>
      </div>
      {position &&
        createPortal(
          <div
            data-model-picker
            className="model-menu"
            role="menu"
            aria-label="模型"
            style={position}
          >
            <GlideMenu
              rowSelector="button"
              highlightClassName="inset-x-0 rounded-[7px] bg-hover-2"
            >
              {models.map((name) => (
                <Button
                  key={name}
                  role="menuitemradio"
                  aria-checked={name === selectedModel}
                  variant="quiet"
                  size="xs"
                  onClick={() => {
                    onModelChange(name);
                    setPosition(null);
                    model.current?.focus();
                  }}
                >
                  <span>{name}</span>
                  {name === selectedModel && <Check size={14} />}
                </Button>
              ))}
            </GlideMenu>
          </div>,
          document.body,
        )}
    </div>
  );
}
