import { DefaultSettings, TaskUtils } from '@microsoft/powerquery-parser';
import * as fs from 'fs';

// Type definition for step information
type StepInfo = {
  references: string[];
  external_queries: string[];
  code: string;
  used_for_output: boolean;
};

// Type definition for query information
type QueryInfo = {
  name: string;
  steps: Record<string, StepInfo>;
  external_queries: string[];
  output_step: string;
};

// **Handles both named and unnamed queries**
function splitQueries(combinedQuery: string): { name: string; code: string }[] {
  const queries: { name: string; code: string }[] = [];
  const queryBlocks = combinedQuery.split(/\n/);

  let currentQueryName: string | null = null;
  let currentQueryLines: string[] = [];

  for (const line of queryBlocks) {
    const strippedLine = line.trim();

    // **Detect a named query (e.g., "// Query1")**
    if (strippedLine.startsWith('//') && strippedLine.length > 3) {
      if (currentQueryName && currentQueryLines.length > 0) {
        queries.push({
          name: currentQueryName,
          code: currentQueryLines.join('\n').trim(),
        });
      }
      currentQueryName = strippedLine.replace('//', '').trim();
      currentQueryLines = [];
    } else {
      currentQueryLines.push(line);
    }
  }

  // **Ensure the last detected query is stored**
  if (currentQueryName && currentQueryLines.length > 0) {
    queries.push({
      name: currentQueryName,
      code: currentQueryLines.join('\n').trim(),
    });
  }

  // **Assign "Query1" if no named queries exist**
  if (queries.length === 0) {
    queries.push({ name: 'Query1', code: combinedQuery.trim() });
  }

  return queries;
}

// **Extracts Power Query steps with dependency tracking**
function extractSteps(
  ast: any,
  originalQuery: string
): Record<string, StepInfo> {
  const steps: Record<string, StepInfo> = {};
  const externalQueries = new Set<string>();

  if (
    ast.kind !== 'LetExpression' ||
    !ast.variableList ||
    ast.variableList.kind !== 'ArrayWrapper' ||
    !ast.expression ||
    ast.expression.kind !== 'IdentifierExpression'
  ) {
    console.error('❌ Invalid LetExpression structure');
    return {};
  }

  const stepNames: string[] = [];
  const finalOutputStep = ast.expression.identifier.literal;

  // **First pass: Collect step names**
  for (const step of ast.variableList.elements) {
    if (
      step.kind === 'Csv' &&
      step.node?.kind === 'IdentifierPairedExpression'
    ) {
      const stepName = step.node.key.literal;
      stepNames.push(stepName);
      steps[stepName] = {
        references: [],
        external_queries: [],
        code: '',
        used_for_output: false,
      };
    }
  }

  // **Second pass: Extract references, external queries, and step code**
  const dependencies: Record<string, Set<string>> = {};
  for (const step of ast.variableList.elements) {
    if (
      step.kind === 'Csv' &&
      step.node?.kind === 'IdentifierPairedExpression'
    ) {
      const stepName = step.node.key.literal;
      const stepInfo = steps[stepName];
      const references = new Set<string>();

      // **Extract full step code using token range**
      const valueNode = step.node.value;
      if (
        valueNode?.tokenRange?.positionStart?.codeUnit &&
        valueNode?.tokenRange?.positionEnd?.codeUnit
      ) {
        const start = valueNode.tokenRange.positionStart.codeUnit - 1;
        const end = valueNode.tokenRange.positionEnd.codeUnit;
        stepInfo.code = originalQuery.slice(start, end).trim();
      }

      // **Traverse AST to find references**
      const stack: any[] = [step.node.value];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;

        if (typeof current === 'object') {
          // **Detect step references**
          if (
            current.kind === 'IdentifierExpression' &&
            current.identifier?.literal
          ) {
            const refName = current.identifier.literal;
            if (stepNames.includes(refName)) {
              references.add(refName);
            } else {
              externalQueries.add(refName); // External query detected
            }
          }

          // **Add children to stack**
          Object.values(current).forEach((child) => {
            if (child && typeof child === 'object') {
              stack.push(child);
            }
          });
        }
      }

      // **Store references and external queries**
      dependencies[stepName] = references;
      stepInfo.references = stepNames.filter((name) => references.has(name));
      stepInfo.external_queries = Array.from(externalQueries);
    }
  }

  // **Third pass: Identify used steps for the final output**
  const usedSteps = new Set<string>();

  function trackUsedSteps(stepName: string) {
    if (usedSteps.has(stepName) || !(stepName in dependencies)) {
      return;
    }
    usedSteps.add(stepName);
    dependencies[stepName].forEach((ref) => trackUsedSteps(ref));
  }

  trackUsedSteps(finalOutputStep);

  // **Mark used steps**
  for (const stepName of stepNames) {
    steps[stepName].used_for_output = usedSteps.has(stepName);
  }

  return steps;
}

// **Processes multiple queries with unnamed query handling**
async function processQueries(fullQuery: string) {
  const queries = splitQueries(fullQuery);
  const queryResults: Record<string, Record<string, StepInfo>> = {};

  for (const { name, code } of queries) {
    const task = await TaskUtils.tryLexParse(DefaultSettings, code);

    if (TaskUtils.isParseStageOk(task)) {
      const ast = task.ast;
      queryResults[name] = extractSteps(ast, code);
    } else {
      console.error(`❌ Parsing failed for ${name}`);
    }
  }

  // **Save results**
  fs.writeFileSync('queries.json', JSON.stringify(queryResults, null, 4));
  console.log('✅ Processed queries saved to queries.json');
}

// **Example: Queries copied from Power BI Desktop**
const multiQueryCode = `
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

// **Execute query processing**
processQueries(multiQueryCode);
