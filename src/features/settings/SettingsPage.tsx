import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelSettingsForm } from "@/features/model/ModelSettingsForm";
import type { ModelConfig, ModelSettings } from "@/features/model/model-api";

export function SettingsPage({
  settings,
  loadError,
  onSave,
}: {
  settings: ModelSettings;
  loadError: string;
  onSave: (input: ModelConfig) => Promise<void>;
}) {
  return (
    <ScrollArea className="min-h-0 min-w-0 bg-muted/20">
      <section
        aria-label="Settings"
        className="mx-auto w-full max-w-[720px] px-6 py-6 sm:px-10"
      >
        <section aria-labelledby="settings-model-title">
          <div className="mb-4 space-y-1.5">
            <h2 id="settings-model-title" className="text-sm font-medium">
              Model
            </h2>
            <p className="text-xs leading-5 text-muted-foreground">
              Used for AI questions across your library.
            </p>
          </div>
          <ModelSettingsForm
            settings={settings}
            loadError={loadError}
            onSave={onSave}
          />
        </section>
      </section>
    </ScrollArea>
  );
}
