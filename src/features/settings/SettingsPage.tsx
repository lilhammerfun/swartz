import { PageLayout, PageHeading } from "@/components/ui/page-layout";
import { SettingsSection } from "@/components/ui/settings-layout";
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
    <PageLayout label="Settings" className="settings-page">
      <PageHeading
        title="Settings"
        description="Make Swartz work for the way you learn."
      />
      <SettingsSection
        title="Model"
        description="Your model is used for conversations and learning guidance."
      >
        <ModelSettingsForm
          settings={settings}
          loadError={loadError}
          onSave={onSave}
        />
      </SettingsSection>
      <section aria-labelledby="settings-about-title" className="mt-10">
        <h2
          id="settings-about-title"
          className="text-base font-medium text-foreground"
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
          Cropped, converted to black and white, and redrawn as a portrait mark.
          Swartz is an independent project; no endorsement is implied.
        </p>
      </section>
    </PageLayout>
  );
}
