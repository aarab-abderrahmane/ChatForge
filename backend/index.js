export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.status(200).json({
    title: "ChatForge Backend API",
    message: "Welcome! Use /api/chat, /api/test, /api/key-exists endpoints."
  });
}

let uri = `mongodb+srv://${process.env.USER_NAME_MONGO}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.CLUSTER}.mongodb.net/?appName=${process.env.APP_NAME}`
console.log(uri)
