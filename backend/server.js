import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());



export function saveUserKey(encryptedKey) {
  fs.writeFileSync(
    "keys.json",
    JSON.stringify({ key: encryptedKey }, null, 2)
  );
}

export function getUserKey() {
  if (!fs.existsSync("keys.json")) return "";

  const data = JSON.parse(fs.readFileSync("keys.json"));
  return data.key;
}


async function askAI(question,key,historySummary="") {

  key = getUserKey()

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "x-ai/grok-4.1-fast",
        messages: [{ 
          role: "user", 
          content: `
              

              ${historySummary.trim().length>0 && `Here is the recent chat history (short summary): ${historySummary} `}

              Now answer this question clearly and briefly:
              ${question}

              Reply with the shortest correct answer possible.
              `
        
        }],
      }),
    });

    const data = await response.json();
    console.log("Data from API:", data);
    return data;
  } catch (err) {
    console.error("Error fetching AI:", err);
    return { error: err.message };
  }
}


app.post("/api/chat", async (req, res) => {

  try {
    const answer = await askAI(req.body.question,req.body.history);

    let content = ""; 
    let mesType = "";
    if(answer.error){
        content = "⚠️ AI service is currently unavailable. Please try again later."
        mesType="error"
    }else{

      content = answer.choices?.[0]?.message?.content 
      
      if(content){
          mesType="res"
      }else{
        content = "something went wrong ,Check your internet / firewall" 
        mesType = "error"
      }

    }

    res.json({
      response: content ,
      type : mesType

    });
  

  } catch (error) {
    console.log(error);
    res.json({
      response: "⚠️ Unable to reach AI service. Check your internet connection or try again."   
    });
    res.status(500).json({ error: "something went wrong" });
  }
});


app.post('/api/test',async (req,res)=>{

  console.log(req.body.APIkey)
  try{
    const  answer = await askAI('how are you?',req.body.APIkey)
    let content = ""; 
    let mesType = "";
    if(answer.error){
        content = "⚠️ AI service is currently unavailable. Please try again later."
        mesType="error"
    }else{

      content = "ok"
      
      if(content){
          mesType="res"
          const encryptedKey = encrypt(APIkey);
          saveUserKey(encryptedKey)

      }else{
        content = "something went wrong ,Check your internet / firewall" 
        mesType = "error"
      }

    }

    res.json({
      response: content ,
      type : mesType

    });
  

  } catch (error) {
    console.log(error);
    res.json({
      response: "⚠️ Unable to reach AI service. Check your internet connection or try again."   
    });
    res.status(500).json({ error: "something went wrong" });
  }

})


app.get('/',(_,res)=>{
    res.json({message:"hello to my chat boot "})
})


app.listen(5000, () => console.log("Server running on port 5000"));
