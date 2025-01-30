import { DefaultSettings, TaskUtils } from '@microsoft/powerquery-parser';
import * as fs from 'fs';

// ======================
// Type Definitions
// ======================
interface PqLetExpression {
  kind: 'LetExpression';
  variableList: {
    kind: 'ArrayWrapper';
    elements: Array<{
      kind: 'Csv';
      node: {
        kind: 'IdentifierPairedExpression';
        key: { literal: string };
        value: any;
      };
    }>;
  };
  expression: {
    kind: 'IdentifierExpression';
    identifier: { literal: string };
  };
}

type StepInfo = {
  references: string[];
  external_queries: string[];
  code: string;
  used_for_output: boolean;
};

type QueryResult = Record<string, Record<string, StepInfo>>;

// ======================
// Constants
// ======================
const DEFAULT_QUERY_NAME = 'Query1';
const QUERY_HEADER_PREFIX = '//';
const JSON_INDENTATION = 4;

// ======================
// Core Functions
// ======================
function splitQueries(
  combinedQuery: string
): Array<{ name: string; code: string }> {
  const queries: Array<{ name: string; code: string }> = [];
  const lines = combinedQuery.split('\n');
  let currentName: string | null = null;
  let currentCode: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      trimmed.startsWith(QUERY_HEADER_PREFIX) &&
      trimmed.length > QUERY_HEADER_PREFIX.length
    ) {
      if (currentName && currentCode.length > 0) {
        queries.push({
          name: currentName,
          code: currentCode.join('\n').trim(),
        });
      }
      currentName = trimmed.slice(QUERY_HEADER_PREFIX.length).trim();
      currentCode = [];
    } else {
      currentCode.push(line);
    }
  }

  if (currentName && currentCode.length > 0) {
    queries.push({ name: currentName, code: currentCode.join('\n').trim() });
  }

  return queries.length > 0
    ? queries
    : [{ name: DEFAULT_QUERY_NAME, code: combinedQuery.trim() }];
}

function extractSteps(
  ast: unknown,
  originalQuery: string
): Record<string, StepInfo> {
  if (!isValidLetExpression(ast)) {
    console.error('❌ Invalid LetExpression structure');
    return {};
  }

  const steps: Record<string, StepInfo> = {};
  const stepNames: string[] = [];
  const dependencies: Record<string, Set<string>> = {};
  const finalOutputStep = ast.expression.identifier.literal;

  // Collect step names and initialize step info
  ast.variableList.elements.forEach(({ node }) => {
    const stepName = node.key.literal;
    stepNames.push(stepName);
    steps[stepName] = {
      references: [],
      external_queries: [],
      code: extractStepCode(node.value, originalQuery),
      used_for_output: false,
    };
  });

  // Analyze dependencies and external queries with scope tracking
  const baseScope = new Set(stepNames);
  ast.variableList.elements.forEach(({ node }) => {
    const stepName = node.key.literal;
    const { references, externalQueries } = collectReferences(
      node.value,
      baseScope
    );

    dependencies[stepName] = new Set(references); // ✅ Ensure it's a Set
    steps[stepName].references = Array.from(references); // ✅ Convert Set to Array
    steps[stepName].external_queries = Array.from(externalQueries); // ✅ Convert Set to Array
  });

  // Track used steps for output
  const usedSteps = new Set<string>();
  trackUsage(finalOutputStep);

  // Mark output steps
  stepNames.forEach((stepName) => {
    steps[stepName].used_for_output = usedSteps.has(stepName);
  });

  return steps;

  function trackUsage(step: string) {
    if (usedSteps.has(step)) return;
    usedSteps.add(step);
    dependencies[step]?.forEach(trackUsage);
  }
}

// ======================
// Helper Functions
// ======================
function extractStepCode(valueNode: any, originalQuery: string): string {
  if (!valueNode?.tokenRange) return '';

  const start = valueNode.tokenRange.positionStart.codeUnit - 1;
  const end = valueNode.tokenRange.positionEnd.codeUnit;
  return originalQuery.slice(start, end).trim();
}
function collectReferences(
  node: any,
  queryScope: Set<string>
): { references: string[]; externalQueries: string[] } {
  // 🔥 Force JSON-safe types
  const references = new Set<string>();
  const externalQueries = new Set<string>();
  const stack: Array<{ node: any; scopes: Set<string>[] }> = [
    { node, scopes: [queryScope] },
  ];

  while (stack.length > 0) {
    const { node: current, scopes } = stack.pop()!;
    if (!current) continue;

    // Handle nested let expressions (create a new scope)
    if (current.kind === 'LetExpression') {
      const newScope = new Set<string>(); // 🔥 This scope is only for this block
      const newScopes = [newScope, ...scopes];

      // Add variables from this let expression to the new scope
      current.variableList?.elements?.forEach((elem: any) => {
        const name = elem?.node?.key?.literal;
        if (name) newScope.add(name); // 🔥 Scoped to this block
      });

      // Process children with the new inner scope
      current.variableList?.elements?.forEach((elem: any) => {
        stack.push({ node: elem.node.value, scopes: newScopes });
      });
      stack.push({ node: current.expression, scopes: newScopes });
      continue;
    }

    // Handle identifier expressions
    if (current.kind === 'IdentifierExpression') {
      const identifier = current.identifier?.literal;
      if (identifier) {
        // ✅ Check if the identifier exists in the full query scope
        if (queryScope.has(identifier)) {
          references.add(identifier); // ✅ It's a reference within the same query
        } else {
          externalQueries.add(identifier); // ✅ It's an external query
        }
      }
    }

    // Process child nodes
    Object.values(current).forEach((child) => {
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          child.forEach((item) => stack.push({ node: item, scopes }));
        } else {
          stack.push({ node: child, scopes });
        }
      }
    });
  }

  return {
    references: Array.from(references), // 🔥 Convert Set to Array
    externalQueries: Array.from(externalQueries), // 🔥 Convert Set to Array
  };
}

// ======================
// Validation Utilities
// ======================
function isValidLetExpression(ast: unknown): ast is PqLetExpression {
  return (
    typeof ast === 'object' &&
    ast !== null &&
    (ast as PqLetExpression).kind === 'LetExpression' &&
    (ast as PqLetExpression).variableList?.kind === 'ArrayWrapper' &&
    (ast as PqLetExpression).expression?.kind === 'IdentifierExpression'
  );
}

// ======================
// Main Process
// ======================
async function processQueries(fullQuery: string) {
  try {
    if (typeof fullQuery !== 'string' || fullQuery.trim().length === 0) {
      throw new Error('Invalid input: Expected non-empty string');
    }

    const queries = splitQueries(fullQuery);
    const queryResults: QueryResult = {};

    for (const { name, code } of queries) {
      try {
        const task = await TaskUtils.tryLexParse(DefaultSettings, code);

        if (!TaskUtils.isParseStageOk(task)) {
          console.error(`❌ Parsing failed for ${name}`);
          continue;
        }

        if (!isValidLetExpression(task.ast)) {
          console.error(`❌ Invalid AST structure for ${name}`);
          continue;
        }

        queryResults[name] = extractSteps(task.ast, code);
      } catch (error) {
        console.error(`⚠️ Error processing ${name}:`, error);
      }
    }

    fs.writeFileSync(
      'queries.json',
      JSON.stringify(queryResults, null, JSON_INDENTATION)
    );
    console.log('✅ Processed queries saved to queries.json');
  } catch (error) {
    console.error('🔥 Critical failure:', error);
    process.exit(1);
  }
}

// ======================
// Execution
// ======================
const MULTI_QUERY_CODE = `
// Query1
let
    Source = 4,
    Custom4 = Source + query2
in
    Custom4

// query2
let
   Custom1 = 4,
    Custom2 = 7, 
    Custom3 = Custom1 - Custom2 + (let a = 2 in a),
    Custom4 = Custom1 * 2
in
    Custom4
`;

processQueries(MULTI_QUERY_CODE).catch((error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});
