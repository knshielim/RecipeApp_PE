import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  getStoredProfilePicture,
  setStoredProfilePicture,
} from "../utils/profilePictureStorage";
import {
  API_BASE,
  parseApiResponse,
  getApiErrorMessage,
  formatFetchError,
} from "../utils/apiError";

const API = API_BASE;

const UserProfileContext = createContext(null);

export function UserProfileProvider({ token, username, children }) {
  const [profile, setProfile] = useState({
    username: username || "",
    fullName: "",
    profilePicture: null,
  });
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await parseApiResponse(res, "Failed to load profile.");

      const name = data.username || username || "";
      const localPicture = getStoredProfilePicture(name);

      setProfile({
        username: name,
        fullName: data.fullName || "",
        profilePicture: data.profilePicture || localPicture || null,
      });
    } catch {
      const localPicture = getStoredProfilePicture(username);

      setProfile((prev) => ({
        ...prev,
        username: username || prev.username,
        profilePicture: localPicture || prev.profilePicture,
      }));
    } finally {
      setLoading(false);
    }
  }, [token, username]);

  useEffect(() => {
    setLoading(true);
    refreshProfile();
  }, [refreshProfile]);

  const updateProfilePicture = useCallback(
    async (profilePicture) => {
      const name = profile.username || username || "";
      const nextPicture = profilePicture || null;

      setStoredProfilePicture(name, nextPicture);
      setProfile((prev) => ({ ...prev, profilePicture: nextPicture }));

      if (!token) {
        return {
          message: "Profile picture saved on this device.",
          profilePicture: nextPicture,
          localOnly: true,
        };
      }

      try {
        const res = await fetch(`${API}/api/auth/profile/picture`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ profilePicture: nextPicture }),
        });

        const data = await res.json().catch(() => null);

        if (res.status === 404) {
          return {
            message:
              "Profile picture saved on this device. Restart the backend server to enable server sync.",
            profilePicture: nextPicture,
            localOnly: true,
          };
        }

        if (!res.ok) {
          throw new Error(
            getApiErrorMessage(
              data,
              `Could not save profile picture (HTTP ${res.status}).`
            )
          );
        }

        const saved = data?.profilePicture || null;

        setStoredProfilePicture(name, saved);
        setProfile((prev) => ({ ...prev, profilePicture: saved }));

        return {
          ...data,
          profilePicture: saved,
        };
      } catch (error) {
        const message = formatFetchError(error);

        if (nextPicture) {
          return {
            message: message.includes("Unable to connect")
              ? "Profile picture saved on this device only (server unreachable)."
              : `${message} Picture kept on this device.`,
            profilePicture: nextPicture,
            localOnly: true,
          };
        }

        throw new Error(message);
      }
    },
    [token, username, profile.username]
  );

  const displayName = profile.fullName || profile.username || username || "User";

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        displayName,
        loading,
        refreshProfile,
        updateProfilePicture,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);

  if (!ctx) {
    throw new Error("useUserProfile must be used within UserProfileProvider");
  }

  return ctx;
}