const express = require("express");
const pqp = require("@microsoft/powerquery-parser/lib/powerquery-parser"); 
// or possibly /dist/powerquery-parser

const app = express();
app.use(express.json());

app.post("/parse", (req, res) => {
  const { expression } = req.body;
  if (!expression) return res.status(400).json({ error: "No expression provided." });

  try {
    // e.g. pqp.DefaultSettings, pqp.Language, etc.
    // If parse is nested, you might do:
    //   const parse = pqp.Language.Parse.parse;
    // or
    //   const parse = pqp.Parser.parse;
    // depending on which is actually defined
    const parseResult = pqp.Language.Parse.parse(pqp.DefaultSettings, expression);
    return res.json({ parseResult });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Running on " + PORT);
});
