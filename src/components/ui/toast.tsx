import { Toast } from "radix-ui";
import { CloseButton } from "./close-button";

export function ToastNotice({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Toast.Provider duration={4200} swipeDirection="up">
      <Toast.Root
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        data-slot="toast"
      >
        <Toast.Title className="min-w-0 flex-1">{children}</Toast.Title>
        <Toast.Close asChild>
          <CloseButton label="Dismiss notification" size="icon-xs" />
        </Toast.Close>
      </Toast.Root>
      <Toast.Viewport
        data-slot="toast-viewport"
        hotkey={["altKey", "KeyT"]}
        label="Notifications (Alt+T)"
      />
    </Toast.Provider>
  );
}
