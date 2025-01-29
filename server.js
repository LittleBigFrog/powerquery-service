const express = require("express");
const { parse, DefaultSettings } = require("@microsoft/powerquery-parser");

const app = express();
app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // Call the top-level parse function (lowercase)
    const parseResult = parse(DefaultSettings, expression);
    return res.json({ parseResult });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
