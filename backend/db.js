// import dotenv from "dotenv" ; 
import { MongoClient } from "mongodb";


// dotenv.config()


// const client = new MongoClient(uri)

let cachedClient = null ;

export async function connectDB(){

    // try{

    //     await client.connect(); 
    //     console.log("connected to MongoDB Atlas .")

    // }catch (error){
    //     console.error('MongoDB connection error:',error)
    //     throw error
    // }
    if (cachedClient) {

        console.log("Reusing cached MongoDB client.")
        return cachedClient


    }


    let uri = `mongodb+srv://${process.env.USER_NAME_MONGO}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.CLUSTER}.mongodb.net/?appName=${process.env.APP_NAME}`

    if(!uri){
        throw new Error('MONGO_URI environment variable is not set.')
    }

    const client = new MongoClient(uri)
    try {
        await client.connect(); 
        console.log("New MongoDB connection established.");
        // Cache the successful connection
        cachedClient = client; 
        return client;

    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error; 
    }


}


// export {client,connectDB}

