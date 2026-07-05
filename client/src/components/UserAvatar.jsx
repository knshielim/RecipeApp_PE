import { useUserProfile } from "../context/UserProfileContext";

const SIZES = {
  xs: "w-7 h-7 text-xs",
  sm: "w-9 h-9 text-sm",
  md: "w-10 h-10 text-sm",
  lg: "w-20 h-20 text-2xl",
  xl: "w-28 h-28 text-3xl",
};

export default function UserAvatar({ size = "sm", className = "", name }) {
  const { profile, displayName } = useUserProfile();
  const label = name || displayName;
  const initials = (label || "U").charAt(0).toUpperCase();
  const sizeClass = SIZES[size] || SIZES.sm;

  if (profile.profilePicture) {
    return (
      <img
        src={profile.profilePicture}
        alt={`${label}'s profile`}
        className={`${sizeClass} rounded-full object-cover shrink-0 border-2 border-white shadow-sm ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} rounded-full bg-brand-light text-brand font-bold inline-flex items-center justify-center shrink-0 border-2 border-white shadow-sm ${className}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
