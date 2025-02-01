# Power Query Parser Documentation

---

## Table of Contents

1. [Introduction](#introduction)
2. [Code Intentions & Purpose](#code-intentions--purpose)
3. [Logic & Design](#logic--design)
4. [Rules & Traps to Avoid](#rules--traps-to-avoid)
5. [Managing Power Query AST Outputs](#managing-power-query-ast-outputs)
6. [Example Inputs & Outputs](#example-inputs--outputs)
7. [Managing Comments in Future](#managing-comments-in-future)
8. [Reference Code](#reference-code)

---

## 1. Introduction

This document provides a detailed overview of the Power Query parser, explaining its logic, rules, expected behavior, and how to manage AST outputs effectively. It is designed to ensure consistent behavior and avoid common pitfalls encountered during development.

---

## 2. Code Intentions & Purpose

The Power Query parser is built to:
- **Correctly split multiple queries pasted from Power BI Desktop** without relying on comments.
- **Accurately extract step dependencies (`references`) and external queries (`external_queries`).**
- **Differentiate external functions (`external_functions`) from external queries.**
- **Handle nested `let ... in ...` expressions properly**, ensuring internal variables are not mistakenly treated as dependencies.
- **Extract original Power Query expressions from the AST**, preserving the exact code structure.
- **Process comments effectively** (though comment handling is postponed until full correctness is ensured).

---

## 3. Logic & Design

### 3.1 Query Splitting

- A query **always starts with `let` and ends with `in <step name>`**.
- Query names are extracted from Power BI Desktop format (`// QueryName`). If multiple queries exist, their names are derived from these comments. However, if only one query is detected, it defaults to `"Query1"`. Query name comments should appear **before the `let` keyword**, and inline comments elsewhere do not affect query splitting.
- Queries should **not** be split based on comments.

### 3.2 Step Extraction

- Steps are **defined by `<step_name> = <expression>`**.
- A step assignment **ends with a comma unless it is the final step before `in`**.
- The final output step is identified **after the `in` keyword**.

### 3.3 Dependency Resolution

- Identifiers inside an expression are checked against **globally defined steps**.
- If an identifier is in the global scope, it is listed in **`references`**.
- If an identifier is **not defined within the query**, it is categorized as **an external query (`external_queries`)**.
- If an identifier represents a **function call (e.g., `HelperFunction(5)`)**, it is added to **`external_functions`**, not `external_queries`.

### 3.4 Handling Nested Let Expressions

- Nested `let ... in ...` blocks **do not define new queries** but are part of a step's expression.
- Variables inside a nested `let` are **local and should not appear in `references`**.
- If a nested `let` references an earlier step in the main query, that step should be listed in `references`.

---

## 4. Rules & Traps to Avoid

### 4.1 Query Detection Mistakes
✅ **Correct**: Detect queries by `let ... in`, **not** by comments.  
❌ **Incorrect**: Splitting queries when encountering `// QueryName` comments.

### 4.2 Dependency Identification Errors
✅ **Correct**: Ensure that **internal variables in nested `let` are not treated as external queries.**  
❌ **Incorrect**: Treating `LocalVar` inside `NestedStep = let LocalVar = Computed + 2 in LocalVar * 2` as a reference.

### 4.3 External Query & Function Differentiation
✅ **Correct**: `HelperFunction(5)` should be in `external_functions`, but **not** `external_queries`.  
❌ **Incorrect**: Listing `HelperFunction` under both `external_queries` and `external_functions`.

---

## 5. Managing Power Query AST Outputs

### 5.1 Understanding AST Structure

- The **root node** is a `LetExpression`, containing:
  - `variableList`: List of steps in the query.
  - `expression`: The final output step.
- Each step (`IdentifierPairedExpression`) has:
  - `key`: The step name.
  - `value`: The assigned expression (can be a `LiteralExpression`, `ArithmeticExpression`, `IdentifierExpression`, or `LetExpression`).

### 5.2 Identifying Step Dependencies

- **IdentifierExpression**: Represents a reference to another step.
  - If it matches a defined step → **add to `references`**.
  - If it does not match a defined step → **add to `external_queries`**.

### 5.3 Differentiating Functions from Queries

- **InvokeExpression** nodes indicate function calls.
- If an `IdentifierExpression` appears inside an `InvokeExpression`, it belongs in `external_functions`, not `external_queries`.

---

## 6. Example Inputs & Outputs

### Example 1 (Multiple Queries)
```powerquery
// Query1
let
    A = 1,
    B = A + 2
in
    B

// Query 2
let
    X = B * 3
in
    X
```

**Expected Output:**
```json
{
    "Query1": {
        "steps": {
            "A": { "expression": "1", "references": [], "external_queries": [], "external_functions": [] },
            "B": { "expression": "A + 2", "references": ["A"], "external_queries": [], "external_functions": [] }
        },
        "output": "B"
    },
    "Query 2": {
        "steps": {
            "X": { "expression": "B * 3", "references": [], "external_queries": ["B"], "external_functions": [] }
        },
        "output": "X"
    }
}

```

### Example 2 (Complex Dependencies & Nested Let Expressions)
```powerquery
let
    Step1 = 10,
    Step2 = Step1 + ExternalData,
    Step3 = let LocalStep = Step2 * 2 in LocalStep + 5
in
    Step3
```

**Expected Output:**
```json
{
    "steps": {
        "Step1": {
            "expression": "10",
            "references": [],
            "external_queries": []
        },
        "Step2": {
            "expression": "Step1 + ExternalData",
            "references": ["Step1"],
            "external_queries": ["ExternalData"]
        },
        "Step3": {
            "expression": "let LocalStep = Step2 * 2 in LocalStep + 5",
            "references": ["Step2"],
            "external_queries": []
        }
    },
    "output": "Step3"
}
```

### Example 3 (Handling Comments & External Functions)
```powerquery
let
    // Base value
    Base = 10, // Inline comment for Base
    
    // Complex calculation using external and internal references
    Computed = Base * HelperFunction(5) + ExternalQuery,
    
    // Nested let expression with local variable shadowing
    NestedStep = let LocalVar = Computed + 2 in LocalVar * 2
in
    NestedStep
```

**Expected Output:**
```json
{
    "steps": {
        "Base": { "expression": "10", "references": [], "external_queries": [], "external_functions": [] },
        "Computed": { "expression": "Base * HelperFunction(5) + ExternalQuery", "references": ["Base"], "external_queries": ["ExternalQuery"], "external_functions": ["HelperFunction"] },
        "NestedStep": { "expression": "let LocalVar = Computed + 2 in LocalVar * 2", "references": ["Computed"], "external_queries": [], "external_functions": [] }
    },
    "output": "NestedStep"
}
```

---

## 7. Managing Comments in Future
- Comments before `let` belong to the query.
- Comments after `let` but before a step belong to that step.
- Inline comments are attached to the same step.
- Future handling should ensure all comments are accurately assigned to queries or steps without duplication.

---

## 8. Reference Code

```python
import re
import json
import requests

# ======================
# 1️⃣ Query Splitting (Final Fixed Version)
# ======================
def split_queries_basic(combined_query):
    """ Splits multiple Power Query scripts pasted from Power BI Desktop into separate named queries. """
    queries = []
    lines = combined_query.split("\n")
    current_name = None
    current_code = []
    
    for line in lines:
        stripped = line.strip()

        # Detect query names (always present when multiple queries exist)
        if stripped.startswith("// ") and len(stripped) > 2:
            if current_name and current_code:
                queries.append({"name": current_name, "code": "\n".join(current_code).strip()})
            current_name = stripped[3:].strip()  # Remove "// " and get query name
            current_code = []
        else:
            current_code.append(line)

    if current_name and current_code:
        queries.append({"name": current_name, "code": "\n".join(current_code).strip()})

    if not queries:
        return [{"name": "Query1", "code": combined_query.strip()}]

    return queries

# ======================
# 2️⃣ API Call (No Change)
# ======================
def fetch_ast_from_worker(power_query_code):
    """ Sends Power Query code to the API and retrieves the AST JSON. """
    WORKER_URL = "https://ast.dev.littlebigfrog.xyz/parse"
    payload = {"code": power_query_code}
    response = requests.post(WORKER_URL, json=payload)

    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Error {response.status_code}: {response.text}")

# ======================
# 3️⃣ Expression Extraction Using AST Token Range
# ======================
def extract_expression(node, original_query):
    """ Extracts the original expression string from AST nodes using tokenRange. """
    if "tokenRange" in node:
        start = node["tokenRange"]["positionStart"]["codeUnit"]
        end = node["tokenRange"]["positionEnd"]["codeUnit"]
        return original_query[start:end].strip()
    
    return "UNKNOWN_EXPRESSION"

# ======================
# 4️⃣ Step and Dependency Extraction
# ======================
def extract_steps(ast, original_query):
    """ Extracts step names, expressions, dependencies, external queries, and external functions. """
    steps = {}
    global_scope = set()  # Track global step names
    external_functions = set()  # Track external function calls

    if ast["kind"] != "LetExpression":
        raise ValueError("Not a valid Power Query let expression!")

    # Collect all global step names
    for element in ast["variableList"]["elements"]:
        step_name = element["node"]["key"]["literal"]
        global_scope.add(step_name)

    # Extract step assignments, references, and dependencies
    for element in ast["variableList"]["elements"]:
        node = element["node"]
        step_name = node["key"]["literal"]
        step_expression = extract_expression(node["value"], original_query)
        references, external_queries, function_calls = extract_references(node["value"], global_scope, set())

        steps[step_name] = {
            "expression": step_expression,
            "references": references,
            "external_queries": external_queries,
            "external_functions": function_calls
        }

    # Extract final output step
    final_output = ast["expression"]["identifier"]["literal"]

    return {
        "steps": steps,
        "output": final_output
    }

# ======================
# 5️⃣ Reference & External Function Detection (Fixed LocalVar Issue)
# ======================
def extract_references(node, global_scope, local_scope):
    """ Extracts identifiers (dependencies), external queries, and external functions. """
    references = set()
    external_queries = set()
    external_functions = set()

    if node["kind"] == "IdentifierExpression":
        identifier = node["identifier"]["literal"]
        if identifier in local_scope:
            pass  # Ignore local variables
        elif identifier in global_scope:
            references.add(identifier)
        else:
            external_queries.add(identifier)
    
    elif node["kind"] == "RecursivePrimaryExpression":
        function_name = node["head"]["identifier"]["literal"]
        external_functions.add(function_name)

    elif node["kind"] == "ArithmeticExpression":
        left_references, left_externals, left_functions = extract_references(node["left"], global_scope, local_scope)
        right_references, right_externals, right_functions = extract_references(node["right"], global_scope, local_scope)
        references.update(left_references, right_references)
        external_queries.update(left_externals, right_externals)
        external_functions.update(left_functions, right_functions)

    elif node["kind"] == "LetExpression":
        # Process nested let expressions without treating their local variables as external
        nested_scope = local_scope.copy()
        for element in node["variableList"]["elements"]:
            nested_var_name = element["node"]["key"]["literal"]
            nested_scope.add(nested_var_name)  # Mark as local variable

        for element in node["variableList"]["elements"]:
            nested_references, nested_externals, nested_functions = extract_references(element["node"]["value"], global_scope, nested_scope)
            references.update(nested_references)
            external_queries.update(nested_externals)
            external_functions.update(nested_functions)

        # Handle the final in-expression of the let block
        in_references, in_externals, in_functions = extract_references(node["expression"], global_scope, nested_scope)
        references.update(in_references)
        external_queries.update(in_externals)
        external_functions.update(in_functions)

    return list(references), list(external_queries - external_functions), list(external_functions)

# ======================
# 6️⃣ Processing Multiple Queries
# ======================
def process_queries(combined_query):
    """ Processes multiple queries by sending them separately to the parser and formatting the results. """
    queries = split_queries_basic(combined_query)
    results = {}

    for query in queries:
        try:
            ast_response = fetch_ast_from_worker(query["code"])
            parsed_output = extract_steps(ast_response["ast"], query["code"])  # Format AST properly
            results[query["name"]] = parsed_output
        except Exception as e:
            results[query["name"]] = {"error": str(e)}

    return results

# ======================
# 🔥 Run the Function
# ======================
multi_query_code = """
// Query1
let
    Base = 10,
    Computed = Base * HelperFunction(5) + ExternalQuery,
    NestedStep = let LocalVar = Computed + 2 in LocalVar * 2
in
    NestedStep

// Query 2
let
    Source = 0
in
    Source
"""

parsed_results = process_queries(multi_query_code)
print(json.dumps(parsed_results, indent=4))

```
9\. Debugging & Testing
------------------------

### Unit Tests

-   The parser should correctly extract steps, dependencies, and external queries.

-   Example: `Step2 = Step1 + ExternalData` should mark `Step1` as a reference and `ExternalData` as an external query.

### Debugging Tips

-   If output looks incorrect, log:

    -   The **raw AST structure** (`print(json.dumps(ast, indent=4))`).

    -   The **token range** used for extracting expressions.

    -   The **list of parsed steps** before dependency resolution.

### Handling API Errors

-   If the AST API request fails (`fetch_ast_from_worker`), the error should be logged with the **Power Query input** for debugging
---

10\. Raw ast exemple
-------------------------------

### Power query code provided

```powerquery
let
    // Base value
    Base = 10, // Inline comment for Base

    // Complex calculation using external and internal references
    Computed = Base * HelperFunction(5) + ExternalQuery,

    // Nested let expression with local variable shadowing
    NestedStep = let
        LocalVar = Computed + 2
    in
        LocalVar * 2
in
    NestedStep
```

### Raw ast returned

```json
{
  "ast": {
    "id": 1,
    "tokenRange": {
      "tokenIndexStart": 0,
      "tokenIndexEnd": 29,
      "positionStart": {
        "codeUnit": 0,
        "lineCodeUnit": 0,
        "lineNumber": 0
      },
      "positionEnd": {
        "codeUnit": 334,
        "lineCodeUnit": 14,
        "lineNumber": 10
      }
    },
    "kind": "LetExpression",
    "isLeaf": false,
    "letConstant": {
      "id": 2,
      "attributeIndex": 0,
      "tokenRange": {
        "tokenIndexStart": 0,
        "tokenIndexEnd": 0,
        "positionStart": {
          "codeUnit": 0,
          "lineCodeUnit": 0,
          "lineNumber": 0
        },
        "positionEnd": {
          "codeUnit": 3,
          "lineCodeUnit": 3,
          "lineNumber": 0
        }
      },
      "kind": "Constant",
      "isLeaf": true,
      "constantKind": "let"
    },
    "variableList": {
      "id": 3,
      "attributeIndex": 1,
      "tokenRange": {
        "tokenIndexStart": 1,
        "tokenIndexEnd": 27,
        "positionStart": {
          "codeUnit": 26,
          "lineCodeUnit": 4,
          "lineNumber": 2
        },
        "positionEnd": {
          "codeUnit": 316,
          "lineCodeUnit": 60,
          "lineNumber": 8
        }
      },
      "kind": "ArrayWrapper",
      "isLeaf": false,
      "elements": [
        {
          "id": 4,
          "attributeIndex": 0,
          "tokenRange": {
            "tokenIndexStart": 1,
            "tokenIndexEnd": 4,
            "positionStart": {
              "codeUnit": 26,
              "lineCodeUnit": 4,
              "lineNumber": 2
            },
            "positionEnd": {
              "codeUnit": 36,
              "lineCodeUnit": 14,
              "lineNumber": 2
            }
          },
          "kind": "Csv",
          "isLeaf": false,
          "node": {
            "id": 5,
            "attributeIndex": 0,
            "tokenRange": {
              "tokenIndexStart": 1,
              "tokenIndexEnd": 3,
              "positionStart": {
                "codeUnit": 26,
                "lineCodeUnit": 4,
                "lineNumber": 2
              },
              "positionEnd": {
                "codeUnit": 35,
                "lineCodeUnit": 13,
                "lineNumber": 2
              }
            },
            "kind": "IdentifierPairedExpression",
            "isLeaf": false,
            "key": {
              "id": 6,
              "attributeIndex": 0,
              "tokenRange": {
                "tokenIndexStart": 1,
                "tokenIndexEnd": 1,
                "positionStart": {
                  "codeUnit": 26,
                  "lineCodeUnit": 4,
                  "lineNumber": 2
                },
                "positionEnd": {
                  "codeUnit": 30,
                  "lineCodeUnit": 8,
                  "lineNumber": 2
                }
              },
              "kind": "Identifier",
              "isLeaf": true,
              "identifierContextKind": "Key",
              "literal": "Base"
            },
            "equalConstant": {
              "id": 7,
              "attributeIndex": 1,
              "tokenRange": {
                "tokenIndexStart": 2,
                "tokenIndexEnd": 2,
                "positionStart": {
                  "codeUnit": 31,
                  "lineCodeUnit": 9,
                  "lineNumber": 2
                },
                "positionEnd": {
                  "codeUnit": 32,
                  "lineCodeUnit": 10,
                  "lineNumber": 2
                }
              },
              "kind": "Constant",
              "isLeaf": true,
              "constantKind": "="
            },
            "value": {
              "id": 9,
              "attributeIndex": 2,
              "tokenRange": {
                "tokenIndexStart": 3,
                "tokenIndexEnd": 3,
                "positionStart": {
                  "codeUnit": 33,
                  "lineCodeUnit": 11,
                  "lineNumber": 2
                },
                "positionEnd": {
                  "codeUnit": 35,
                  "lineCodeUnit": 13,
                  "lineNumber": 2
                }
              },
              "kind": "LiteralExpression",
              "isLeaf": true,
              "literal": "10",
              "literalKind": "Numeric"
            }
          },
          "commaConstant": {
            "id": 10,
            "attributeIndex": 1,
            "tokenRange": {
              "tokenIndexStart": 4,
              "tokenIndexEnd": 4,
              "positionStart": {
                "codeUnit": 35,
                "lineCodeUnit": 13,
                "lineNumber": 2
              },
              "positionEnd": {
                "codeUnit": 36,
                "lineCodeUnit": 14,
                "lineNumber": 2
              }
            },
            "kind": "Constant",
            "isLeaf": true,
            "constantKind": ","
          }
        },
        {
          "id": 11,
          "attributeIndex": 1,
          "tokenRange": {
            "tokenIndexStart": 5,
            "tokenIndexEnd": 15,
            "positionStart": {
              "codeUnit": 139,
              "lineCodeUnit": 4,
              "lineNumber": 5
            },
            "positionEnd": {
              "codeUnit": 191,
              "lineCodeUnit": 56,
              "lineNumber": 5
            }
          },
          "kind": "Csv",
          "isLeaf": false,
          "node": {
            "id": 12,
            "attributeIndex": 0,
            "tokenRange": {
              "tokenIndexStart": 5,
              "tokenIndexEnd": 14,
              "positionStart": {
                "codeUnit": 139,
                "lineCodeUnit": 4,
                "lineNumber": 5
              },
              "positionEnd": {
                "codeUnit": 190,
                "lineCodeUnit": 55,
                "lineNumber": 5
              }
            },
            "kind": "IdentifierPairedExpression",
            "isLeaf": false,
            "key": {
              "id": 13,
              "attributeIndex": 0,
              "tokenRange": {
                "tokenIndexStart": 5,
                "tokenIndexEnd": 5,
                "positionStart": {
                  "codeUnit": 139,
                  "lineCodeUnit": 4,
                  "lineNumber": 5
                },
                "positionEnd": {
                  "codeUnit": 147,
                  "lineCodeUnit": 12,
                  "lineNumber": 5
                }
              },
              "kind": "Identifier",
              "isLeaf": true,
              "identifierContextKind": "Key",
              "literal": "Computed"
            },
            "equalConstant": {
              "id": 14,
              "attributeIndex": 1,
              "tokenRange": {
                "tokenIndexStart": 6,
                "tokenIndexEnd": 6,
                "positionStart": {
                  "codeUnit": 148,
                  "lineCodeUnit": 13,
                  "lineNumber": 5
                },
                "positionEnd": {
                  "codeUnit": 149,
                  "lineCodeUnit": 14,
                  "lineNumber": 5
                }
              },
              "kind": "Constant",
              "isLeaf": true,
              "constantKind": "="
            },
            "value": {
              "kind": "ArithmeticExpression",
              "id": 36,
              "attributeIndex": 2,
              "tokenRange": {
                "tokenIndexStart": 7,
                "tokenIndexEnd": 14,
                "positionStart": {
                  "codeUnit": 150,
                  "lineCodeUnit": 15,
                  "lineNumber": 5
                },
                "positionEnd": {
                  "codeUnit": 190,
                  "lineCodeUnit": 55,
                  "lineNumber": 5
                }
              },
              "isLeaf": false,
              "left": {
                "kind": "ArithmeticExpression",
                "id": 35,
                "attributeIndex": 0,
                "tokenRange": {
                  "tokenIndexStart": 7,
                  "tokenIndexEnd": 12,
                  "positionStart": {
                    "codeUnit": 150,
                    "lineCodeUnit": 15,
                    "lineNumber": 5
                  },
                  "positionEnd": {
                    "codeUnit": 174,
                    "lineCodeUnit": 39,
                    "lineNumber": 5
                  }
                },
                "isLeaf": false,
                "left": {
                  "id": 16,
                  "attributeIndex": 0,
                  "tokenRange": {
                    "tokenIndexStart": 7,
                    "tokenIndexEnd": 7,
                    "positionStart": {
                      "codeUnit": 150,
                      "lineCodeUnit": 15,
                      "lineNumber": 5
                    },
                    "positionEnd": {
                      "codeUnit": 154,
                      "lineCodeUnit": 19,
                      "lineNumber": 5
                    }
                  },
                  "kind": "IdentifierExpression",
                  "isLeaf": false,
                  "identifier": {
                    "id": 17,
                    "attributeIndex": 1,
                    "tokenRange": {
                      "tokenIndexStart": 7,
                      "tokenIndexEnd": 7,
                      "positionStart": {
                        "codeUnit": 150,
                        "lineCodeUnit": 15,
                        "lineNumber": 5
                      },
                      "positionEnd": {
                        "codeUnit": 154,
                        "lineCodeUnit": 19,
                        "lineNumber": 5
                      }
                    },
                    "kind": "Identifier",
                    "isLeaf": true,
                    "identifierContextKind": "Value",
                    "literal": "Base"
                  }
                },
                "operatorConstant": {
                  "id": 19,
                  "attributeIndex": 1,
                  "tokenRange": {
                    "tokenIndexStart": 8,
                    "tokenIndexEnd": 8,
                    "positionStart": {
                      "codeUnit": 155,
                      "lineCodeUnit": 20,
                      "lineNumber": 5
                    },
                    "positionEnd": {
                      "codeUnit": 156,
                      "lineCodeUnit": 21,
                      "lineNumber": 5
                    }
                  },
                  "kind": "Constant",
                  "isLeaf": true,
                  "constantKind": "*"
                },
                "right": {
                  "id": 22,
                  "attributeIndex": 2,
                  "tokenRange": {
                    "tokenIndexStart": 9,
                    "tokenIndexEnd": 12,
                    "positionStart": {
                      "codeUnit": 157,
                      "lineCodeUnit": 22,
                      "lineNumber": 5
                    },
                    "positionEnd": {
                      "codeUnit": 174,
                      "lineCodeUnit": 39,
                      "lineNumber": 5
                    }
                  },
                  "kind": "RecursivePrimaryExpression",
                  "isLeaf": false,
                  "head": {
                    "id": 20,
                    "attributeIndex": 0,
                    "tokenRange": {
                      "tokenIndexStart": 9,
                      "tokenIndexEnd": 9,
                      "positionStart": {
                        "codeUnit": 157,
                        "lineCodeUnit": 22,
                        "lineNumber": 5
                      },
                      "positionEnd": {
                        "codeUnit": 171,
                        "lineCodeUnit": 36,
                        "lineNumber": 5
                      }
                    },
                    "kind": "IdentifierExpression",
                    "isLeaf": false,
                    "identifier": {
                      "id": 21,
                      "attributeIndex": 1,
                      "tokenRange": {
                        "tokenIndexStart": 9,
                        "tokenIndexEnd": 9,
                        "positionStart": {
                          "codeUnit": 157,
                          "lineCodeUnit": 22,
                          "lineNumber": 5
                        },
                        "positionEnd": {
                          "codeUnit": 171,
                          "lineCodeUnit": 36,
                          "lineNumber": 5
                        }
                      },
                      "kind": "Identifier",
                      "isLeaf": true,
                      "identifierContextKind": "Value",
                      "literal": "HelperFunction"
                    }
                  },
                  "recursiveExpressions": {
                    "id": 23,
                    "attributeIndex": 1,
                    "tokenRange": {
                      "tokenIndexStart": 10,
                      "tokenIndexEnd": 12,
                      "positionStart": {
                        "codeUnit": 171,
                        "lineCodeUnit": 36,
                        "lineNumber": 5
                      },
                      "positionEnd": {
                        "codeUnit": 174,
                        "lineCodeUnit": 39,
                        "lineNumber": 5
                      }
                    },
                    "kind": "ArrayWrapper",
                    "isLeaf": false,
                    "elements": [
                      {
                        "id": 24,
                        "attributeIndex": 0,
                        "tokenRange": {
                          "tokenIndexStart": 10,
                          "tokenIndexEnd": 12,
                          "positionStart": {
                            "codeUnit": 171,
                            "lineCodeUnit": 36,
                            "lineNumber": 5
                          },
                          "positionEnd": {
                            "codeUnit": 174,
                            "lineCodeUnit": 39,
                            "lineNumber": 5
                          }
                        },
                        "kind": "InvokeExpression",
                        "isLeaf": false,
                        "openWrapperConstant": {
                          "id": 25,
                          "attributeIndex": 0,
                          "tokenRange": {
                            "tokenIndexStart": 10,
                            "tokenIndexEnd": 10,
                            "positionStart": {
                              "codeUnit": 171,
                              "lineCodeUnit": 36,
                              "lineNumber": 5
                            },
                            "positionEnd": {
                              "codeUnit": 172,
                              "lineCodeUnit": 37,
                              "lineNumber": 5
                            }
                          },
                          "kind": "Constant",
                          "isLeaf": true,
                          "constantKind": "("
                        },
                        "content": {
                          "id": 26,
                          "attributeIndex": 1,
                          "tokenRange": {
                            "tokenIndexStart": 11,
                            "tokenIndexEnd": 11,
                            "positionStart": {
                              "codeUnit": 172,
                              "lineCodeUnit": 37,
                              "lineNumber": 5
                            },
                            "positionEnd": {
                              "codeUnit": 173,
                              "lineCodeUnit": 38,
                              "lineNumber": 5
                            }
                          },
                          "kind": "ArrayWrapper",
                          "isLeaf": false,
                          "elements": [
                            {
                              "id": 27,
                              "attributeIndex": 0,
                              "tokenRange": {
                                "tokenIndexStart": 11,
                                "tokenIndexEnd": 11,
                                "positionStart": {
                                  "codeUnit": 172,
                                  "lineCodeUnit": 37,
                                  "lineNumber": 5
                                },
                                "positionEnd": {
                                  "codeUnit": 173,
                                  "lineCodeUnit": 38,
                                  "lineNumber": 5
                                }
                              },
                              "kind": "Csv",
                              "isLeaf": false,
                              "node": {
                                "id": 29,
                                "attributeIndex": 0,
                                "tokenRange": {
                                  "tokenIndexStart": 11,
                                  "tokenIndexEnd": 11,
                                  "positionStart": {
                                    "codeUnit": 172,
                                    "lineCodeUnit": 37,
                                    "lineNumber": 5
                                  },
                                  "positionEnd": {
                                    "codeUnit": 173,
                                    "lineCodeUnit": 38,
                                    "lineNumber": 5
                                  }
                                },
                                "kind": "LiteralExpression",
                                "isLeaf": true,
                                "literal": "5",
                                "literalKind": "Numeric"
                              }
                            }
                          ]
                        },
                        "closeWrapperConstant": {
                          "id": 30,
                          "attributeIndex": 2,
                          "tokenRange": {
                            "tokenIndexStart": 12,
                            "tokenIndexEnd": 12,
                            "positionStart": {
                              "codeUnit": 173,
                              "lineCodeUnit": 38,
                              "lineNumber": 5
                            },
                            "positionEnd": {
                              "codeUnit": 174,
                              "lineCodeUnit": 39,
                              "lineNumber": 5
                            }
                          },
                          "kind": "Constant",
                          "isLeaf": true,
                          "constantKind": ")"
                        }
                      }
                    ]
                  }
                }
              },
              "operatorConstant": {
                "id": 32,
                "attributeIndex": 1,
                "tokenRange": {
                  "tokenIndexStart": 13,
                  "tokenIndexEnd": 13,
                  "positionStart": {
                    "codeUnit": 175,
                    "lineCodeUnit": 40,
                    "lineNumber": 5
                  },
                  "positionEnd": {
                    "codeUnit": 176,
                    "lineCodeUnit": 41,
                    "lineNumber": 5
                  }
                },
                "kind": "Constant",
                "isLeaf": true,
                "constantKind": "+"
              },
              "right": {
                "id": 33,
                "attributeIndex": 2,
                "tokenRange": {
                  "tokenIndexStart": 14,
                  "tokenIndexEnd": 14,
                  "positionStart": {
                    "codeUnit": 177,
                    "lineCodeUnit": 42,
                    "lineNumber": 5
                  },
                  "positionEnd": {
                    "codeUnit": 190,
                    "lineCodeUnit": 55,
                    "lineNumber": 5
                  }
                },
                "kind": "IdentifierExpression",
                "isLeaf": false,
                "identifier": {
                  "id": 34,
                  "attributeIndex": 1,
                  "tokenRange": {
                    "tokenIndexStart": 14,
                    "tokenIndexEnd": 14,
                    "positionStart": {
                      "codeUnit": 177,
                      "lineCodeUnit": 42,
                      "lineNumber": 5
                    },
                    "positionEnd": {
                      "codeUnit": 190,
                      "lineCodeUnit": 55,
                      "lineNumber": 5
                    }
                  },
                  "kind": "Identifier",
                  "isLeaf": true,
                  "identifierContextKind": "Value",
                  "literal": "ExternalQuery"
                }
              }
            }
          },
          "commaConstant": {
            "id": 37,
            "attributeIndex": 1,
            "tokenRange": {
              "tokenIndexStart": 15,
              "tokenIndexEnd": 15,
              "positionStart": {
                "codeUnit": 190,
                "lineCodeUnit": 55,
                "lineNumber": 5
              },
              "positionEnd": {
                "codeUnit": 191,
                "lineCodeUnit": 56,
                "lineNumber": 5
              }
            },
            "kind": "Constant",
            "isLeaf": true,
            "constantKind": ","
          }
        },
        {
          "id": 38,
          "attributeIndex": 2,
          "tokenRange": {
            "tokenIndexStart": 16,
            "tokenIndexEnd": 27,
            "positionStart": {
              "codeUnit": 260,
              "lineCodeUnit": 4,
              "lineNumber": 8
            },
            "positionEnd": {
              "codeUnit": 316,
              "lineCodeUnit": 60,
              "lineNumber": 8
            }
          },
          "kind": "Csv",
          "isLeaf": false,
          "node": {
            "id": 39,
            "attributeIndex": 0,
            "tokenRange": {
              "tokenIndexStart": 16,
              "tokenIndexEnd": 27,
              "positionStart": {
                "codeUnit": 260,
                "lineCodeUnit": 4,
                "lineNumber": 8
              },
              "positionEnd": {
                "codeUnit": 316,
                "lineCodeUnit": 60,
                "lineNumber": 8
              }
            },
            "kind": "IdentifierPairedExpression",
            "isLeaf": false,
            "key": {
              "id": 40,
              "attributeIndex": 0,
              "tokenRange": {
                "tokenIndexStart": 16,
                "tokenIndexEnd": 16,
                "positionStart": {
                  "codeUnit": 260,
                  "lineCodeUnit": 4,
                  "lineNumber": 8
                },
                "positionEnd": {
                  "codeUnit": 270,
                  "lineCodeUnit": 14,
                  "lineNumber": 8
                }
              },
              "kind": "Identifier",
              "isLeaf": true,
              "identifierContextKind": "Key",
              "literal": "NestedStep"
            },
            "equalConstant": {
              "id": 41,
              "attributeIndex": 1,
              "tokenRange": {
                "tokenIndexStart": 17,
                "tokenIndexEnd": 17,
                "positionStart": {
                  "codeUnit": 271,
                  "lineCodeUnit": 15,
                  "lineNumber": 8
                },
                "positionEnd": {
                  "codeUnit": 272,
                  "lineCodeUnit": 16,
                  "lineNumber": 8
                }
              },
              "kind": "Constant",
              "isLeaf": true,
              "constantKind": "="
            },
            "value": {
              "id": 42,
              "attributeIndex": 2,
              "tokenRange": {
                "tokenIndexStart": 18,
                "tokenIndexEnd": 27,
                "positionStart": {
                  "codeUnit": 273,
                  "lineCodeUnit": 17,
                  "lineNumber": 8
                },
                "positionEnd": {
                  "codeUnit": 316,
                  "lineCodeUnit": 60,
                  "lineNumber": 8
                }
              },
              "kind": "LetExpression",
              "isLeaf": false,
              "letConstant": {
                "id": 43,
                "attributeIndex": 0,
                "tokenRange": {
                  "tokenIndexStart": 18,
                  "tokenIndexEnd": 18,
                  "positionStart": {
                    "codeUnit": 273,
                    "lineCodeUnit": 17,
                    "lineNumber": 8
                  },
                  "positionEnd": {
                    "codeUnit": 276,
                    "lineCodeUnit": 20,
                    "lineNumber": 8
                  }
                },
                "kind": "Constant",
                "isLeaf": true,
                "constantKind": "let"
              },
              "variableList": {
                "id": 44,
                "attributeIndex": 1,
                "tokenRange": {
                  "tokenIndexStart": 19,
                  "tokenIndexEnd": 23,
                  "positionStart": {
                    "codeUnit": 277,
                    "lineCodeUnit": 21,
                    "lineNumber": 8
                  },
                  "positionEnd": {
                    "codeUnit": 300,
                    "lineCodeUnit": 44,
                    "lineNumber": 8
                  }
                },
                "kind": "ArrayWrapper",
                "isLeaf": false,
                "elements": [
                  {
                    "id": 45,
                    "attributeIndex": 0,
                    "tokenRange": {
                      "tokenIndexStart": 19,
                      "tokenIndexEnd": 23,
                      "positionStart": {
                        "codeUnit": 277,
                        "lineCodeUnit": 21,
                        "lineNumber": 8
                      },
                      "positionEnd": {
                        "codeUnit": 300,
                        "lineCodeUnit": 44,
                        "lineNumber": 8
                      }
                    },
                    "kind": "Csv",
                    "isLeaf": false,
                    "node": {
                      "id": 46,
                      "attributeIndex": 0,
                      "tokenRange": {
                        "tokenIndexStart": 19,
                        "tokenIndexEnd": 23,
                        "positionStart": {
                          "codeUnit": 277,
                          "lineCodeUnit": 21,
                          "lineNumber": 8
                        },
                        "positionEnd": {
                          "codeUnit": 300,
                          "lineCodeUnit": 44,
                          "lineNumber": 8
                        }
                      },
                      "kind": "IdentifierPairedExpression",
                      "isLeaf": false,
                      "key": {
                        "id": 47,
                        "attributeIndex": 0,
                        "tokenRange": {
                          "tokenIndexStart": 19,
                          "tokenIndexEnd": 19,
                          "positionStart": {
                            "codeUnit": 277,
                            "lineCodeUnit": 21,
                            "lineNumber": 8
                          },
                          "positionEnd": {
                            "codeUnit": 285,
                            "lineCodeUnit": 29,
                            "lineNumber": 8
                          }
                        },
                        "kind": "Identifier",
                        "isLeaf": true,
                        "identifierContextKind": "Key",
                        "literal": "LocalVar"
                      },
                      "equalConstant": {
                        "id": 48,
                        "attributeIndex": 1,
                        "tokenRange": {
                          "tokenIndexStart": 20,
                          "tokenIndexEnd": 20,
                          "positionStart": {
                            "codeUnit": 286,
                            "lineCodeUnit": 30,
                            "lineNumber": 8
                          },
                          "positionEnd": {
                            "codeUnit": 287,
                            "lineCodeUnit": 31,
                            "lineNumber": 8
                          }
                        },
                        "kind": "Constant",
                        "isLeaf": true,
                        "constantKind": "="
                      },
                      "value": {
                        "kind": "ArithmeticExpression",
                        "id": 55,
                        "attributeIndex": 2,
                        "tokenRange": {
                          "tokenIndexStart": 21,
                          "tokenIndexEnd": 23,
                          "positionStart": {
                            "codeUnit": 288,
                            "lineCodeUnit": 32,
                            "lineNumber": 8
                          },
                          "positionEnd": {
                            "codeUnit": 300,
                            "lineCodeUnit": 44,
                            "lineNumber": 8
                          }
                        },
                        "isLeaf": false,
                        "left": {
                          "id": 50,
                          "attributeIndex": 0,
                          "tokenRange": {
                            "tokenIndexStart": 21,
                            "tokenIndexEnd": 21,
                            "positionStart": {
                              "codeUnit": 288,
                              "lineCodeUnit": 32,
                              "lineNumber": 8
                            },
                            "positionEnd": {
                              "codeUnit": 296,
                              "lineCodeUnit": 40,
                              "lineNumber": 8
                            }
                          },
                          "kind": "IdentifierExpression",
                          "isLeaf": false,
                          "identifier": {
                            "id": 51,
                            "attributeIndex": 1,
                            "tokenRange": {
                              "tokenIndexStart": 21,
                              "tokenIndexEnd": 21,
                              "positionStart": {
                                "codeUnit": 288,
                                "lineCodeUnit": 32,
                                "lineNumber": 8
                              },
                              "positionEnd": {
                                "codeUnit": 296,
                                "lineCodeUnit": 40,
                                "lineNumber": 8
                              }
                            },
                            "kind": "Identifier",
                            "isLeaf": true,
                            "identifierContextKind": "Value",
                            "literal": "Computed"
                          }
                        },
                        "operatorConstant": {
                          "id": 53,
                          "attributeIndex": 1,
                          "tokenRange": {
                            "tokenIndexStart": 22,
                            "tokenIndexEnd": 22,
                            "positionStart": {
                              "codeUnit": 297,
                              "lineCodeUnit": 41,
                              "lineNumber": 8
                            },
                            "positionEnd": {
                              "codeUnit": 298,
                              "lineCodeUnit": 42,
                              "lineNumber": 8
                            }
                          },
                          "kind": "Constant",
                          "isLeaf": true,
                          "constantKind": "+"
                        },
                        "right": {
                          "id": 54,
                          "attributeIndex": 2,
                          "tokenRange": {
                            "tokenIndexStart": 23,
                            "tokenIndexEnd": 23,
                            "positionStart": {
                              "codeUnit": 299,
                              "lineCodeUnit": 43,
                              "lineNumber": 8
                            },
                            "positionEnd": {
                              "codeUnit": 300,
                              "lineCodeUnit": 44,
                              "lineNumber": 8
                            }
                          },
                          "kind": "LiteralExpression",
                          "isLeaf": true,
                          "literal": "2",
                          "literalKind": "Numeric"
                        }
                      }
                    }
                  }
                ]
              },
              "inConstant": {
                "id": 56,
                "attributeIndex": 2,
                "tokenRange": {
                  "tokenIndexStart": 24,
                  "tokenIndexEnd": 24,
                  "positionStart": {
                    "codeUnit": 301,
                    "lineCodeUnit": 45,
                    "lineNumber": 8
                  },
                  "positionEnd": {
                    "codeUnit": 303,
                    "lineCodeUnit": 47,
                    "lineNumber": 8
                  }
                },
                "kind": "Constant",
                "isLeaf": true,
                "constantKind": "in"
              },
              "expression": {
                "kind": "ArithmeticExpression",
                "id": 63,
                "attributeIndex": 3,
                "tokenRange": {
                  "tokenIndexStart": 25,
                  "tokenIndexEnd": 27,
                  "positionStart": {
                    "codeUnit": 304,
                    "lineCodeUnit": 48,
                    "lineNumber": 8
                  },
                  "positionEnd": {
                    "codeUnit": 316,
                    "lineCodeUnit": 60,
                    "lineNumber": 8
                  }
                },
                "isLeaf": false,
                "left": {
                  "id": 58,
                  "attributeIndex": 0,
                  "tokenRange": {
                    "tokenIndexStart": 25,
                    "tokenIndexEnd": 25,
                    "positionStart": {
                      "codeUnit": 304,
                      "lineCodeUnit": 48,
                      "lineNumber": 8
                    },
                    "positionEnd": {
                      "codeUnit": 312,
                      "lineCodeUnit": 56,
                      "lineNumber": 8
                    }
                  },
                  "kind": "IdentifierExpression",
                  "isLeaf": false,
                  "identifier": {
                    "id": 59,
                    "attributeIndex": 1,
                    "tokenRange": {
                      "tokenIndexStart": 25,
                      "tokenIndexEnd": 25,
                      "positionStart": {
                        "codeUnit": 304,
                        "lineCodeUnit": 48,
                        "lineNumber": 8
                      },
                      "positionEnd": {
                        "codeUnit": 312,
                        "lineCodeUnit": 56,
                        "lineNumber": 8
                      }
                    },
                    "kind": "Identifier",
                    "isLeaf": true,
                    "identifierContextKind": "Value",
                    "literal": "LocalVar"
                  }
                },
                "operatorConstant": {
                  "id": 61,
                  "attributeIndex": 1,
                  "tokenRange": {
                    "tokenIndexStart": 26,
                    "tokenIndexEnd": 26,
                    "positionStart": {
                      "codeUnit": 313,
                      "lineCodeUnit": 57,
                      "lineNumber": 8
                    },
                    "positionEnd": {
                      "codeUnit": 314,
                      "lineCodeUnit": 58,
                      "lineNumber": 8
                    }
                  },
                  "kind": "Constant",
                  "isLeaf": true,
                  "constantKind": "*"
                },
                "right": {
                  "id": 62,
                  "attributeIndex": 2,
                  "tokenRange": {
                    "tokenIndexStart": 27,
                    "tokenIndexEnd": 27,
                    "positionStart": {
                      "codeUnit": 315,
                      "lineCodeUnit": 59,
                      "lineNumber": 8
                    },
                    "positionEnd": {
                      "codeUnit": 316,
                      "lineCodeUnit": 60,
                      "lineNumber": 8
                    }
                  },
                  "kind": "LiteralExpression",
                  "isLeaf": true,
                  "literal": "2",
                  "literalKind": "Numeric"
                }
              }
            }
          }
        }
      ]
    },
    "inConstant": {
      "id": 64,
      "attributeIndex": 2,
      "tokenRange": {
        "tokenIndexStart": 28,
        "tokenIndexEnd": 28,
        "positionStart": {
          "codeUnit": 317,
          "lineCodeUnit": 0,
          "lineNumber": 9
        },
        "positionEnd": {
          "codeUnit": 319,
          "lineCodeUnit": 2,
          "lineNumber": 9
        }
      },
      "kind": "Constant",
      "isLeaf": true,
      "constantKind": "in"
    },
    "expression": {
      "id": 66,
      "attributeIndex": 3,
      "tokenRange": {
        "tokenIndexStart": 29,
        "tokenIndexEnd": 29,
        "positionStart": {
          "codeUnit": 324,
          "lineCodeUnit": 4,
          "lineNumber": 10
        },
        "positionEnd": {
          "codeUnit": 334,
          "lineCodeUnit": 14,
          "lineNumber": 10
        }
      },
      "kind": "IdentifierExpression",
      "isLeaf": false,
      "identifier": {
        "id": 67,
        "attributeIndex": 1,
        "tokenRange": {
          "tokenIndexStart": 29,
          "tokenIndexEnd": 29,
          "positionStart": {
            "codeUnit": 324,
            "lineCodeUnit": 4,
            "lineNumber": 10
          },
          "positionEnd": {
            "codeUnit": 334,
            "lineCodeUnit": 14,
            "lineNumber": 10
          }
        },
        "kind": "Identifier",
        "isLeaf": true,
        "identifierContextKind": "Value",
        "literal": "NestedStep"
      }
    }
  }
}
```

* * * * *

This document serves as a reference for understanding and maintaining the Power Query parser while avoiding past mistakes.
