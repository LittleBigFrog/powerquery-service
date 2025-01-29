const express = require("express");

// We see from your logs you have these exports under the parser sub-path:
const {
  // We won't try ParserUtils.createState anymore,
  // because your build doesn't have it.
  NaiveParseSteps,
  ParseContext,
  ParseError,
  ParseStateUtils, // We'll use this to create state
} = require("@microsoft/powerquery-parser/lib/powerquery-parser/parser");

const {
  DefaultSettings,
} = require("@microsoft/powerquery-parser/lib/powerquery-parser/settings");

const app = express();
app.use(express.json());

// Quick GET route
app.get("/", (req, res) => {
  res.send("Hello from the Power Query Parser (NaiveParseSteps + ParseStateUtils)!");
});

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // 1) Create a parseState using ParseStateUtils
    //    This is how older 0.15.x builds do it.
    const parseState = ParseStateUtils.createState(DefaultSettings, expression);

    // 2) Make a parseContext, linking to parseState
    const parseContext = new ParseContext(parseState);

    // 3) Actually parse with NaiveParseSteps
    //    If it fails, we'll get a ParseError
    //    If it succeeds, we get a "checkpoint" object, 
    //    but the real AST is stored in parseState.contextState.nodeIdMapCollection
    const parseResult = NaiveParseSteps.readDocument(parseState, parseContext);

    // Check if it's an error
    if (parseResult instanceof ParseError.ParseError) {
      return res.status(400).json({
        success: false,
        kind: "ParseError",
        message: parseResult.message,
      });
    }

    // Otherwise, it's a success checkpoint
    // The AST-like structure is in parseState.contextState.nodeIdMapCollection
    const ast = parseState.contextState.nodeIdMapCollection;

    return res.json({
      success: true,
      parseKind: "NaiveParseSteps",
      ast,
    });
  } catch (error) {
    console.error("Parse error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NaiveParseSteps server listening on port ${PORT}`);
});
