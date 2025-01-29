/*****************************************************************************
 * server.js
 *****************************************************************************/
const express = require("express");
const pqp = require("@microsoft/powerquery-parser");

// 1) Immediately log what we have
console.log("=== PowerQuery top-level exports ===");
console.log(Object.keys(pqp));

if (pqp.Language) {
  console.log("=== PowerQuery.Language keys ===");
  console.log(Object.keys(pqp.Language));

  if (pqp.Language.Parse) {
    console.log("=== PowerQuery.Language.Parse keys ===");
    console.log(Object.keys(pqp.Language.Parse));
  } else {
    console.log("No 'Parse' object under 'pqp.Language'");
  }
} else {
  console.log("No 'Language' object under 'pqp'!");
}

// We'll use DefaultSettings if it exists at top level
const { DefaultSettings } = pqp;

const app = express();
app.use(express.json());

// Simple GET route for quick browser check
app.get("/", (req, res) => {
  res.send("PowerQuery Parser Service (Debug Build) is running!");
});

// 2) POST /parse route
app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // Check if parse function exists
    const parseFn = pqp.Language?.Parse?.parse;
    if (!parseFn) {
      return res.status(501).json({
        error:
          "parse function not found at pqp.Language.Parse.parse. Check logs for actual structure.",
      });
    }

    // Call parse
    const parseResult = parseFn(DefaultSettings, expression);

    // parseResult might be ParseError or ParseOk. We'll just return it directly
    return res.json({ parseResult });
  } catch (err) {
    // If anything blows up internally
    console.error("Parsing error:", err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PowerQuery Parser debugging server listening on port ${PORT}`);
});
