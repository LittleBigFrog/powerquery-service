import express from "express";
import { Language, DefaultSettings } from "@microsoft/powerquery-parser";

const app = express();
app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  // Since you're in ESM mode, Language.Parse.parse should be defined
  const parseResult = Language.Parse.parse(DefaultSettings, expression);
  return res.json({ success: true, parseResult });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
