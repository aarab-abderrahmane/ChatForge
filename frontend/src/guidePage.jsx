import { useState ,useContext} from "react";

import { chatsContext } from "./chatsContext";

export async function KeyTest(setWelcomeMessages,key,setPreferences) {

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
      setWelcomeMessages(prev => [...prev, "Key doesn't work!"]);
   console.log("invalid")
   
    }else{

        console.log("valid")
      setWelcomeMessages(prev => [...prev, "Key is valid."]) 
      setPreferences(prev=>({...prev,isVisited:true}))
    
    }



  } 
  catch (err) {
    setWelcomeMessages(prev => [...prev, "Connection error"]);
  }
}




export const GuidePage = () => {

    const[ welcomeMessages,setWelcomeMessages] = useState([
  "root@chatforge-terminal:~# ./start_chatforge.sh",
  "[✓] Verifying ChatForge environment",
  "[✓] Loading AI modules...",
  "[!] OpenRouter API key not detected",
  "→ Please create your key at https://openrouter.ai",
  "→ Copy it here to enable full access",
  "System ready for authentication.",
  "Limited access until API key is provided."
]);

const {setPreferences} = useContext(chatsContext)

async function handlekeyDown(e){

        if(e.key === "Enter"){
            await KeyTest(setWelcomeMessages,e.target.value.trim(),setPreferences)
        }
}


  return (<div className="p-6 mt-6">
    <div >

        {welcomeMessages.map(txt=><pre>{txt}</pre>)}

    </div>
    <input 
    onKeyDown={handlekeyDown}
    type="text" placeholder="place you key here" className="outline-none placeholder-green-600 text-white  mt-2  p-2 border-t  border-green-400 border-dashed w-[80%] md:w-[50%]" ></input>
  </div>)

};
