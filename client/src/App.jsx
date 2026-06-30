import { useState } from "react";
 
const API = "http://localhost:5237"; // match the backend
 
function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! Ask me about SWE310." }
  ]);
  const [input, setInput] = useState("");
 
  async function send() {
    if (!input.trim()) return;
    const next = [...messages, { role: "user", text: input }];
    setMessages(next);
    setInput("");
    const res = await fetch(API + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next })
    });
    const data = await res.json();
    setMessages([...next, { role: "assistant", text: data.reply }]);
  }
 
  return (
    <div className="min-h-screen bg-slate-100 flex justify-center p-4">
      <div className="w-full max-w-xl flex flex-col bg-white rounded-2xl shadow">
        <h1 className="bg-[#203966] text-white font-bold text-lg rounded-t-2xl px-4 py-3">
          AI Study Assistant
        </h1>
        <div className="flex-1 p-4 space-y-2 overflow-y-auto h-96">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block px-3 py-2 rounded-2xl ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 p-3 border-t">
          <input
            value={input}
            className="flex-1 border rounded-xl px-3 py-2"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button onClick={send} className="bg-[#203966] text-white px-4 rounded-xl">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
 
export default App;
