const express = require("express");
const { Parser, DefaultSettings } = require("@microsoft/powerquery-parser");

const app = express();
app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided" });
  }

  try {
    // Updated call: Parser.Parse(DefaultSettings, expression)
    const parseResult = Parser.Parse(DefaultSettings, expression);
    return res.json({ parseResult });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
