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
  } catch {
    // ignore quota / private mode errors
  }
}
