const express = require("express");
// Pull out Language & DefaultSettings from top-level
const { Language, DefaultSettings } = require("@microsoft/powerquery-parser");

// If you want deeper parser internals (like NodeIdMap, etc.),
// you can also import from sub-paths like:
// const { NodeIdMap } = require("@microsoft/powerquery-parser/lib/powerquery-parser/parser");

const app = express();
app.use(express.json());

// Optional GET route to quickly test in browser
app.get("/", (req, res) => {
  res.send("PowerQuery Parser Service (v0.15.x) is running!");
});

// POST /parse to parse an expression and return AST details
app.post("/parse", (req, res) => {
  const { expression } = req.body;

  if (!expression) {
    return res.status(400).json({ 
      success: false,
      error: "No expression provided." 
    });
  }

  // Attempt to parse using 0.15.x approach
  const parseResult = Language.Parse.parse(DefaultSettings, expression);

  // parseResult.kind can be "ParseOk" or "ParseError"
  if (parseResult.kind === "ParseError") {
    // On parse error
    return res.status(400).json({
      success: false,
      error: "ParseError",
      details: parseResult.error
        ? parseResult.error.message
        : "Unknown parse error"
    });
  }

  // On successful parse => parseResult.kind === "ParseOk"
  // The AST is in parseResult.state.contextState.nodeIdMapCollection
  const parseOk = parseResult; // for clarity
  const ast = parseOk.state.contextState.nodeIdMapCollection;

  // Return the "AST" (which includes node IDs, a scope map, etc.)
  return res.json({
    success: true,
    // "ast" might be quite large. Return as is or transform as needed
    ast
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Power Query Parser Service running on port ${PORT}`);
});
