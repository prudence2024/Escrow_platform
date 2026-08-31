"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Octokit } from "@octokit/rest";

/**
 * Deal Secure — GitHub integration.
 *
 * These actions run in the Convex Node.js runtime and read `GITHUB_TOKEN`
 * from the Convex environment variables (never the browser). The token is
 * used to fetch public-ish repo and user metadata via Octokit and is never
 * exposed to the client; only the trimmed responses below are returned.
 */

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set. Add it under Settings > Environment Variables.",
    );
  }
  return new Octokit({ auth: token });
}

/** Fetch basic repository metadata and its branch list. */
export const getRepoData = action({
  args: { owner: v.string(), repo: v.string() },
  handler: async (_ctx, { owner, repo }) => {
    const octokit = getOctokit();

    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const { data: branches } = await octokit.repos.listBranches({ owner, repo });

    return {
      full_name: repoData.full_name,
      description: repoData.description,
      language: repoData.language,
      default_branch: repoData.default_branch,
      stars: repoData.stargazers_count ?? 0,
      forks: repoData.forks_count ?? 0,
      branches: branches.map((b) => b.name),
    };
  },
});

/** Fetch lightweight metadata for a GitHub user. */
export const getUserInfo = action({
  args: { username: v.string() },
  handler: async (_ctx, { username }) => {
    const octokit = getOctokit();
    const { data: user } = await octokit.users.getByUsername({ username });
    return {
      login: user.login,
      name: user.name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      public_repos: user.public_repos ?? 0,
    };
  },
});

/**
 * Fetch the authenticated user's own profile. Useful to verify the token and
 * confirm who is making the API calls.
 */
export const getAuthenticatedUser = action({
  args: {},
  handler: async (_ctx) => {
    const octokit = getOctokit();
    const { data: user } = await octokit.users.getAuthenticated();
    return {
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url,
      plan: "plan" in user && user.plan ? user.plan : null,
    };
  },
});