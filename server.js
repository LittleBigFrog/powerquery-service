const express = require("express");

const { parse } = require("@microsoft/powerquery-parser/dist/powerquery-parser/language/parser/parser");
const { DefaultSettings } = require("@microsoft/powerquery-parser/dist/powerquery-parser/settings");


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
    const parseResult = parse(DefaultSettings, expression);
    return res.json({ parseResult });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PowerQuery service running on port ${PORT}`);
});
