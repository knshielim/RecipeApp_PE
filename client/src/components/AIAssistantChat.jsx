import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import PreferencesForm from "./PreferencesForm";
import RecipePicker from "./RecipePicker";
import { currentWeekStart, addWeeks, formatWeekLabel, formatWeekStart, parseWeekStart } from "../utils/weekUtils";
import { API_BASE, getApiErrorMessage, formatFetchError } from "../utils/apiError";

const API = API_BASE;
const USER_ID = 1; // TODO: replace with the real authenticated user id

async function postJson(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 503) {
      throw new Error("The AI service is temporarily unavailable. Please try again in a moment.");
    }

    if (res.status === 429) {
      throw new Error("The AI service is busy right now. Please wait a moment and try again.");
    }

    throw new Error(getApiErrorMessage(data, `Request failed (${res.status})`));
  }

  return data;
}

async function askAssistant(message) {
  const data = await postJson("/api/ai/assistant", { message });
  return data.reply;
}

// Compact element styling so markdown (bold day headers, bullet lists from
// the weekly plan / ingredient checks) fits the chat bubble instead of
// pulling in default browser/prose spacing sized for a full page.
const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }) => (
    <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-xs">{children}</code>
  ),
};

export default function AIAssistantChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Hi! Ask me to suggest a meal, summarize your recipes, plan your week, check what you can make with your pantry, or come up with something brand new.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showCravingInput, setShowCravingInput] = useState(false);
  const [cravingInput, setCravingInput] = useState("");
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [showWeekSelector, setShowWeekSelector] = useState(null);
  const chatEndRef = useRef(null);

  const weekOptions = [
    { offset: 0, label: "This week" },
    { offset: 1, label: "Next week" },
    { offset: 2, label: "Week after next" },
    { offset: 3, label: "3 weeks from now" },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function pushUser(text) {
    setMessages((prev) => [...prev, { role: "user", text }]);
  }

  function pushAssistant(msg) {
    setMessages((prev) => [...prev, { role: "assistant", ...msg }]);
  }

  function pushError(err) {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: `Sorry, something went wrong: ${formatFetchError(err)}` },
    ]);
  }

  async function send() {
    if (!input.trim() || loading) return;

    const text = input;
    pushUser(text);
    setInput("");
    setLoading(true);

    try {
      const reply = await askAssistant(text);
      pushAssistant({ text: reply });
    } catch (err) {
      pushError(err);
    } finally {
      setLoading(false);
    }
  }

  // Simple quick actions that just return { reply } and don't need any
  // follow-up UI (suggest a meal, summarize recipes, what can I make).
  async function callQuickAction(path, label) {
    if (loading) return;

    pushUser(label);
    setLoading(true);
    try {
      const data = await postJson(path);
      const reply = data.reply?.trim();
      if (!reply) throw new Error("The assistant returned an empty response. Please try again.");
      pushAssistant({ text: reply });
    } catch (err) {
      pushError(err);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Weekly plan: generate a preview, then save/regenerate ----------

  async function generateWeeklyPlan() {
    if (loading) return;

    pushUser("Generate my weekly meal plan");
    setLoading(true);
    try {
      const data = await postJson("/api/ai/weekly-plan");
      const reply = data.reply?.trim();
      if (!reply) throw new Error("The assistant returned an empty response. Please try again.");
      pushAssistant({ text: reply, plan: data.plan ?? null });
    } catch (err) {
      pushError(err);
    } finally {
      setLoading(false);
    }
  }

  async function savePlan(plan, index) {
    setLoading(true);
    try {
      const weekStart = formatWeekStart(addWeeks(parseWeekStart(currentWeekStart()), selectedWeekOffset));
      const res = await fetch(`${API}/api/mealplans/${USER_ID}/apply-plan?weekStart=${weekStart}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to save plan."));
      }
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, saved: true } : m)));
      const weekLabel = formatWeekLabel(addWeeks(parseWeekStart(currentWeekStart()), selectedWeekOffset));
      pushAssistant({ text: `Saved! Your meal planner page now has the plan for ${weekLabel}. ✅` });
      setShowWeekSelector(null);
    } catch (err) {
      pushError(err);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Do I have enough for a meal? (pick from saved recipes) ----------

  async function checkMealIngredients(recipe) {
    setShowMealPicker(false);
    pushUser(`Do I have enough to make ${recipe.title}?`);
    setLoading(true);
    try {
      const data = await postJson("/api/ai/missing-ingredients", { recipeId: recipe.id });
      const reply = data.reply?.trim();
      if (!reply) throw new Error("The assistant returned an empty response. Please try again.");
      pushAssistant({ text: reply });
    } catch (err) {
      pushError(err);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Generate a brand-new recipe (the one non-existing-recipes shortcut) ----------

  async function generateNewRecipe() {
    const craving = cravingInput.trim();
    setShowCravingInput(false);
    setCravingInput("");
    pushUser(craving ? `Come up with a new recipe using ${craving}` : "Surprise me with a new recipe");
    setLoading(true);
    try {
      const data = await postJson("/api/ai/generate-recipe", { craving: craving || null });
      const reply = data.reply?.trim();
      if (!reply) throw new Error("The assistant returned an empty response. Please try again.");
      pushAssistant({ text: reply, recipe: data.recipe ?? null });
    } catch (err) {
      pushError(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveGeneratedRecipe(recipe, index) {
    setLoading(true);
    try {
      await postJson("/api/recipe", {
        title: recipe.title,
        ingredients: recipe.ingredients,
        steps: recipe.instructions || "",
        category: recipe.category,
        imageUrl: recipe.imageUrl || "",
        ownerName: "AI-Generated",
        dietRestriction: recipe.dietRestriction || "none",
        allergens: recipe.allergens || "",
      });
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, saved: true } : m)));
      pushAssistant({ text: `Saved "${recipe.title}" to your recipes. 📖` });
    } catch (err) {
      pushError(err);
    } finally {
      setLoading(false);
    }
  }

  const quickActions = [
    {
      label: "🍽️ Suggest a meal",
      onClick: () => callQuickAction("/api/ai/suggest-meal", "Suggest a meal for me"),
    },
    {
      label: "📋 Summarize recipes",
      onClick: () => callQuickAction("/api/ai/summarize-recipes", "Summarize my recipes"),
    },
    {
      label: "📅 Weekly plan",
      onClick: generateWeeklyPlan,
    },
    {
      label: "🍳 What can I make?",
      onClick: () => callQuickAction("/api/ai/what-can-i-make", "What can I make with my pantry?"),
    },
    {
      label: "🥘 Check ingredients",
      onClick: () => setShowMealPicker((prev) => !prev),
    },
    {
      label: "✨ New recipe",
      onClick: () => setShowCravingInput((prev) => !prev),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="section-title text-2xl">Recipe AI Assistant</h1>
        <p className="text-slate-500 text-sm mt-1">Get personalized meal suggestions and planning help.</p>
      </div>

      <PreferencesForm />

      <div className="soft-card flex flex-col overflow-hidden">
        <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[420px] min-h-[320px]">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block px-4 py-2.5 rounded-2xl max-w-[85%] text-left text-sm leading-relaxed ${m.role === "user"
                  ? "bg-brand text-white whitespace-pre-wrap"
                  : "bg-slate-100 text-slate-800"
                  }`}
              >
                {m.role === "assistant" ? (
                  <ReactMarkdown components={markdownComponents}>{m.text}</ReactMarkdown>
                ) : (
                  m.text
                )}
              </div>

              {/* Save / regenerate a previewed weekly plan */}
              {m.role === "assistant" && m.plan && (
                <div className="mt-1.5 flex gap-2 justify-start flex-wrap">
                  {!m.saved ? (
                    <>
                      {showWeekSelector === i ? (
                        <div className="flex gap-2 items-center">
                          <select
                            value={selectedWeekOffset}
                            onChange={(e) => setSelectedWeekOffset(Number(e.target.value))}
                            className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                          >
                            {weekOptions.map((opt) => (
                              <option key={opt.offset} value={opt.offset}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => savePlan(m.plan, i)}
                            disabled={loading}
                            className="text-xs bg-green-600 text-white px-3 py-1 rounded-full disabled:opacity-50"
                          >
                            ✅ Save
                          </button>
                          <button
                            onClick={() => setShowWeekSelector(null)}
                            disabled={loading}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-full disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowWeekSelector(i)}
                            disabled={loading}
                            className="text-xs bg-green-600 text-white px-3 py-1 rounded-full disabled:opacity-50"
                          >
                            ✅ Save this plan
                          </button>
                          <button
                            onClick={generateWeeklyPlan}
                            disabled={loading}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-full disabled:opacity-50"
                          >
                            🔄 Regenerate
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-green-700">Saved to your meal planner ✓</span>
                  )}
                </div>
              )}

              {/* Save a freshly generated recipe */}
              {m.role === "assistant" && m.recipe && (
                <div className="mt-2 space-y-2 max-w-[85%]">
                  {m.recipe.imageUrl && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <img
                        src={m.recipe.imageUrl}
                        alt={m.recipe.title}
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  )}
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600 space-y-1">
                    <p><span className="font-semibold text-slate-800">Category:</span> {m.recipe.category}</p>
                    <p><span className="font-semibold text-slate-800">Owner:</span> AI-Generated</p>
                    <p><span className="font-semibold text-slate-800">Cooking instructions:</span> {m.recipe.instructions}</p>
                  </div>
                  <div className="flex gap-2 justify-start">
                    {!m.saved ? (
                      <button
                        onClick={() => saveGeneratedRecipe(m.recipe, i)}
                        disabled={loading}
                        className="text-xs bg-green-600 text-white px-3 py-1 rounded-full disabled:opacity-50"
                      >
                        💾 Save this recipe
                      </button>
                    ) : (
                      <span className="text-xs text-green-700">Saved to your recipes ✓</span>
                    )}
                  </div>
                </div>
              )}
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
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={loading}
              className="text-xs bg-brand-light text-brand hover:bg-brand/10 px-3 py-1.5 rounded-full disabled:opacity-50 font-medium transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>

        {showMealPicker && (
          <div className="px-4 pb-3 pt-1">
            <RecipePicker
              userId={USER_ID}
              onSelect={checkMealIngredients}
              onClose={() => setShowMealPicker(false)}
            />
          </div>
        )}

        {showCravingInput && (
          <div className="flex gap-2 px-4 pb-3 pt-1">
            <input
              value={cravingInput}
              onChange={(e) => setCravingInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generateNewRecipe()}
              placeholder="Any craving? (optional, e.g. chicken and rice)"
              className="input-soft flex-1 text-sm"
              autoFocus
            />
            <button
              onClick={generateNewRecipe}
              disabled={loading}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Generate
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