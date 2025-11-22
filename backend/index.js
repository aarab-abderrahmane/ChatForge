export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.status(200).json({
    title: "ChatForge Backend API",
    message: "Welcome! Use /api/chat, /api/test, /api/key-exists endpoints."
  });
}
