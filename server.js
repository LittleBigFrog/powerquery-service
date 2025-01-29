const express = require("express");
const powerquery = require("@microsoft/powerquery-parser");

// Add diagnostic logging
console.log('Available modules:', Object.keys(powerquery));

const app = express();

app.use(express.json());

app.post("/parse", async (req, res) => {
  const { expression } = req.body;
  
  if (!expression) {
    return res.status(400).json({ error: "No expression provided." });
  }

  try {
    // Parse the text directly using Text.parse
    const parseResult = await Text.parse(expression);
    
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
});
