// May only modify the registry.json file
// May only modify the key "{pr_owner}" in the registry.json file

import { Plugin, Registry } from "./models.ts";
import { ERROR, check_modifications_are_allowed, get_modifications } from "./bot.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertArrayIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { find_all_line_numbers, find_line_number } from "./json.ts";

function plugin(): Plugin {
    return {
        name: "New Plugin",
        authors: ["Author"],
        description: "Description",
        isDeprecated: false,
        categories: ["Category"],
        keywords: ["Keyword"],
        urls: {
            repository: "https://github.com",
            readme: "https://github.com",
        },
        release: {
            stable: {
                signature: "signature",
                version: "1.0.0",
                url: "https://github.com",
            },
        },
    };
}

Deno.test("Detects a new plugin", () => {
    const a = plugin();

    const before: Registry = {};
    const after: Registry = { a };

    const modifications = get_modifications(before, after);

    assertArrayIncludes(modifications, [{ plugin: "a", type: "create" }]);
    assertEquals(modifications.length, 1);
});

Deno.test("Detects a deleted plugin", () => {
    const a = plugin();

    const before: Registry = { a };
    const after: Registry = {};

    const modifications = get_modifications(before, after);

    assertArrayIncludes(modifications, [{ plugin: "a", type: "delete" }]);
    assertEquals(modifications.length, 1);
});

Deno.test("Detects a modified plugin", () => {
    const a = plugin();
    const a_after = { ...a, name: "Modified Plugin" };

    const before: Registry = { a };
    const after: Registry = { a: a_after };

    const modifications = get_modifications(before, after);

    assertArrayIncludes(modifications, [{ plugin: "a", field: "name", before: "New Plugin", after: "Modified Plugin", type: "modify" }]);
    assertEquals(modifications.length, 1);
});

Deno.test("Does not allow modifications to multiple plugins", () => {
    const a = plugin();
    const b = plugin();

    const a_after = { ...a, name: "Modified Plugin" };
    const b_after = { ...b, name: "Modified Plugin" };

    const before: Registry = { a, b };
    const after: Registry = { a: a_after, b: b_after };

    const modifications = get_modifications(before, after);
    const errors = check_modifications_are_allowed(modifications, before);

    assertArrayIncludes(
        errors.map((x) => x.body),
        [ERROR.MULTIPLE_PLUGINS_MODIFIED]
    );
});

Deno.test("Does not allow modifications to unowned plugins", () => {
    const a = { ...plugin(), authors: ["Other Author"] };
    const b = plugin();

    const a_after = { ...a, name: "Modified Plugin" };

    const before: Registry = { a, b };
    const after: Registry = { a: a_after, b };

    const modifications = get_modifications(before, after);
    const errors = check_modifications_are_allowed(modifications, before);

    assertArrayIncludes(
        errors.map((x) => x.body),
        [ERROR.UNOWNED_PLUGIN_MODIFIED]
    );
});
