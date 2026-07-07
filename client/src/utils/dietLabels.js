export const DIET_OPTIONS = [
  { value: "none", label: "No Restriction" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
  { value: "keto", label: "Keto" },
  { value: "gluten-free", label: "Gluten-Free" },
  { value: "dairy-free", label: "Dairy-Free" },
  { value: "nut-free", label: "Nut-Free" },
  { value: "low-carb", label: "Low-Carb" },
  { value: "paleo", label: "Paleo" },
  { value: "low-sodium", label: "Low-Sodium" },
  { value: "sugar-free", label: "Sugar-Free" },
  { value: "whole30", label: "Whole30" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "pescatarian", label: "Pescatarian" },
];

export function formatDietRestriction(value) {
  if (!value) return "";
  const match = DIET_OPTIONS.find((d) => d.value === value.toLowerCase());
  return match?.label || value;
}
