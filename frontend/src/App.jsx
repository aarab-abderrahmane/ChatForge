import { useEffect ,useState,useRef} from "react"
import './index.css'

import {
  Terminal,
  TypingAnimation,
  AnimatedSpan,
} from './components/ui/shadcn-io/terminal';


function App() {

  const [query , setQuery] = useState("")


  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null);
  const [chats, setChats] = useState([
    {type:"ms",content:[
    "👋 Welcome to ChatForge! Here’s how you can get started" ,
    "💡 Try asking questions like these to see the AI in action",

    ]},

    { 
      type:"ch",
      question: "Who is the author of this website?",
      answer: "Abderrahmane Aarab"
    },
    {
      type:"ch",
      question: "How can I generate a short summary of my chat history?",
      answer: "Simply type your question and the AI will summarize the previous messages."
    },
    {
      type:"ch",
      question: "Can I ask multiple questions at once?",
      answer: "Yes, but it’s best to ask one question at a time for precise answers."
    },

  ])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);  


  let historySummary = chats
  .filter(c => c.type === "ch")
  .slice(-50)  // last 10 messages
  .map(obj => `question: ${obj.question}, your answer: ${obj.answer}`)
  .join('\n');

  console.log(historySummary)


  async function askAI(query,id){
      setLoading(true)
      const response = await fetch('http://localhost:5000/api/chat',{

          method:"POST",
          headers : {
            "Content-Type" : "application/json"
          },
          body: JSON.stringify({question:query,history:historySummary})
      })
      const data = await response.json();
      setLoading(false)
      setChats(prev=>prev.map(obj=> obj.id===id ? {...obj,type:data.type==="res" ? "ch" : "error",answer:data.response} : obj ))

  }


  const handleSend = (e)=>{

        const newId = new Date()
        const query = e.target.value.trim() 

        setChats(prev=>[...prev,{id:newId,question:query}])


        query.trim().length> 0 && askAI(query , newId)

  }




  return (
    <>

      <div className="bg-black scan-lines min-h-screen flex justify-center items-center w-screen ">
      <Terminal chats={chats} handleSend={handleSend} loading={loading} query={query} setQuery={setQuery} messagesEndRef={messagesEndRef} >
          {/* <AnimatedSpan delay={0}>$ npm install shadcn-ui</AnimatedSpan>
          <TypingAnimation delay={1000} duration={100}>
            Installing dependencies...
          </TypingAnimation>
          <AnimatedSpan delay={3000}>✓ Package installed successfully</AnimatedSpan>
          <AnimatedSpan delay={3500}>$ npm run dev</AnimatedSpan>
          <TypingAnimation delay={4500} duration={80}>
            Starting development server...
          </TypingAnimation>
          <AnimatedSpan delay={6500}>🚀 Server ready at http://localhost:3000</AnimatedSpan> */}
        </Terminal>


      </div>

    </>

  )
}

export default App
