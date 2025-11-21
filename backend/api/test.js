import { askAI } from '../functions';

export default async function handler (req,res){

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
