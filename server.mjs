import express from "express";
import { Language, DefaultSettings } from "@microsoft/powerquery-parser";

const app = express();
app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  // Now Language.Parse.parse is actually defined in the ESM build
  const parseResult = Language.Parse.parse(DefaultSettings, expression);
  if (parseResult.kind === "ParseError") {
    return res.status(400).json({ success: false, parseResult });
  }
  return res.json({ success: true, parseResult });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
