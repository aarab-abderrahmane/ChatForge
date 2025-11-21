import dotenv from "dotenv" ; 
import { MongoClient } from "mongodb";


dotenv.config()

let uri = `mongodb+srv://${process.env.USER_NAME_MONGO}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.CLUSTER}.mongodb.net/?appName=${process.env.APP_NAME}`

const client = new MongoClient(uri)

async function connectDB(){

    try{

        await client.connect(); 
        console.log("connected to MongoDB Atlas .")

    }catch (error){
        console.error('MongoDB connection error:',error)
        throw error
    }


}


export {client,connectDB}

