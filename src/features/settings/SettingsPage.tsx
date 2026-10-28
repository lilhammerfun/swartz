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
        <section aria-labelledby="settings-about-title" className="mt-10">
          <h2
            id="settings-about-title"
            className="text-sm font-medium text-foreground"
          >
            About Swartz
          </h2>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            The logo adapts{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Aaron_Swartz_profile.jpg"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Aaron Swartz profile.jpg
            </a>{" "}
            by{" "}
            <a
              href="https://www.fredbenenson.com/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Fred Benenson
            </a>
            . The source photograph is licensed under{" "}
            <a
              href="https://creativecommons.org/licenses/by/2.0/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              CC BY 2.0
            </a>
            .
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Cropped, converted to black and white, and redrawn as a portrait
            mark. Swartz is an independent project; no endorsement is implied.
          </p>
        </section>
      </section>
    </ScrollArea>
  );
}
