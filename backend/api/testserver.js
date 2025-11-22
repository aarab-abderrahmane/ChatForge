export default async function handler(req, res) {
  if (req.method === "POST") {
    const { message } = req.body || {};
    res.status(200).json({
      success: true,
      message: message || "Server is running and received your POST request!"
    });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
