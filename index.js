// Correct import paths for @microsoft/powerquery-parser v0.15.10
const { parse } = require('@microsoft/powerquery-parser/dist/powerquery-parser/language/parser');
const { DefaultSettings } = require('@microsoft/powerquery-parser/dist/powerquery-parser/language/common/settings');

/**
 * Parses a Power Query expression and returns the AST (Abstract Syntax Tree).
 * @param {string} expression - The Power Query code to parse.
 * @returns {object} - The parsed AST.
 */
function parsePowerQuery(expression) {
    try {
        // Use the parse function with DefaultSettings
        const ast = parse(DefaultSettings, expression);
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
