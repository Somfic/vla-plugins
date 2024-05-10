import { Octokit } from "https://esm.sh/octokit@4.0.2?dts";
import { find_line_number } from "./json.ts";
import { Problem, Registry } from "./models.ts";

export const ERROR = {
    TOUCHED_NON_REGISTRY_FILE: "Only the registry.json file may be modified",
    MULTIPLE_PLUGINS_MODIFIED: "Only one plugin may be modified at a time",
    UNOWNED_PLUGIN_MODIFIED: "You may only modify plugins you own",
};

export function check_modifications_are_allowed(modifications: Modification[], original: Registry, modified_file: string = "", author: string = "Author", changed_files: string[] = ["registry.json"]): Problem[] {
    if (modifications.length === 0) {
        return [];
    }

    const errors: Problem[] = [];

    // Check that only the registry.json file is modified
    changed_files
        .filter((x) => x != "registry.json")
        .forEach((file) => {
            return [{ path: file, body: ERROR.TOUCHED_NON_REGISTRY_FILE }];
        });

    // Check that only one plugin is modified at a time by checking the plugin field
    const modified_plugins = modifications.map((modification) => modification.plugin);
    const unique_modified_plugins = [...new Set(modified_plugins)];
    if (unique_modified_plugins.length > 1) {
        unique_modified_plugins.forEach((plugin) => {
            const lines = find_line_number(modified_file, plugin);
            errors.push({ path: "registry.json", body: ERROR.MULTIPLE_PLUGINS_MODIFIED, line: lines?.start.line });
        });
        return errors;
    }

    const plugin_id = unique_modified_plugins[0];
    let original_plugin = original[unique_modified_plugins[0]];

    if (modifications.some((m) => m.type === "create")) {
        original_plugin = JSON.parse(modified_file)[plugin_id];
    }

    // Check that the author owns the plugin being modified
    if (!original_plugin?.authors.map((x) => x.toLowerCase())?.includes(author.toLowerCase())) {
        errors.push({ path: "registry.json", body: ERROR.UNOWNED_PLUGIN_MODIFIED, line: find_line_number(modified_file, `${plugin_id}+authors`)?.start.line });
    }

    // Check that the plugin has all the required fields
    const required_fields = ["name", "authors", "description", "categories", "keywords", "urls", "release"];
    required_fields.forEach((field) => {
        if (!Object.keys(original_plugin).includes(field)) {
            errors.push({ path: "registry.json", body: `The ${field} field is required`, line: find_line_number(modified_file, plugin_id)?.end.line });
        }
    });

    return errors;
}

export function get_modifications(original: Registry, updated: Registry): Modification[] {
    const modifications: Modification[] = [];

    const deleted_plugins = Object.keys(original).filter((plugin) => !updated[plugin]);
    const new_plugins = Object.keys(updated).filter((plugin) => !original[plugin]);
    const modified_plugins = Object.keys(updated).filter((plugin) => {
        if (!original[plugin]) {
            return false;
        }
        const original_plugin = original[plugin];
        const updated_plugin = updated[plugin];

        return JSON.stringify(original_plugin) !== JSON.stringify(updated_plugin);
    });

    deleted_plugins.forEach((plugin) => {
        modifications.push({ plugin, type: "delete" });
    });

    new_plugins.forEach((plugin) => {
        modifications.push({ plugin, type: "create" });
    });

    modified_plugins.forEach((plugin) => {
        const original_plugin = original[plugin];
        const updated_plugin = updated[plugin];

        if (original_plugin.name !== updated_plugin.name) {
            modifications.push({ plugin, field: "name", before: original_plugin.name, after: updated_plugin.name, type: "modify" });
        }

        if (original_plugin.authors.join() !== updated_plugin.authors.join()) {
            modifications.push({ plugin, field: "authors", before: original_plugin.authors.join(), after: updated_plugin.authors.join(), type: "modify" });
        }

        if (original_plugin.description !== updated_plugin.description) {
            modifications.push({ plugin, field: "description", before: original_plugin.description, after: updated_plugin.description, type: "modify" });
        }

        if (original_plugin.isDeprecated !== updated_plugin.isDeprecated) {
            modifications.push({ plugin, field: "isDeprecated", before: original_plugin.isDeprecated.toString(), after: updated_plugin.isDeprecated.toString(), type: "modify" });
        }

        if (original_plugin.categories.join() !== updated_plugin.categories.join()) {
            modifications.push({ plugin, field: "categories", before: original_plugin.categories.join(), after: updated_plugin.categories.join(), type: "modify" });
        }

        if (original_plugin.keywords.join() !== updated_plugin.keywords.join()) {
            modifications.push({ plugin, field: "keywords", before: original_plugin.keywords.join(), after: updated_plugin.keywords.join(), type: "modify" });
        }

        if (original_plugin.urls.repository !== updated_plugin.urls.repository) {
            modifications.push({ plugin, field: "urls.repository", before: original_plugin.urls.repository, after: updated_plugin.urls.repository, type: "modify" });
        }

        if (original_plugin.urls.readme !== updated_plugin.urls.readme) {
            modifications.push({ plugin, field: "urls.readme", before: original_plugin.urls.readme, after: updated_plugin.urls.readme, type: "modify" });
        }

        if (original_plugin.release.stable.signature !== updated_plugin.release.stable.signature) {
            modifications.push({ plugin, field: "release.stable.signature", before: original_plugin.release.stable.signature, after: updated_plugin.release.stable.signature, type: "modify" });
        }

        if (original_plugin.release.stable.version !== updated_plugin.release.stable.version) {
            modifications.push({ plugin, field: "release.stable.version", before: original_plugin.release.stable.version, after: updated_plugin.release.stable.version, type: "modify" });
        }

        if (original_plugin.release.stable.url !== updated_plugin.release.stable.url) {
            modifications.push({ plugin, field: "release.stable.url", before: original_plugin.release.stable.url, after: updated_plugin.release.stable.url, type: "modify" });
        }

        if (original_plugin.release.prerelease?.signature !== updated_plugin.release.prerelease?.signature) {
            modifications.push({ plugin, field: "release.prerelease.signature", before: original_plugin.release.prerelease?.signature, after: updated_plugin.release.prerelease?.signature, type: "modify" });
        }

        if (original_plugin.release.prerelease?.version !== updated_plugin.release.prerelease?.version) {
            modifications.push({ plugin, field: "release.prerelease.version", before: original_plugin.release.prerelease?.version, after: updated_plugin.release.prerelease?.version, type: "modify" });
        }

        if (original_plugin.release.prerelease?.url !== updated_plugin.release.prerelease?.url) {
            modifications.push({ plugin, field: "release.prerelease.url", before: original_plugin.release.prerelease?.url, after: updated_plugin.release.prerelease?.url, type: "modify" });
        }
    });

    return modifications;
}

interface Modification {
    plugin: string;
    field?: string;
    before?: string;
    after?: string;
    type: "create" | "modify" | "delete";
}

export async function fetch_original_registry(octokit: Octokit): Promise<Registry> {
    const { data } = await octokit.rest.repos.getContent({
        owner: "Somfic",
        repo: "vla-plugins",
        path: "registry.json",
    });

    const json = atob(data.content);

    return JSON.parse(json) as Registry;
}

export async function read_updated_file(): Promise<string> {
    return await Deno.readTextFile("registry.json");
}

export async function read_updated_registry(): Promise<Registry> {
    const json = await read_updated_file();
    return JSON.parse(json) as Registry;
}

async function execute(cmd: string) {
    console.log(`Executing: ${cmd}`);

    const p = new Deno.Command(cmd, {
        stdout: "piped",
        stderr: "piped",
    });
    const result = await p.output();

    const outStr = new TextDecoder().decode(result.stdout);
    const errStr = new TextDecoder().decode(result.stderr);

    if (outStr) console.log(outStr);
    if (errStr) console.error(errStr);
}
