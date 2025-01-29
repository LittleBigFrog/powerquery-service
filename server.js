const express = require("express");
const {
  Language,
  Parser,
  DefaultSettings,
  Task
} = require("@microsoft/powerquery-parser");

// Diagnostic logging
console.log('Language structure:', Object.keys(Language));
console.log('Parser structure:', Object.keys(Parser));

const app = express();

app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    if (Language.CombinatorialParser) {
      console.log('Found CombinatorialParser');
    }
    if (Language.Parser) {
      console.log('Found Language.Parser');
    }
    if (Parser.Expression) {
      console.log('Found Parser.Expression');
    }
    
    // Return the available functions for debugging
    return res.json({
      success: true,
      debug: {
        languageKeys: Object.keys(Language),
        parserKeys: Object.keys(Parser),
        hasDefaultSettings: !!DefaultSettings
      }
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
