import { useEffect, useState, useRef, useContext } from "react";
import "./index.css";

import {
  Terminal,
  TypingAnimation,
  AnimatedSpan,
} from "./components/ui/shadcn-io/terminal";

import { chatsContext } from "./chatsContext";

import { MultiStepLoader as Loader } from "./components/ui/multi-step-loader";





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

  const [stepLoader,setStepLoader] = useState(true)

  const { chats, setChats, loading, setLoading } = useContext(chatsContext);

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
    const response = await fetch("http://localhost:5000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: query, history: historySummary }),
    });
    const data = await response.json();
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
        <Loader
          loadingStates={loadingStates}
          loading={stepLoader}
          setStepLoader={setStepLoader}
          duration={1200}
        />
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
