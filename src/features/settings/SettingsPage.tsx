import { useSearchParams } from "react-router";
import { PageLayout, PageHeading } from "@/components/ui/page-layout";
import { SettingsSection } from "@/components/ui/settings-layout";
import { ModelSettingsForm } from "@/features/model/ModelSettingsForm";
import type { ModelConfig, ModelSettings } from "@/features/model/model-api";
import { getSettingsSection } from "./settings-sections";

export function SettingsPage({
  settings,
  loadError,
  onSave,
}: {
  settings: ModelSettings;
  loadError: string;
  onSave: (input: ModelConfig) => Promise<void>;
}) {
  const [params] = useSearchParams();
  const section = getSettingsSection(params.get("section"));

  return (
    <PageLayout label={`${section.label} settings`} className="settings-page">
      {/* Keep the form mounted so switching sections preserves unsaved input. */}
      <div hidden={section.id !== "model"} className="max-w-[720px]">
        <PageHeading
          title="Models"
          description="Connect the model that guides your learning."
        />
        <ModelSettingsForm
          settings={settings}
          loadError={loadError}
          onSave={onSave}
        />
      </div>
      {section.plannedSettings.length > 0 && (
        <div className="max-w-[720px]">
          <PageHeading
            title={section.label}
            description={section.description}
          />
          <SettingsSection
            title="Not available yet"
            description="These settings have not been implemented yet."
          >
            <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
              {section.plannedSettings.map((setting) => (
                <li key={setting}>{setting}</li>
              ))}
            </ul>
          </SettingsSection>
        </div>
      )}
      <div hidden={section.id !== "about"} className="max-w-[720px]">
        <PageHeading
          title="About Swartz"
          description="A place to learn through conversation."
        />
        <SettingsSection title="Logo attribution">
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
        </SettingsSection>
      </div>
    </PageLayout>
  );
}
