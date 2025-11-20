import { createContext , useState,useEffect } from "react";


export const chatsContext = createContext()

export function ChatsProvider({children}){

    const [loading, setLoading] = useState(false)
    
    const [chats, setChats] = useState([
        {type:"ms",content:[
        "👋 Welcome to ChatForge! Here’s how you can get started" ,
        "💡 Try asking questions like these to see the AI in action",
    
        ]},
    
        { 
          type:"ch",
          id:1,
          question: "Who is the author of this website?",
          answer: "Abderrahmane Aarab"
        },
        {
          id:2,
          type:"ch",
          question: "How can I generate a short summary of my chat history?",
          answer: "Simply type your question and the AI will summarize the previous messages."
        },
        {
          id:3,
          type:"ch",
          question: "Can I ask multiple questions at once?",
          answer: "Yes, but it’s best to ask one question at a time for precise answers."
        },
    
      ])


        const defaultPreferences = {
          isVisited : false
        }
      
        const [preferences, setPreferences] = useState(()=>{
      
              const latestPreferences = localStorage.getItem('Preferences')
              return latestPreferences && latestPreferences!==null && latestPreferences!== undefined 
              ? JSON.parse(latestPreferences)
              : defaultPreferences
      
        }
      
        )
      
        useEffect(()=>{
      
              localStorage.setItem('Preferences',JSON.stringify(preferences))
      
        },[preferences])
      

    return (
        <chatsContext.Provider value={{chats,setChats,loading,setLoading,preferences,setPreferences}} >
            {children}
        </chatsContext.Provider>
    )


}