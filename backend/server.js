// import express, { response } from "express";

// import cors from "cors";
// import dotenv from "dotenv";
// import fs from "fs";


// import {client,connectDB} from './db.js'

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());





// app.post("/api/chat", async (req, res) => {

//   const { userId } = req.body;
//   const keyStatus = await getUserKey(userId)

//   if (!keyStatus.exists){
//       res.json({
//           response : `API not found.! , ${keyStatus.res}`,
//           mesType:"error"
//       })
//   }

//   try {


//     const answer = await askAI(req.body.question,keyStatus.res,req.body.history);

//     let content = ""; 
//     let mesType = "";
//     if(answer.error){
//         content = "⚠️ AI service is currently unavailable. Please try again later."
//         mesType="error"
//     }else{

//       content = answer.choices?.[0]?.message?.content 
      
//       if(content){
//           mesType="res"
//       }else{
//         content = "something went wrong ,Check your internet / firewall" 
//         mesType = "error"
//       }

//     }

//     res.json({
//       response: content ,
//       type : mesType

//     });
  

//   } catch (error) {
//     res.json({
//       response: "⚠️ Unable to reach AI service. Check your internet connection or try again."   
//     });
//     res.status(500).json({ error: "something went wrong" });
//   }
// });


// app.post('/api/test',async (req,res)=>{

//   const {APIkey,userId} = req.body
//   const cleanKey = APIkey?.trim()
//   if(!cleanKey){
//      return res.status(400).json({ type: "error", response: "API Key is required." });
//   }

//   try{
//     const  answer = await askAI('how are you?',cleanKey)

//     if(answer.error || !answer.choices?.[0]?.message?.content){
//         console.log("API key test failed, full response:", answer);
//         return res.json({
//         response: "⚠️ The provided API key is invalid or the AI service is unreachable.",
//         type: "error"
//          });
//     }else{



//       const encryptedKey = encrypt(cleanKey)
//       await saveUserKey(encryptedKey,userId)


//       res.json({
//         response: "ok",
//         type: "success"
//        });

//     }


  

//   } catch (error) {
//     console.error("Error during API key test:", error);
//     res.status(500).json({
//       response: "⚠️ Internal server error while trying to validate key.",
//       type: "error"
//     });
//   }

// })


// app.get('/',(_,res)=>{
//     res.json({message:"Welcome to chatForge "})
// })


// // check if the user have key in database 

// app.post("/api/key-exists",async (request,res)=>{
  
//   const {userId} = request.body

//   const keystatus = await getUserKey(userId)
//   res.json(keystatus)

//   if(keystatus.exists && keystatus.res.length>0){
//     res.json(keystatus)
//   }else{
//     res.json(keystatus)
//   }

// })



// // async function startServer() {
// //   try {
// //     await connectDB(); 
// //     app.listen(5100, () => console.log("Server running on port 5000"));
// //   } catch (err) {
// //     console.error("Failed to start server due to DB connection error:", err);
// //      // Exit process if DB not connected
// //     process.exit(1);
// //   }
// // }

// // startServer();