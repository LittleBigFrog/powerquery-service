/*****************************************************************************
 * server.js - NaiveParseSteps approach for powerquery-parser@0.15.x
 *****************************************************************************/
const express = require("express");

// Import from the "parser" sub-path
const {
  ParserUtils,
  ParseContext,
  NaiveParseSteps,
  ParseError,
} = require("@microsoft/powerquery-parser/lib/powerquery-parser/parser");

// Also import DefaultSettings from "settings"
const {
  DefaultSettings,
} = require("@microsoft/powerquery-parser/lib/powerquery-parser/settings");

const app = express();
app.use(express.json());

// Optional GET route for a quick health check
app.get("/", (req, res) => {
  res.send("Hello from the Power Query Parser (NaiveParseSteps)!");
});

// POST /parse => parse a Power Query expression
app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided" });
  }

  try {
    // 1) Create initial parse state using your default settings and the expression
    //    This sets up tokens, internal states, etc.
    const parseState = ParserUtils.createState(DefaultSettings, expression);

    // 2) Create a parse context, passing in the same parseState
    const parseContext = new ParseContext(parseState);

    // 3) Actually parse the document
    //    If it fails, we get a ParseError
    //    If it succeeds, we get a "checkpoint" with updated parseState
    const parseResult = NaiveParseSteps.readDocument(parseState, parseContext);

    // Check if parseResult is an error or a checkpoint
    if (parseResult instanceof ParseError.ParseError) {
      return res.status(400).json({
        success: false,
        kind: "ParseError",
        error: parseResult.message,
      });
    }

    // Otherwise, parseResult is a "checkpoint" describing a successful parse
    // The "AST" is inside parseState.contextState.nodeIdMapCollection
    const ast = parseState.contextState.nodeIdMapCollection;

    return res.json({
      success: true,
      parseKind: "NaiveParseSteps",
      ast, // the AST is the NodeIdMapCollection
    });
  } catch (error) {
    console.error("Parsing error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NaiveParseSteps parser service listening on port ${PORT}`);
});
