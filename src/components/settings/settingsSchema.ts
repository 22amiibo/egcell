export const SETTINGS_CATEGORIES = [
  { id: "appearance", label: "Appearance", description: "Theme, type, and visual emphasis." },
  { id: "grid", label: "Grid", description: "Spreadsheet density and chrome." },
  { id: "gameplay", label: "Gameplay", description: "Start, restart, and skip behavior." },
  { id: "scoring", label: "Scoring", description: "Input rules and run penalties." },
  { id: "help", label: "Help", description: "Revealing the fastest path, and what it costs." },
  { id: "feedback", label: "Feedback", description: "Live run signals and action response." },
  { id: "sound", label: "Sound", description: "Optional event audio. Silent by default." },
  { id: "accessibility", label: "Accessibility", description: "Motion, contrast, and target size." },
  { id: "privacy", label: "Privacy", description: "Local competition preferences." },
] as const;

export type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number]["id"];
