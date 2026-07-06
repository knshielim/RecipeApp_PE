export const API_BASE = "http://localhost:5237";

export function formatFetchError(err) {
  const message = err?.message || "";
  if (message === "Failed to fetch" || err instanceof TypeError) {
    return "Cannot reach the server. Start the backend with `dotnet run` in the Server folder, then try again.";
  }
  return message || "Something went wrong. Please try again.";
}
