const express = require("express");
const { Language, DefaultSettings } = require("@microsoft/powerquery-parser");
const app = express();

app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // Create a new parser context with the default settings
    const parseState = Language.CombinatorialParser.State.create(DefaultSettings);
    
    // Parse the expression using the correct parser function
    const parsedResult = Language.Parser.Expression.tryParse(parseState, expression);
    
    if (parsedResult.kind === "ok") {
      return res.json({ 
        success: true,
        result: parsedResult.value 
      });
    } else {
      return res.status(400).json({ 
        success: false,
        error: "Failed to parse expression",
        details: parsedResult.error
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
