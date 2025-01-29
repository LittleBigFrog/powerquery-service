const express = require("express");

// 1) Sub-path imports
//    Because your logs show no 'Language.Parse',
//    we directly import `parse` from the compiled output folder (dist).
const {
  parse,
} = require("@microsoft/powerquery-parser/dist/powerquery-parser/language/parser/parser");
const {
  DefaultSettings,
} = require("@microsoft/powerquery-parser/dist/powerquery-parser/settings");

// 2) Set up Express
const app = express();
app.use(express.json());

// Optional: Quick GET route to verify the server is running
app.get("/", (req, res) => {
  res.send("PowerQuery Parser Service (using sub-path import) is running!");
});

// POST /parse
app.post("/parse", (req, res) => {
  const { expression } = req.body;

  if (!expression) {
    return res.status(400).json({
      success: false,
      error: "No expression provided.",
    });
  }

  try {
    // 3) Call the sub-path parse function
    //    parse(DefaultSettings, <string>)
    const parseResult = parse(DefaultSettings, expression);

    // parseResult can be a "ParseOk" or "ParseError" object
    if (parseResult.kind === "ParseError") {
      return res.status(400).json({
        success: false,
        error: "ParseError",
        details: parseResult.error ? parseResult.error.message : null,
      });
    }

    // On ParseOk, the AST is in parseResult.state.contextState.nodeIdMapCollection
    return res.json({
      success: true,
      parseKind: parseResult.kind,
      ast: parseResult.state.contextState.nodeIdMapCollection,
    });
  } catch (err) {
    console.error("Parsing error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }
});

// 4) Listen on port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PowerQuery sub-path parser service listening on port ${PORT}`);
});
