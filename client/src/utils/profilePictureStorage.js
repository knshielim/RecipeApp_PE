export function getStoredProfilePicture(username) {
  if (!username) return null;
  try {
    return localStorage.getItem(`nomly_profilePicture_${username}`);
  } catch {
    return null;
  }
}

export function setStoredProfilePicture(username, profilePicture) {
  if (!username) return;
  try {
    const key = `nomly_profilePicture_${username}`;
    if (profilePicture) localStorage.setItem(key, profilePicture);
    else localStorage.removeItem(key);
  } catch (error) {
    // Fallback: if localStorage fails (quota exceeded, private mode, etc.),
    // the profile picture will still display using the default avatar.
    // This is acceptable for demo purposes. In production, you would want
    // to show a user-friendly error message or implement server-side storage.
    console.warn('Failed to store profile picture locally:', error.message);
  }
}
