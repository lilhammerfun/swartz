import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "../components/atoms/Button";
import { Maximize2, Minus, X } from "../components/TukdamIcons";

export function WindowBar() {
  if (!isTauri()) return null;
  const native = (action: "minimize" | "toggleMaximize" | "close") =>
    void getCurrentWindow()[action]();
  return (
    <div className="windowbar">
      <div className="window-drag" data-tauri-drag-region />
      <div className="window-controls">
        <Button
          variant="quiet"
          size="xs"
          aria-label="最小化"
          onClick={() => native("minimize")}
        >
          <Minus size={12} />
        </Button>
        <Button
          variant="quiet"
          size="xs"
          aria-label="最大化"
          onClick={() => native("toggleMaximize")}
        >
          <Maximize2 size={12} />
        </Button>
        <Button
          variant="quiet"
          size="xs"
          aria-label="关闭窗口"
          onClick={() => native("close")}
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  );
}
