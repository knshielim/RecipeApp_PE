import { BrowserRouter, Routes, Route } from "react-router-dom";
import AIAssistantChat from "./components/AIAssistantChat";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/assistant" element={<AIAssistantChat />} />
        {/* teammates add their own routes here, e.g. /recipes, /meal-plan, /dashboard */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;