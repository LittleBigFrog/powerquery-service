// Correct import for @microsoft/powerquery-parser v0.15.10
const { Parser, DefaultSettings } = require('@microsoft/powerquery-parser');

/**
 * Parses a Power Query expression and returns the AST (Abstract Syntax Tree).
 * @param {string} expression - The Power Query code to parse.
 * @returns {object} - The parsed AST.
 */
function parsePowerQuery(expression) {
    try {
        // Use the parse function from the Parser module
        const ast = Parser.parse(expression, DefaultSettings);
        return ast;
    } catch (error) {
        throw new Error(`Failed to parse Power Query: ${error.message}`);
    }
}

// Example Power Query expression
const expression = `let
    Source = Table.FromRecords({[Name = "Alice", Age = 30]}),
    Filtered = Table.SelectRows(Source, each [Age] > 25)
in
    Filtered`;

// Parse the expression and log the AST
try {
    const ast = parsePowerQuery(expression);
    console.log("Parsed AST:");
    console.log(JSON.stringify(ast, null, 2));
} catch (error) {
    console.error(error.message);
}
