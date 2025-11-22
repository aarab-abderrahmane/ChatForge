const BASE_URL = "https://chat-forge-api.vercel.app/api";

export const api = {


  //check key is exists 
  checkKeyExists: async (userId) => {
    try {
      const res = await fetch(`${BASE_URL}/key-exists`,{
        headers : {
            "Content-Type" : "application/json"
          },
          method : "POST",
          body: JSON.stringify({userId:userId })
      });

      const data = await res.json()
      return data

    } catch (error) {
      console.error(error);
      return { exists: false, res:"error" };
    }
  },


  //test key is valid 
  testKey: async (key,userId) => {
    try {
      const res = await fetch(`${BASE_URL}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ APIkey: key , userId :userId }),
      });
      return await res.json();
    } catch (error) {
      return { type: "error", response: `Connection error,${error}` };
    }
    
  
  },

  
  // send message
  chat: async (question, history,userId) => {

    try{

      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history,userId }),
      });
      return await res.json();
    
    }catch(error){
       return { type: "error", response: `Connection error,${error}` };
    }


  }

};