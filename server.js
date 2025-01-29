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
    // Use the Parser.parse function directly
    const parsedResult = Parser.parse(DefaultSettings, expression);
    
    // The parser returns a ParseError or ParseOk type
    if (parsedResult.error) {
      return res.status(400).json({ 
        success: false,
        error: "Failed to parse expression",
        details: parsedResult.error
      });
    } else {
      return res.json({ 
        success: true,
        result: parsedResult
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      error: "Internal server error",
      message: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Power Query Parser Service running on port ${PORT}`);
});
