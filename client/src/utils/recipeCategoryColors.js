
export const CATEGORY_COLOR_PRESETS = {
  amber: "from-amber-100 to-orange-200",
  green: "from-green-100 to-emerald-200",
  lime: "from-lime-100 to-green-200",
  yellow: "from-yellow-100 to-amber-200",
  pink: "from-pink-100 to-rose-200",
  red: "from-red-100 to-orange-200",
  stone: "from-stone-100 to-amber-200",
  blue: "from-blue-100 to-sky-200",
  purple: "from-purple-100 to-violet-200",
  teal: "from-teal-100 to-cyan-200",
};

export const DEFAULT_CATEGORY_COLOR_KEY = "amber";

export function getCategoryGradient(colorKey) {
  return CATEGORY_COLOR_PRESETS[colorKey] || CATEGORY_COLOR_PRESETS[DEFAULT_CATEGORY_COLOR_KEY];
}

// Friendly labels for the admin color picker dropdown.
export const CATEGORY_COLOR_OPTIONS = [
  { key: "amber", label: "Amber → Orange" },
  { key: "green", label: "Green → Emerald" },
  { key: "lime", label: "Lime → Green" },
  { key: "yellow", label: "Yellow → Amber" },
  { key: "pink", label: "Pink → Rose" },
  { key: "red", label: "Red → Orange" },
  { key: "stone", label: "Stone → Amber" },
  { key: "blue", label: "Blue → Sky" },
  { key: "purple", label: "Purple → Violet" },
  { key: "teal", label: "Teal → Cyan" },
];
