import {
  Bell,
  Cpu,
  Database,
  Info,
  Palette,
  Settings,
  Settings2,
  UserRound,
} from "@/components/ui/icons";

const modelSection = {
  id: "model",
  label: "Models",
  description: "Connect the model that guides your learning.",
  icon: Cpu,
  plannedSettings: [],
};

export const settingsSections = [
  {
    id: "general",
    label: "General",
    description: "Set up the app for everyday use.",
    icon: Settings,
    plannedSettings: ["Language", "Time zone", "Startup and window behavior"],
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Choose how Swartz looks and feels.",
    icon: Palette,
    plannedSettings: ["Theme", "Font and text size", "Interface density"],
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Choose how your tutor works with you.",
    icon: Settings2,
    plannedSettings: [
      "Teaching preferences",
      "Explanation detail",
      "Learning day start time",
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Choose when Swartz gets your attention.",
    icon: Bell,
    plannedSettings: [
      "Learning reminders",
      "Task completion notifications",
      "Do not disturb",
    ],
  },
  modelSection,
  {
    id: "data-controls",
    label: "Data controls",
    description: "Manage your learning data and local storage.",
    icon: Database,
    plannedSettings: [
      "Import and export",
      "Data sync",
      "Local cache",
      "Data deletion",
    ],
  },
  {
    id: "account",
    label: "Account",
    description: "Manage your profile and account access.",
    icon: UserRound,
    plannedSettings: ["Profile", "Sign-in methods", "Devices", "Sign out"],
  },
  {
    id: "about",
    label: "About",
    description: "A place to learn through conversation.",
    icon: Info,
    plannedSettings: [],
  },
];

export function getSettingsSection(id: string | null) {
  // Existing model setup links point to /settings without a section.
  return settingsSections.find((section) => section.id === id) ?? modelSection;
}
