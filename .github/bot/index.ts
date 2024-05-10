import { get_modifications, fetch_original_registry, read_updated_registry, check_modifications_are_allowed, read_updated_file } from "./bot.ts";
import { Octokit } from "https://esm.sh/octokit@4.0.2?dts";

console.log("Running bot");

const original = await fetch_original_registry();

console.log(`Original registry has ${Object.keys(original).length} plugins`);

const updated_file = await read_updated_file();
const updated = await read_updated_registry();

console.log(`Original registry has ${Object.keys(original).length} plugins`);

const modifications = get_modifications(original, updated);

console.log(`Detected ${modifications.length} modification${modifications.length != 1 ? "s" : ""}`);

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

console.log(`PR #${pr_number} by ${pr.data.user.login} (${pr.data.author_association})`);

const problems = check_modifications_are_allowed(
    modifications,
    original,
    updated_file,
    pr.data.author_association,
    changed_files.data.map((f) => f.filename)
);

console.log(`Found ${problems.length} problem${problems.length != 1 ? "s" : ""}`);
console.log(problems);

let review_result: "REQUEST_CHANGES" | "APPROVE" | "COMMENT" = "REQUEST_CHANGES";
let review_body = `🚫 ${problems.length} problem${problems.length != 1 ? "s" : ""} encountered`;

if (problems.length === 0) {
    review_result = "APPROVE";
    review_body = "✨ all checks passed";
}

// Submit a review
await octokit.rest.pulls.createReview({
    owner: "Somfic",
    repo: "vla-plugins",
    pull_number: pr_number,
    event: review_result,
    body: review_body,
    comments: problems,
});

if (problems.length == 0 && pr.data.author_association != "FIRST_TIME_CONTRIBUTOR" && pr.data.author_association != "FIRST_TIMER") {
    // Merge the PR
    // await octokit.rest.pulls.merge({
    //     owner: "Somfic",
    //     repo: "vla-plugins",
    //     pull_number: pr_number,
    // });
}

// Exit with a non-zero code if there are any problems
if (problems.length > 0) {
    Deno.exit(1);
} else {
    Deno.exit(0);
}
