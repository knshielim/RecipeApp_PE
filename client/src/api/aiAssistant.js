const API = "http://localhost:5237";

export async function askAssistant(message) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}/api/ai/assistant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Assistant request failed");
  const data = await res.json();
  return data.reply;
}
