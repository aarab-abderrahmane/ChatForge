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
    answer.error ? content = "⚠️ AI service is currently unavailable. Please try again later."   : ""
    answer ? content = answer.choices?.[0]?.message?.content || "something went wrong"  : ""

    res.json({
      response: content   
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
