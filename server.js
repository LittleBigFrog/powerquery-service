const express = require("express");
// Import parse from the parser sub-path:
const { parse } = require("@microsoft/powerquery-parser/lib/language/parse/parser");
// Import DefaultSettings from the settings sub-path:
const { DefaultSettings } = require("@microsoft/powerquery-parser/lib/settings");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Power Query Parser (v0.15.10)!");
});

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // Now the 'parse' function definitely exists
    const parseResult = parse(DefaultSettings, expression);
    return res.json({ parseResult });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PowerQuery service running on port ${PORT}`);
});
