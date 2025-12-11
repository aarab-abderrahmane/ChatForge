import { useEffect, useState, useRef, useContext } from "react";
import "./index.css";

import { Terminal } from "./components/features/Terminal";

import { chatsContext } from "./context/chatsContext";

import { MultiStepLoader as Loader } from "./components/ui/multi-step-loader";

import { api } from "./services/api";



import {SideBar} from './components/Sidebar'
import {StatusBar} from './components/StatusBar'
// import { input } from "motion/react-client";



function App() {

  const generateId = ()=>Math.random().toString(36).substring(2,15)

  const MessageRole = {
    USER : 'user',
    MODEL : 'model',
    SYSTEM : 'system'
  }

  const [input, setInput] = useState('');

  const [terminalState, setTerminalState] = useState({
    isConnected: true,
    latency: 24,
    activeProtocol: 'TCP/NEURAL',
    securityLevel: 'CLASS-4'
  });


  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState([
        {
      id: 'init-1',
      role: MessageRole.SYSTEM,
      content: 'ChatForge v2.0.0 initializing...\n> Establishing secure uplink...\n> Uplink verified.\n> Neural interface active.\n\nWelcome, User. I am ChatForge. How may I assist you today?',
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
    // setLoading(true);

    // const userId = preferences.userId
    // console.log(userId)
    
    const data = await api.chat(query,"","7f1a16bc-2b12-43be-993f-2063f2aec2dd");

    setLoading(false);
    setMessages((prev) =>
      prev.map((obj) =>
        obj.id === id
          ? {
              ...obj,
              content: data.response,
            }
          : obj
      )
    );
  }

  const handleSendMessage = async (e) => {
    if(e) e.preventDefault()
    if(!input.trim() || isLoading)  return

    const userMessage = {
      id : generateId(),
      role : MessageRole.USER , 
      content : input.trim(),
      timestamp : new Date()
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput('')
    setIsLoading(true);


    // query.trim().length > 0 && 
    const modelMessageId = generateId();
    const modelMessage = {
      id : modelMessageId , 
      rolel : MessageRole.MODEL,
      content : '',
      timestamp : new Date(),
      isStreaming : true  
    }

    setMessages(prev=> [...prev,modelMessage])
    await askAI(input.trim() , modelMessageId);
    setIsLoading(false)
   
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

                    {/* messages area  */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
                          
                          {
                            messages.map((msg)=> (
                                <div
                                  key = {msg.id}
                                  className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : "items-start"}`}
                                >

                                      {/* message  metadata */}
                                      <div
                                      className="flex items-center gap-2 mb-1 text-[10px] uppercase opacity-70"
                                      >
                                         <span>{msg.role === MessageRole.USER ? '>> USER' : '>> CHATFORGE'}</span>
                                         <span className="text-emerald-800">::</span>
                                         <span>{msg.timestamp.toLocaleTimeString([],{hour12:false , hour: "2-digit",minute:"2-digit"})}</span>
                                      </div>


                                      {/* block  */}
                                      <div
                                          className={`
                                            relative max-w-[90%] md:max-w-[80%] p-4 rounded-sm border
                                            ${msg.role === MessageRole.USER 
                                                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-100 rounded-br-none' 
                                                : 'bg-transparent border-emerald-900/50 text-emerald-400 border-l-4 border-l-emerald-500 rounded-bl-none shadow-[0_0_15px_-5px_rgba(16,185,129,0.1)]'}
                                          `}>
                                            <div>
                                              {msg.content}
                                              </div>
                                      </div>
                                    
                                </div>

                            ))
                          }

                    </div>
                    {/* input area  */}
                    <div className="p-4 bg-black/40 border-t border-green-300 backdrop-blur-sm  shrink-0">
                        <form 
                        onSubmit={handleSendMessage}
                        className="relative flex items-center gap-3 max-w-5xl mx-auto">

                          <span className="text-green-300 font-bold text-lg select-none glow-text">{'>'}</span>
                          <input
                          // ref={}
                          type="text"
                          value={input}
                          onChange={(e)=>setInput(e.target.value)}
                          placeholder={isLoading? "PROCESSING..." : "ENTER COMMAND..."}
                          disabled={isLoading}
                          className="flex-1 bg-transparent border-none outline-none text-green-300 placeholder-green-300 font-mono text-base md:text-lg h-12 caret-green-300"
                          autoComplete="off"
                          >
                          </input>
                          <button
                            type="submit"
                            // disabled
                            className={`
                                px-6 py-2 rounded-sm font-bold tracking-wider text-xs transition-all duration-200
                                border
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
