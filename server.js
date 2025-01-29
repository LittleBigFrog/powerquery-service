const express = require("express");
// Notice we import Language instead of Parser:
const { Language, DefaultSettings } = require("@microsoft/powerquery-parser");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, Power Query Parser!");
});

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // Use Language.Parse.parse for version 0.15.x
    const parseResult = Language.Parse.parse(DefaultSettings, expression);
    return res.json({ parseResult });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PowerQuery service running on port ${PORT}`);
});
