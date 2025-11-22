// import { askAI, encrypt, saveUserKey } from './functions.js';

import {connectDB} from "../db"



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


export default async function handler (req,res){
  console.log("Test endpoint hit");
  res.status(200).json({ message: "Server is running!" });
  if (req.method !== 'POST') return res.status(405).end();


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

}
