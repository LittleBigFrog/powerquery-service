const express = require("express");
const { Parser, DefaultSettings } = require("@microsoft/powerquery-parser");

const app = express();
app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // NOTE the lowercase 'parse' instead of 'Parse'
    const parseResult = Parser.parse(DefaultSettings, expression);
    res.json({ parseResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
