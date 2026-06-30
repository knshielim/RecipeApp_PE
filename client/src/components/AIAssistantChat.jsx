import { useState } from "react";

// Change this if your backend runs on a different port
const API = "http://localhost:5237";

async function askAssistant(message) {
  const res = await fetch(`${API}/api/ai/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Assistant request failed");
  }
  const data = await res.json();
  return data.reply;
}

export default function AIAssistantChat() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! Ask me to suggest a meal, summarize your recipes, or plan your week." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", text: input };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const reply = await askAssistant(userMsg.text);
      setMessages([...next, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages([...next, { role: "assistant", text: `Sorry, something went wrong: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function callQuickAction(path, label) {
    setMessages((prev) => [...prev, { role: "user", text: label }]);
    setLoading(true);
    try {
        const res = await fetch(`${API}${path}`, { method: "POST" });
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch (err) {
        setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${err.message}` }]);
    } finally {
        setLoading(false);
    }
    }

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center p-4">
      <div className="w-full max-w-xl flex flex-col bg-white rounded-2xl shadow">
        <h1 className="bg-[#203966] text-white font-bold text-lg rounded-t-2xl px-4 py-3">
          Recipe AI Assistant
        </h1>

        <div className="flex-1 p-4 space-y-2 overflow-y-auto h-96">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block px-3 py-2 rounded-2xl max-w-[80%] whitespace-pre-wrap ${
                  m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))}
          {loading && (
            <div className="text-left">
              <span className="inline-block px-3 py-2 rounded-2xl bg-slate-100 text-slate-500 italic">
                Thinking...
              </span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 px-3 pt-2">
            <button
                onClick={() => callQuickAction("/api/ai/suggest-meal", "Suggest a meal for me")}
                className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full"
            >
                🍽️ Suggest a meal
            </button>
            <button
                onClick={() => callQuickAction("/api/ai/summarize-recipes", "Summarize my recipes")}
                className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full"
            >
                📋 Summarize my recipes
            </button>
        </div>

        <div className="flex gap-2 p-3 border-t">
          <input
            value={input}
            className="flex-1 border rounded-xl px-3 py-2"
            placeholder="Ask about your recipes or meal plan..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading}
            className="bg-[#203966] text-white px-4 rounded-xl disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

