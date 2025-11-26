import { useEffect, useState, useRef, useContext } from "react";
import "./index.css";

import { Terminal } from "./components/features/Terminal";

import { chatsContext } from "./context/chatsContext";

import { MultiStepLoader as Loader } from "./components/ui/multi-step-loader";

import { api } from "./services/api";



import {SideBar} from './components/Sidebar'
import {StatusBar} from './components/StatusBar'
import { input } from "motion/react-client";



function App() {

  const MessageRole = {
    USER : 'user',
    MODEL : 'model',
    SYSTEM : 'system'
  }
  const [terminalState, setTerminalState] = useState({
    isConnected: true,
    latency: 24,
    activeProtocol: 'TCP/NEURAL',
    securityLevel: 'CLASS-4'
  });

  const [message, setMessages] = useState([
        {
      id: 'init-1',
      role: MessageRole.SYSTEM,
      content: 'NEXUS_OS v4.2.0 initializing...\n> Establishing secure uplink...\n> Uplink verified.\n> Neural interface active.\n\nWelcome, User. I am NEXUS. How may I assist you today?',
      timestamp: new Date()
    }
  ])

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    

      <div className="flex flex-col h-screen bg-black text-emerald-300 overflow-hidden relative font-['Fira_Code']">

          {/* background grid pattern  */}
            <div 
            className="absolute inset-0 pointer-event-none opacity-10"
            style={{
              backgroundImage: `linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)`,
              backgroundSize: '30px 30px'
            }}
            >

            </div>

            {/* main content  */}
            <div className="flex flex-1 overflow-hidden relative z-10 ">

                <SideBar 
                isOpen={isSidebarOpen}
                toggleSidebar={()=>setIsSidebarOpen(!isSidebarOpen)}
                
                />

                {/* terminal window  */}
                <main  className="flex-1 flex flex-col min-w-0 bg-black backdrop-blur-sm relative ">
                    
                    {/* header && mobile toggle  */}
                    <div className="h-12 border-b border-green-400 flex items-center justify-between px-4 md:px-6 shrink-0">
                        <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                              className="md:hidden text-emerald-500 hover:text-emerald-300 mr-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                              </svg>
                            </button>
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                            <span className="font-bold tracking-widest text-sm text-emerald-100/90 glow-text">TERMINAL_SESSION_01</span>
                        </div>
                        <div className="hidden sm:flex text-[10px] gap-4 text-emerald-700 font-mono">
                            <span>MEM: 245TB</span>
                            <span>ENC: AES-4096</span>
                        </div>
                    </div>

                    {/* message area  */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">

                    </div>
                    {/* input area  */}
                    <div className="p-4 bg-black/40 border-t border-green-300 backdrop-blur-sm  shrink-0">
                        <form className="relative flex items-center gap-3 max-w-5xl mx-auto">

                          <span className="text-green-300 font-bold text-lg select-none glow-text">{'>'}</span>
                          <input
                          // ref={}
                          type="text"
                          // value={input}
                          // onChange={}
                          // placeholder={}
                          // disabled
                          className="flex-1 bg-transparent border-none outline-none text-green-300 placeholder-green-300 font-mono text-base md:text-lg h-12 caret-green-300"
                          autoComplete="off"
                          >
                          </input>
                          <button
                            type="submit"
                            // disabled
                            className={`
                                px-6 py-2 rounded-sm font-bold tracking-wider text-xs transition-all duration-200
                        
                              `}
                          >
                            SEND
                          </button>
                        </form>
                    </div>

                </main>
            </div>
                
          <StatusBar state={terminalState}/>
      </div>

  );
}

export default App;
