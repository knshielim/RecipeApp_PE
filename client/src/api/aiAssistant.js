import { API_BASE, getApiErrorMessage } from "../utils/apiError";

const API = API_BASE;

export async function askAssistant(message) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/api/ai/assistant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("The AI service is busy right now. Please wait a moment and try again.");
    }

    if (res.status === 503) {
      throw new Error("The AI service is temporarily unavailable. Please try again in a moment.");
    }

    throw new Error(getApiErrorMessage(data, "Assistant request failed."));
  }

  return data?.reply || "";
}