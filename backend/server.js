import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


function encrypt(text){

  return Buffer.from(text).toString('base64')
}

function decrypt(text){
  return Buffer.from(text,"base64").toString('utf8')
}

export function saveUserKey(encryptedKey) {
  fs.writeFileSync(
    "keys.json",
    JSON.stringify({ key: encryptedKey }, null, 2)
  );
}

export function getUserKey() {
  if (!fs.existsSync("keys.json")) return "";

  const data = JSON.parse(fs.readFileSync("keys.json"));
  return decrypt(data.key);
}


async function askAI(question,key,historySummary="") {




  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {

        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "kwaipilot/kat-coder-pro:free",
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

  const key = getUserKey()

  console.log(key)

  try {
    const answer = await askAI(req.body.question,key,req.body.history);

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
    res.json({
      response: "⚠️ Unable to reach AI service. Check your internet connection or try again."   
    });
    res.status(500).json({ error: "something went wrong" });
  }
});


app.post('/api/test',async (req,res)=>{

  const APIkey = req.body.APIkey

  if(!APIkey){
     return res.status(400).json({ type: "error", response: "API Key is required." });
  }

  try{
    const  answer = await askAI('how are you?',APIkey)

    if(answer.error || !answer.choices?.[0]?.message?.content){
        console.log("error ____________________")
        return res.json({
        response: "⚠️ The provided API key is invalid or the AI service is unreachable.",
        type: "error"
         });
    }else{



      const encryptedKey = encrypt(APIkey)
      saveUserKey(encryptedKey)


      res.json({
        response: "ok",
        type: "success"
       });

    }


  

  } catch (error) {
    console.error("Error during API key test:", error);
    res.status(500).json({
      response: "⚠️ Internal server error while trying to validate key.",
      type: "error"
    });
  }

})


app.get('/',(_,res)=>{
    res.json({message:"Welcome to chatForge "})
})


app.get("/api/key-check",(_,res)=>{
  
  const key = getUserKey()

  if(key && key.length>0){
    res.json({
      exists : true
    })
  }else{
    res.json({
      exists : false 
    })
  }

})

app.listen(5000, () => console.log("Server running on port 5000"));
