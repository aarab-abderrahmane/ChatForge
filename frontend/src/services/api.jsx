const BASE_URL = "http://localhost:5000/api";

export const api = {


    //check key is exists 
  checkKey: async () => {
    try {
      const res = await fetch(`${BASE_URL}/key-check`);
      return await {exists:res.json()};
    } catch (error) {
      console.error(error);
      return { exists: false, res:error };
    }
  },

  //test key is valid 
  testKey: async (key) => {
    try {
      const res = await fetch(`${BASE_URL}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ APIkey: key }),
      });
      return await res.json();
    } catch (error) {
      return { type: "error", response: `Connection error,${error}` };
    }
  },

  
  // send message
  chat: async (question, history) => {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history }),
    });
    return await res.json();
  }
};