const express = require("express");
const { DefaultSettings, Task, Language } = require("@microsoft/powerquery-parser");
const app = express();

app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // Create lexer state with default settings
    const lexerState = Language.Lexer.State.create(DefaultSettings);
    
    // Tokenize the expression
    const lexerResult = Language.Lexer.tokenize(lexerState, expression);
    
    if (lexerResult.kind !== "ok") {
      return res.status(400).json({ 
        success: false,
        error: "Lexer error",
        details: lexerResult.error
      });
    }
    
    // Create parser state
    const parserState = Language.Parser.State.create(DefaultSettings);
    
    // Parse the tokens
    const parseResult = Language.Parser.Expression.readDocument(
      parserState,
      lexerResult.value.tokens
    );
    
    if (parseResult.kind !== "ok") {
      return res.status(400).json({ 
        success: false,
        error: "Parser error",
        details: parseResult.error
      });
    }

    return res.json({ 
      success: true,
      result: parseResult.value
    });
    
  } catch (error) {
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
