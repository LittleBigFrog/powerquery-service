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
    // 
