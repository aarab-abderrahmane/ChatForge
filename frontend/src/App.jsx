import { useEffect, useState, useRef, useContext } from "react";
import "./index.css";

import { Terminal } from "./components/features/Terminal";

import { chatsContext } from "./context/chatsContext";

import { MultiStepLoader as Loader } from "./components/ui/multi-step-loader";

import { api } from "./services/api";






function App() {

  const loadingStates = [
    { text: "Initializing ChatForge AI..." },
    { text: "Warming up neural networks..." },
    { text: "Scanning your query..." },
    { text: "Generating insights..." },
    { text: "Synthesizing answers..." },
    { text: "Polishing responses..." },
    { text: "Almost ready..." },
    { text: "ChatForge AI is online!" },
  ];

  const [showCmdMenu, setShowCmdMenu] = useState(false);

  const [query, setQuery] = useState("");


  const { chats, setChats, loading, setLoading,preferences } = useContext(chatsContext);

  const messagesEndRef = useRef(null);

  const [isCopied, setIsCopied] = useState({ idMes: 0, state: false });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  let historySummary = chats
    .filter((c) => c.type === "ch")
    .slice(-50) // last 10 messages
    .map((obj) => `question: ${obj.question}, your answer: ${obj.answer}`)
    .join("\n");

  async function askAI(query, id) {
    setLoading(true);

    const userId = preferences.userId
    console.log(userId)
    const data = await api.chat(query,historySummary,userId);

    setLoading(false);
    setChats((prev) =>
      prev.map((obj) =>
        obj.id === id
          ? {
              ...obj,
              type: data.type === "res" ? "ch" : "error",
              answer: data.response,
            }
          : obj
      )
    );
  }

  const handleSend = (e) => {
    const newId = new Date();
    const query = e.target.value.trim();

    setChats((prev) => [...prev, { id: newId, question: query }]);

    query.trim().length > 0 && askAI(query, newId);
  };

  const copyToClipboard = async (idMes) => {
    const targetMes = chats.find((ch) => ch.type === "ch" && ch.id === idMes);
    console.log(targetMes.answer);
    if (typeof window === "undefined" || !navigator.clipboard.writeText) {
      console.error(new Error("Clipboard API not available"));

      return;
    }

    try {
      await navigator.clipboard.writeText(targetMes.answer);
      setIsCopied({ idMes: idMes, state: true });
      setTimeout(
        () => setIsCopied((prev) => ({ ...prev, state: false })),
        2000
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <div className="bg-black scan-lines min-h-screen flex justify-center items-center w-screen ">
        {/* <Loader
          loadingStates={loadingStates}
          loading={stepLoader}
          setStepLoader={setStepLoader}
          duration={1200}
        /> */}
        <Terminal
          copyToClipboard={copyToClipboard}
          isCopied={isCopied}
          chats={chats}
          handleSend={handleSend}
          loading={loading}
          query={query}
          setQuery={setQuery}
          messagesEndRef={messagesEndRef}
          setShowCmdMenu={setShowCmdMenu}
          showCmdMenu={showCmdMenu}
        ></Terminal>
      </div>
    </>
  );
}

export default App;
