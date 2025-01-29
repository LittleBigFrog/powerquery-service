/*****************************************************************************
 * server.js - Diagnostic sub-path approach
 *****************************************************************************/
const express = require("express");

// Try importing from the 'lib/powerquery-parser/parser' path:
const parserExports = require("@microsoft/powerquery-parser/lib/powerquery-parser/parser");

// Also import DefaultSettings from 'lib/powerquery-parser/settings'
const { DefaultSettings } = require("@microsoft/powerquery-parser/lib/powerquery-parser/settings");

const app = express();
app.use(express.json());

// 1) Log what we actually have in "parserExports"
console.log("=== pqp parserExports keys ===", Object.keys(parserExports));

app.get("/", (req, res) => {
  res.send("Hello from the diagnostic Power Query parser server!");
});

// 2) POST /parse route
app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided" });
  }
  try {
    // Check if there's a 'parse' function
    if (!parserExports.parse) {
      // Possibly it's exported under some other name
      // We'll show the actual keys so you can see what is there
      return res.status(501).json({
        error: "No 'parse' function found in parser sub-path.",
        keys: Object.keys(parserExports),
      });
    }

    // If parse is found, call it
    const parseResult = parserExports.parse(DefaultSettings, expression);
    return res.json({ success: true, parseResult });
  } catch (err) {
    console.error("Parsing error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Diagnostic parser server listening on port ${PORT}`);
});
