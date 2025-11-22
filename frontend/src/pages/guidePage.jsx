import { useState ,useContext,useRef} from "react";

import { chatsContext } from '../context/chatsContext';

import TypingText from '../components/ui/shadcn-io/typing-text'

import {api} from "../services/api"


export async function KeyTest(setWelcomeMessages,key,userId,setLoading,setShowBtnConfirm) {



  try {

    const data = await api.testKey(key,userId);


    if ( data.type=== "error") {
      setWelcomeMessages(prev => [...prev,{type:"error",content:data.response} ]);
      console.log("invalid")
   
    }else{

        console.log("valid")
        setWelcomeMessages(prev => [...prev, 
          {type:"key",content:key},
          {type:"succ",content:"[✓] API Key authenticated. Full access granted."} 
        ]) 
        setShowBtnConfirm(true)
    }



  } 
  catch (err) {
    setWelcomeMessages(prev => [...prev, `Connection error__${err}`]);
  
  }finally{

    setLoading(false)

  }


}



export const GuidePage = () => {


    const [loading,setLoading] =  useState(false)
    
    const TextAreaRef = useRef(null)

    const [showBtnConfirm,setShowBtnConfirm] = useState(false)



    const[ welcomeMessages,setWelcomeMessages] = useState([
          
      { type: "mes", content: "root@chatforge-terminal:~# ./start_chatforge.sh" },
      { type: "mes", content: "[✓] Verifying ChatForge environment" },
      { type: "mes", content: "[✓] Loading AI modules..." },
      { type: "mes", content: "[!] OpenRouter API key not detected" },
      { type: "mes", content: "→ Please create your key at https://openrouter.ai" },
      { type: "mes", content: "→ Copy it here to enable full access" },
      { type: "mes", content: "System ready for authentication." },
      { type: "mes", content: "Limited access until API key is provided." }
        
  ]);

  const {setPreferences,preferences} = useContext(chatsContext)

  const handleInput = (e)=>{
     const target = e.target ; 
     target.style.height = "auto";
     target.style.height  = `${target.scrollHeight}px`
  }

  async function handlekeyDown(e){

          if(e.key === "Enter"){

              e.preventDefault()
              setLoading(true)
              const APIkey = e.target.value.trim()
              const userId = preferences.userId 
              await KeyTest(setWelcomeMessages,APIkey,userId,setLoading,setShowBtnConfirm)
          }
  }


  return (
  
    <div className="p-6 mt-6 overflow-y-scroll">
    <div >


        {welcomeMessages.map(obj=><pre  
        className={`text-wrap my-2
         ${obj.type==="error" ? "text-red-600" : "" } 
          ${obj.type==="succ" ? "text-green-200" : ""}
          ${obj.type==="key" ? "blur-sm " : ""}
          `
          
          }>{obj.content}</pre>)}

    </div>






    {showBtnConfirm ? (
      <div>
        <TypingText
          text={["The system is now ready with full features. Click the button below to proceed to the Chat."]}
          typingSpeed={110}
          pauseDuration={1500}
          showCursor={true}
          cursorCharacter="|"

          variableSpeed={{ min: 50, max: 120 }}
        />
        <p></p>
        <button 
        onClick={()=>setPreferences(prev=>({...prev,currentPage:"chat"}))}
        className="bg-green-950 py-2 px-4 mt-2 border border-dashed border-green-500 rounded-md hover:bg-green-900">Open Chat</button>
       </div>
    ):(
          <div >
            <span className={`inline-block loading ${loading ? "" : "hidden"}`}>{"|"}</span>
            <textarea 
            ref={TextAreaRef}
            onKeyDown={handlekeyDown}
            onInput={handleInput}
            rows={1}
            type="text" placeholder="place you key here" disabled={loading || showBtnConfirm} className={`auto-expand outline-none placeholder-green-600 text-white  mt-2  p-2 border-t  border-green-400 border-dashed w-[80%] md:w-[50%]`} ></textarea>
          </div>
            
    )}
  
  </div>)

};
