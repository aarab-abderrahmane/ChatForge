import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());



async function askAI(question,historySummary) {

  console.log(question)
  console.log(historySummary)

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer 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`,
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


app.post("/", async (req, res) => {

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


app.get('/',(_,res)=>{
    res.json({message:"hello to my chat boot "})
})


app.listen(5000, () => console.log("Server running on port 5000"));
