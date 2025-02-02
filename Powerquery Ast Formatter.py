# Define a dynamic AST node formatter for Power Query
class ASTNodeFormatterDynamic:
    def __init__(self, ast):
        self.ast = ast
        self.step_references = self.extract_step_references()

    def extract_step_references(self):
        """Extracts step dependencies by analyzing references inside function calls and arguments."""
        references = {}

        if "variableList" in self.ast:
            step_definitions = {node["key"]["literal"]: node for node in self.ast["variableList"]["elements"] 
                               if node["kind"] == "IdentifierPairedExpression"}

            for step_name, node in step_definitions.items():
                referenced_steps = set()

                def extract_identifiers(expression):
                    if isinstance(expression, dict):
                        if expression.get("kind") == "IdentifierExpression":
                            return [expression["identifier"]["literal"]]
                        elif expression.get("kind") in ["ArithmeticExpression", "RecursivePrimaryExpression", "InvokeExpression"]:
                            identifiers = []
                            for key in ["left", "right", "head", "content"]:
                                if key in expression:
                                    identifiers += extract_identifiers(expression[key])
                            if "recursiveExpressions" in expression:
                                for expr in expression["recursiveExpressions"]["elements"]:
                                    identifiers += extract_identifiers(expr)
                            return identifiers
                        elif expression.get("kind") == "ArrayWrapper":
                            return [extract_identifiers(el) for el in expression.get("elements", [])]
                    return []

                if "value" in node:
                    step_references = extract_identifiers(node["value"])
                    referenced_steps.update(set(step_references) & set(step_definitions.keys()))
                references[step_name] = list(referenced_steps)

        return references

    def format_node(self, node, depth=0):
        """Recursively format a given AST node."""
        if not isinstance(node, dict):
            return str(node)

        node_kind = node.get("kind", "Unknown")
        formatted_output = ""

        if node_kind == "IdentifierPairedExpression":
            key = node["key"]["literal"]
            value_formatted = self.format_node(node["value"], depth + 1)
            references = self.step_references.get(key, [])
            references_str = f"  - References: {references if references else 'None'}"
            formatted_output += f"{'  ' * depth}{key} = {value_formatted}\n{references_str}\n"
        elif node_kind == "LetExpression":
            expressions = [self.format_node(expr, depth + 1) for expr in node.get("expressions", {}).get("elements", [])]
            formatted_output += f"{'  ' * depth}Let\n{''.join(expressions)}\n{'  ' * depth}In"
        elif node_kind == "ListExpression":
            elements = [self.format_node(el, depth + 1) for el in node.get("elements", [])]
            formatted_output += f"List({', '.join(elements)})"
        elif node_kind == "FunctionExpression":
            parameters = [self.format_node(param, depth + 1) for param in node.get("parameters", {}).get("elements", [])]
            body = self.format_node(node.get("body", "Unknown Body"), depth + 1)
            formatted_output += f"Function({', '.join(parameters)}) => {body}"
        elif node_kind in ["ArithmeticExpression", "RecursivePrimaryExpression", "InvokeExpression", "ArrayWrapper", "IdentifierExpression", "LiteralExpression"]:
            formatted_output += self.format_node_based_on_kind(node, depth)
        else:
            formatted_output += f"{'  ' * depth}{node_kind} (Unhandled Node)"

        return formatted_output

    def format_node_based_on_kind(self, node, depth):
        """Handles specific formatting based on node kind."""
        kind = node.get("kind", "Unknown")
        formatted_output = ""

        if kind == "ArithmeticExpression":
            left = self.format_node(node.get("left", "Unknown Left"), depth + 1)
            operator = node.get("operatorConstant", {}).get("constantKind", "?")
            right = self.format_node(node.get("right", "Unknown Right"), depth + 1)
            formatted_output = f"({left} {operator} {right})"
        elif kind == "RecursivePrimaryExpression":
            head = self.format_node(node.get("head"), depth)
            recursive_expressions = [self.format_node(expr, depth + 1) for expr in node.get("recursiveExpressions", {}).get("elements", [])]
            formatted_output = f"{head}({', '.join(recursive_expressions)})"
        elif kind == "InvokeExpression":
            content = self.format_node(node.get("content"), depth + 1)
            formatted_output = f"Invoke({content})"
        elif kind == "ArrayWrapper":
            elements = [self.format_node(el, depth + 1) for el in node.get("elements", [])]
            formatted_output = f"{', '.join(elements)}"
        elif kind == "IdentifierExpression":
            formatted_output = node["identifier"]["literal"]
        elif kind == "LiteralExpression":
            formatted_output = str(node["literal"])

        return formatted_output

    def format_query_steps(self):
        """Extract and format all steps from the AST dynamically."""
        steps = []
        if "variableList" in self.ast:
            for node in self.ast["variableList"]["elements"]:
                formatted_step = self.format_node(node)
                steps.append(formatted_step)
        return "\n".join(steps)
