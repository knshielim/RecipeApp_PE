import { useState, useRef, useEffect } from "react";
import PreferencesForm from "./PreferencesForm";

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
    { role: "assistant", text: "Hi! Ask me to suggest a meal, summarize your recipes, plan your week, or check what you can make with your pantry." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMealCheck, setShowMealCheck] = useState(false);
  const [mealCheckInput, setMealCheckInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
    if (loading) return;

    setMessages((prev) => [...prev, { role: "user", text: label }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}${path}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || `Request failed (${res.status})`);
      }
      const reply = data.reply?.trim();
      if (!reply) {
        throw new Error("The assistant returned an empty response. Please try again.");
      }
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Sorry, something went wrong: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function checkMealIngredients() {
    const meal = mealCheckInput.trim();
    if (!meal || loading) return;

    setShowMealCheck(false);
    setMealCheckInput("");
    setMessages((prev) => [...prev, { role: "user", text: `Do I have enough to make ${meal}?` }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/ai/missing-ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || `Request failed (${res.status})`);
      }
      const reply = data.reply?.trim();
      if (!reply) {
        throw new Error("The assistant returned an empty response. Please try again.");
      }
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Sorry, something went wrong: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4">
      {/* Preferences Form */}
      <PreferencesForm />

      {/* Chat Card */}
      <div className="w-full max-w-xl flex flex-col bg-white rounded-2xl shadow mt-4">
        <h1 className="bg-[#203966] text-white font-bold text-lg rounded-t-2xl px-4 py-3">
          Recipe AI Assistant
        </h1>

        <div className="flex-1 p-4 space-y-2 overflow-y-auto h-96">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block px-3 py-2 rounded-2xl max-w-[80%] whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-800"
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
          <div ref={chatEndRef} />
        </div>

        <div className="flex gap-2 px-3 pt-2 flex-wrap">
          <button
            onClick={() =>
              callQuickAction("/api/ai/suggest-meal", "Suggest a meal for me")
            }
            disabled={loading}
            className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full disabled:opacity-50"
          >
            🍽️ Suggest a meal
          </button>

          <button
            onClick={() =>
              callQuickAction("/api/ai/summarize-recipes", "Summarize my recipes")
            }
            disabled={loading}
            className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full disabled:opacity-50"
          >
            📋 Summarize my recipes
          </button>

          <button
            onClick={() =>
              callQuickAction("/api/ai/weekly-plan", "Generate my weekly meal plan")
            }
            disabled={loading}
            className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full disabled:opacity-50"
          >
            📅 Generate weekly plan
          </button>

          <button
            onClick={() =>
              callQuickAction("/api/ai/what-can-i-make", "What can I make with my pantry?")
            }
            disabled={loading}
            className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full disabled:opacity-50"
          >
            🍳 What can I make?
          </button>

          <button
            onClick={() => setShowMealCheck((prev) => !prev)}
            disabled={loading}
            className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full disabled:opacity-50"
          >
            🥘 Do I have enough for a meal?
          </button>
        </div>

        {showMealCheck && (
          <div className="flex gap-2 px-3 pb-2">
            <input
              value={mealCheckInput}
              onChange={(e) => setMealCheckInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkMealIngredients()}
              placeholder="e.g. spaghetti carbonara"
              className="flex-1 border rounded-xl px-3 py-2 text-sm"
              autoFocus
            />
            <button
              onClick={checkMealIngredients}
              disabled={!mealCheckInput.trim() || loading}
              className="bg-[#203966] text-white px-4 rounded-xl disabled:opacity-50 text-sm"
            >
              Check
            </button>
          </div>
        )}

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
