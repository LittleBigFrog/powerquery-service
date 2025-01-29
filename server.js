const express = require("express");
const { Parser } = require("@microsoft/powerquery-parser");

const app = express();
app.use(express.json());

// POST /parse - parse a Power Query expression from JSON body
app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }
  try {
    const parseResult = Parser.Parse(expression);
    res.json({ parseResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PowerQuery service running on port ${PORT}`);
});
