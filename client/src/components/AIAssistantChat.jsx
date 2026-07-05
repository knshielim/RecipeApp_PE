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
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="section-title text-2xl">Recipe AI Assistant</h1>
        <p className="text-slate-500 text-sm mt-1">Get personalized meal suggestions and planning help.</p>
      </div>

      <PreferencesForm />

      <div className="soft-card flex flex-col overflow-hidden">
        <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[420px] min-h-[320px]">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block px-4 py-2.5 rounded-2xl max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-brand text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))}

          {loading && (
            <div className="text-left">
              <span className="inline-block px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-500 italic text-sm">
                Thinking...
              </span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="flex gap-2 px-4 pt-3 flex-wrap border-t border-slate-100">
          {[
            { label: "🍽️ Suggest a meal", path: "/api/ai/suggest-meal", text: "Suggest a meal for me" },
            { label: "📋 Summarize recipes", path: "/api/ai/summarize-recipes", text: "Summarize my recipes" },
            { label: "📅 Weekly plan", path: "/api/ai/weekly-plan", text: "Generate my weekly meal plan" },
            { label: "🍳 What can I make?", path: "/api/ai/what-can-i-make", text: "What can I make with my pantry?" },
          ].map((action) => (
            <button
              key={action.path}
              onClick={() => callQuickAction(action.path, action.text)}
              disabled={loading}
              className="text-xs bg-brand-light text-brand hover:bg-brand/10 px-3 py-1.5 rounded-full disabled:opacity-50 font-medium transition-colors"
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={() => setShowMealCheck((prev) => !prev)}
            disabled={loading}
            className="text-xs bg-brand-light text-brand hover:bg-brand/10 px-3 py-1.5 rounded-full disabled:opacity-50 font-medium transition-colors"
          >
            🥘 Check ingredients
          </button>
        </div>

        {showMealCheck && (
          <div className="flex gap-2 px-4 pb-2">
            <input
              value={mealCheckInput}
              onChange={(e) => setMealCheckInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkMealIngredients()}
              placeholder="e.g. spaghetti carbonara"
              className="input-soft flex-1 text-sm"
              autoFocus
            />
            <button
              onClick={checkMealIngredients}
              disabled={!mealCheckInput.trim() || loading}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Check
            </button>
          </div>
        )}

        <div className="flex gap-2 p-4 border-t border-slate-100">
          <input
            value={input}
            className="input-soft flex-1 text-sm"
            placeholder="Ask about your recipes or meal plan..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
