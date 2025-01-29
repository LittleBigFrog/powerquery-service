const express = require("express");
const {
  Parser: { CombinatorialParserV2, ParseError },
  DefaultSettings,
  Language: { Token }
} = require("@microsoft/powerquery-parser");

const app = express();
app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // Create parser instance
    const parser = new CombinatorialParserV2(DefaultSettings);
    
    // Initialize parse context
    const context = parser.createContext(expression);
    
    // Attempt to parse
    const parseResult = parser.parse(context);
    
    // Check if parsing was successful
    if (parseResult instanceof ParseError) {
      return res.status(400).json({ 
        success: false,
        error: "Parse error",
        details: parseResult
      });
    }

    return res.json({ 
      success: true,
      result: parseResult
    });
    
  } catch (error) {
    console.error('Parsing error:', error);
    return res.status(500).json({ 
      success: false,
      error: "Internal server error",
      message: error.message,
      stack: error.stack
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Power Query Parser Service running on port ${PORT}`);
});
