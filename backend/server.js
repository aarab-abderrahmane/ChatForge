// import cors from "cors";
// import dotenv from "dotenv";


// import {client,connectDB} from './db.js'
// dotenv.config();
// app.use(cors());

import express from "express"
import {connectDB} from "./db.js"

const app = express();
app.use(express.json());




export async function saveUserKey(encryptedKey,userId) {
  
    const client = await connectDB()

    const db = client.db(process.env.APP_NAME)
    const collection = db.collection("apikeys") // like table in sql 


  
  await collection.updateOne(
    {userId},
    {$set : {encryptedKey}}, // update key if the user already exist
    {upsert : true} // add new key 
  )


  // fs.writeFileSync(
  //   "keys.json",
  //   JSON.stringify({ key: encryptedKey }, null, 2)
  // );
}



export function encrypt(text){

  return Buffer.from(text).toString('base64')
}

export function decrypt(text){
  return Buffer.from(text,"base64").toString('utf8')
}



export async function getUserKey(userId) {
  try {

    const client = await connectDB()
    
    const db = client.db(process.env.APP_NAME)
    const collection  = db.collection('apikeys');

    const user  = await collection.findOne({userId:userId})
    const decryptedkey  = decrypt(user.encryptedKey).trim()


    if(user){

        return {exists: true , res : decryptedkey}

    }else{


      return {exists : false , res :"User not found. Please provide a valid API key ⚠️." }

    }

  }catch(err){

      return {exists : false , res : "Unable to fetch user key due to a server error .Please try again later ❌."} 

  }
  // if (!fs.existsSync("keys.json")) return "";

  // const data = JSON.parse(fs.readFileSync("keys.json"));
  // return decrypt(data.key);
}


export async function askAI(question,key,historySummary="") {




  try {
    // const controller = new AbortController();
    // const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {

        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
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
      // signal: controller.signal
    });

    // clearTimeout(timeout);

    const data = await response.json();
    console.log("Data from API:", data);

    return data;
  } catch (err) {
    console.error("Error fetching AI:", err);
    return { error: err.message };
  }
}



app.post("/api/chat", async (req, res) => {

  const { userId } = req.body;
  const keyStatus = await getUserKey(userId)

  if (!keyStatus.exists){
      res.json({
          response : `API not found.! , ${keyStatus.res}`,
          mesType:"error"
      })
  }

  try {


    const answer = await askAI(req.body.question,keyStatus.res,req.body.history);

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

  const {APIkey,userId} = req.body
  const cleanKey = APIkey?.trim()
  if(!cleanKey){
     return res.status(400).json({ type: "error", response: "API Key is required." });
  }

  try{
    const  answer = await askAI('how are you?',cleanKey)

    if(answer.error || !answer.choices?.[0]?.message?.content){
        console.log("API key test failed, full response:", answer);
        return res.json({
        response: "⚠️ The provided API key is invalid or the AI service is unreachable.",
        type: "error"
         });
    }else{



      const encryptedKey = encrypt(cleanKey)
      await saveUserKey(encryptedKey,userId)


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


// check if the user have key in database 

app.post("/api/key-exists",async (request,res)=>{
  
  const {userId} = request.body

  const keystatus = await getUserKey(userId)
  res.json(keystatus)

  if(keystatus.exists && keystatus.res.length>0){
    res.json(keystatus)
  }else{
    res.json(keystatus)
  }

})




export default app  ; 





// async function startServer() {
//   try {
//     await connectDB(); 
//     app.listen(5100, () => console.log("Server running on port 5000"));
//   } catch (err) {
//     console.error("Failed to start server due to DB connection error:", err);
//      // Exit process if DB not connected
//     process.exit(1);
//   }
// }

// startServer();