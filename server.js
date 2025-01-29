const express = require("express");
const {
  Language,
  Parser,
  DefaultSettings,
  Task
} = require("@microsoft/powerquery-parser");

const app = express();

app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // Create the parser context
    const lexerState = Language.createStateful(DefaultSettings, expression);
    
    // Parse the expression
    const parseResult = Parser.Expression.tryParse(lexerState, expression);
    
    console.log('Parse result:', parseResult); // Debug logging
    
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
  console.log('Using modules:', {
    hasLanguage: !!Language,
    hasParser: !!Parser,
    hasDefaultSettings: !!DefaultSettings,
    hasTask: !!Task
  });
});
