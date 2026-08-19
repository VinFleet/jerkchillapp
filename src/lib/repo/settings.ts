import type { AppSettings } from "@/lib/types";
import { readValue, writeValue } from "@/lib/storage";

const SETTINGS_KEY = "app_settings";

const DEFAULT_SETTINGS: AppSettings = {
  managerSeesCostMargin: false,
};

export function getSettings(): AppSettings {
  return readValue<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function updateSettings(patch: Partial<AppSettings>) {
  writeValue(SETTINGS_KEY, { ...getSettings(), ...patch });
}
