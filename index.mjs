// index.mjs (or index.js if type=module in package.json)
import pqp from '@microsoft/powerquery-parser';

// pqp is the entire CommonJS export
// parse + DefaultSettings typically live under pqp.Parser
const { parse, DefaultSettings } = pqp.Parser;

/**
 * Parses a Power Query expression and returns the AST (Abstract Syntax Tree).
 * @param {string} expression - The Power Query code to parse.
 * @returns {object} - The parsed AST.
 */
function parsePowerQuery(expression) {
    try {
        // First arg = settings, second arg = M expression
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

try {
    const ast = parsePowerQuery(expression);
    console.log("Parsed AST:");
    console.log(JSON.stringify(ast, null, 2));
} catch (error) {
    console.error(error.message);
}
