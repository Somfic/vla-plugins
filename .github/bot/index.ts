import { get_modifications, fetch_original_registry, read_updated_registry, check_modifications_are_allowed, read_updated_file } from "./bot.ts";
import { Octokit } from "https://esm.sh/octokit@4.0.2?dts";

const updated_file = await read_updated_file();
const updated = await read_updated_registry();

const original = await fetch_original_registry();

console.log("Original registry:");
console.log(original);
console.log("Updated registry");
console.log(updated);

const modifications = get_modifications(original, updated);

console.log("Found", modifications.length, "modifications");
console.log(modifications);

const pr_number = parseInt(Deno.env.get("PR_NUMBER") ?? "0");
const octokit = new Octokit({ auth: Deno.env.get("GITHUB_TOKEN") });
const pr = await octokit.rest.pulls.get({
    owner: "Somfic",
    repo: "vla-plugins",
    pull_number: pr_number,
});
const changed_files = await octokit.rest.pulls.listFiles({
    owner: "Somfic",
    repo: "vla-plugins",
    pull_number: pr_number,
});

const problems = check_modifications_are_allowed(
    modifications,
    original,
    updated_file,
    pr.data.user?.login,
    changed_files.data.map((f) => f.filename)
);

console.log(`Found ${problems.length} problem${problems.length != 1 ? "s" : ""}`);
console.log(problems);

if (problems.length !== 0) {
    console.log("Requesting changes");

    await octokit.rest.pulls.createReview({
        owner: "Somfic",
        repo: "vla-plugins",
        pull_number: pr_number,
        event: "REQUEST_CHANGES",
        body: `🚫 ${problems.length} problem${problems.length != 1 ? "s" : ""} found. See attached comments for specific issues.`,
        comments: problems,
    });
} else {
    console.log("Approving");

    // Comment
    await octokit.rest.pulls.createReview({
        owner: "Somfic",
        repo: "vla-plugins",
        pull_number: pr_number,
        event: "COMMENT",
        body: "✅ All checks passed.",
    });
}

if (pr.data.author_association == "FIRST_TIME_CONTRIBUTOR" || pr.data.author_association == "FIRST_TIMER") {
    console.log("First time contributor, requesting review from Somfic");

    await octokit.rest.pulls.requestReviewers({
        owner: "Somfic",
        repo: "vla-plugins",
        pull_number: pr_number,
        reviewers: ["Somfic"],
    });
} else {
    console.log("Merging PR");

    // await octokit.rest.pulls.merge({
    //     owner: "Somfic",
    //     repo: "vla-plugins",
    //     pull_number: pr_number,
    //     merge_method: "squash",
    // });
}

Deno.exit(0);
