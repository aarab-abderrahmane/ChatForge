import dotenv from "dotenv";
import { MongoClient } from "mongodb";


dotenv.config()


// const client = new MongoClient(uri)

let cachedClient = null;
let isDbDown = false;
let nextRetry = 0;

export async function connectDB() {

    // try{

    //     await client.connect(); 
    //     console.log("connected to MongoDB Atlas .")

    // }catch (error){
    //     console.error('MongoDB connection error:',error)
    //     throw error
    // }
    if (cachedClient) return cachedClient;

    if (isDbDown && Date.now() < nextRetry) {
        return null;
    }


    let uri = `mongodb+srv://${process.env.USER_NAME_MONGO}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.CLUSTER}.mongodb.net/?appName=${process.env.APP_NAME}`

    if (!uri) {
        throw new Error('MONGO_URI environment variable is not set.')
    }

    const client = new MongoClient(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000
    });

    try {
        await client.connect();
        console.log("New MongoDB connection established.");
        cachedClient = client;
        isDbDown = false;
        return client;
    } catch (error) {
        console.warn('⚠️ MongoDB connection failed. Running in Degraded Mode (In-Memory).', error.message);
        isDbDown = true;
        nextRetry = Date.now() + 300000; // Retry in 5 mins
        return null;
    }
}


// export {client,connectDB}

