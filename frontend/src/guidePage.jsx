import { useState ,useContext} from "react";

import { chatsContext } from "./chatsContext";

export async function KeyTest(setWelcomeMessages,key,setPreferences,setLoading) {

  try {
    const res = await fetch("http://localhost:5000/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ APIkey:key }),
    });

    const data = await res.json();
    console.log(data);


    if (data.mesType === "error"  || data.type=== "error") {
      setWelcomeMessages(prev => [...prev,{type:"error",content:data.response} ]);
      console.log("invalid")
   
    }else{

        console.log("valid")
        setWelcomeMessages(prev => [...prev, {type:"succ",content:"[✓] API Key authenticated. Full access granted."} ]) 
      // setPreferences(prev=>({...prev,isVisited:true}))
    
    }



  } 
  catch (err) {
    setWelcomeMessages(prev => [...prev, "Connection error"]);
  }


  setLoading(false)
  
}




export const GuidePage = () => {


    const [loading,setLoading] =  useState(false)

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

const {setPreferences} = useContext(chatsContext)

async function handlekeyDown(e){

        if(e.key === "Enter"){
            setLoading(true)
            await KeyTest(setWelcomeMessages,e.target.value.trim(),setPreferences,setLoading)
        }
}


  return (<div className="p-6 mt-6 overflow-y-scroll">
    <div >


        {welcomeMessages.map(obj=><pre  className={`text-wrap my-2 ${obj.type==="error" ? "text-red-600" : "" }  ${obj.type==="succ" ? "text-green-200" : ""}`}>{obj.content}</pre>)}

    </div>

    <div className="">
    <span className={`inline-block loading ${loading ? "" : "hidden"}`}>{"|"}</span>
    <input 
    onKeyDown={handlekeyDown}
    type="text" placeholder="place you key here" disabled={loading} className="outline-none placeholder-green-600 text-white  mt-2  p-2 border-t  border-green-400 border-dashed w-[80%] md:w-[50%]" ></input>
    </div>
  
  
  </div>)

};
