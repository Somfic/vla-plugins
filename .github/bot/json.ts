// @deno-types="npm:@types/json-to-ast"
import parse_json, { ASTNode, ObjectNode, PropertyNode } from "npm:json-to-ast";

export function find_line_number(json: string, key: string): parse_json.Location {
    const line_numbers = find_all_line_numbers(json);
    const node = line_numbers.find((x) => x.key == key);
    return (
        node?.loc ?? {
            source: null,
            start: { line: 1, column: 0, offset: 0 },
            end: { line: 1, column: 0, offset: 0 },
        }
    );
}

export function find_all_line_numbers(json: string): { key: string; loc: parse_json.Location }[] {
    const root = parse_json(json);
    return parse_node(root).map((value) => ({ key: value.key.slice(1), loc: value.loc }));
}

function parse_node(node: ASTNode, prefix = ""): { key: string; loc: parse_json.Location }[] {
    if (node.type == "Object") {
        const value = node as ObjectNode;
        return value.children.flatMap((x) => parse_node(x, prefix));
    }

    if (node.type == "Property") {
        const value = node as PropertyNode;
        const children = parse_node(value.value, prefix + "+" + value.key.value);

        if (value.loc) {
            return [{ key: prefix + "+" + value.key.value, loc: value.loc }, ...children];
        } else {
            return [...children];
        }
    }

    return [];
}
