import { get_modifications, fetch_original_registry, read_updated_registry, check_modifications_are_allowed, read_updated_file } from "./bot.ts";
import { Octokit } from "https://esm.sh/octokit@4.0.2?dts";
import { find_line_number } from "./json.ts";

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
    pr.data.user?.login,
    changed_files.data.map((f) => f.filename)
);

console.log(`Found ${problems.length} problem${problems.length != 1 ? "s" : ""}`);
console.log(problems);

// Remove earlier reviews from the bot
const reviews = await octokit.rest.pulls.listReviews({
    owner: "Somfic",
    repo: "vla-plugins",
    pull_number: pr_number,
});

for (const review of reviews.data) {
    // Filter out already dismissed reviews
    if (review.state == "DISMISSED" || review.state == "APPROVED") {
        continue;
    }

    if (review.user?.login == "github-actions[bot]") {
        await octokit.rest.pulls.dismissReview({
            owner: "Somfic",
            repo: "vla-plugins",
            pull_number: pr_number,
            review_id: review.id,
            message: "Dismissing earlier bot review",
        });
    }
}

if (problems.length !== 0) {
    await octokit.rest.pulls.createReview({
        owner: "Somfic",
        repo: "vla-plugins",
        pull_number: pr_number,
        event: "REQUEST_CHANGES",
        body: `🚫 ${problems.length} problem${problems.length != 1 ? "s" : ""} found. See attached comments for specific issues.`,
        comments: problems,
    });
} else {
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
    await octokit.rest.pulls.requestReviewers({
        owner: "Somfic",
        repo: "vla-plugins",
        pull_number: pr_number,
        reviewers: ["Somfic"],
    });
} else {
    // Merge!
    await octokit.rest.pulls.merge({
        owner: "Somfic",
        repo: "vla-plugins",
        pull_number: pr_number,
        merge_method: "squash",
    });
}

Deno.exit(0);
