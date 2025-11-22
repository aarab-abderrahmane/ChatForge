import { askAI, encrypt, saveUserKey } from '../functions.js';


export default  async function handler (req, res) {


  if(req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
    // res.json({
    //   response: "⚠️ Unable to reach AI service. Check your internet connection or try again."   
    // });
    res.status(500).json({ error: "something went wrong" });
  }
};
