import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Github, Loader2, Star, GitBranch, UserRound } from "lucide-react";

type RepoData = {
  full_name: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  stars: number;
  forks: number;
  branches: string[];
};

type UserData = {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
};

/**
 * GitHub integration surface. Calls server-side Convex actions which handle
 * the GitHub API with the server-only GITHUB_TOKEN — no secrets touch the
 * browser.
 */
export function GithubCard() {
  const fetchRepo = useAction(api.github.getRepoData);
  const fetchUser = useAction(api.github.getUserInfo);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [username, setUsername] = useState("");
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [busy, setBusy] = useState<"repo" | "user" | null>(null);

  const run = async (
    key: "repo" | "user",
    fn: () => Promise<void>,
  ) => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e.message ?? "GitHub request failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-muted text-foreground">
            <Github className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">GitHub</CardTitle>
            <CardDescription className="text-sm">
              Look up public repository and user info via the GitHub API.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="gh-owner">Owner</Label>
            <Input
              id="gh-owner"
              placeholder="octocat"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gh-repo">Repository</Label>
            <Input
              id="gh-repo"
              placeholder="hello-world"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>
          <Button
            className="w-fit gap-2"
            onClick={() =>
              run("repo", async () => {
                if (!owner.trim() || !repo.trim()) {
                  toast.error("Enter an owner and repository");
                  return;
                }
                const res = await fetchRepo({
                  owner: owner.trim(),
                  repo: repo.trim(),
                });
                setRepoData(res as RepoData);
              })
            }
            disabled={busy === "repo"}
          >
            {busy === "repo" && <Loader2 className="size-4 animate-spin" />}
            <GitBranch className="size-4" /> Fetch repo
          </Button>
          {repoData && (
            <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <Github className="size-3.5" /> {repoData.full_name}
              </p>
              {repoData.description && (
                <p className="mt-1 text-muted-foreground">{repoData.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{repoData.language ?? "—"}</span>
                <span>default: <b>{repoData.default_branch}</b></span>
                <span className="flex items-center gap-1"><Star className="size-3" /> {repoData.stars}</span>
                <span>{repoData.branches.length} branches</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 border-t border-border/60 pt-5">
          <div className="grid gap-1.5">
            <Label htmlFor="gh-username">Username</Label>
            <Input
              id="gh-username"
              placeholder="octocat"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <Button
            className="w-fit gap-2"
            onClick={() =>
              run("user", async () => {
                if (!username.trim()) {
                  toast.error("Enter a GitHub username");
                  return;
                }
                const res = await fetchUser({ username: username.trim() });
                setUserData(res as UserData);
              })
            }
            disabled={busy === "user"}
          >
            {busy === "user" && <Loader2 className="size-4 animate-spin" />}
            <UserRound className="size-4" /> Fetch user
          </Button>
          {userData && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm">
              <img
                src={userData.avatar_url}
                alt={userData.login}
                className="size-10 rounded-full"
              />
              <div>
                <p className="font-medium">{userData.name ?? userData.login}</p>
                <p className="text-muted-foreground">@{userData.login}</p>
                {userData.bio && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{userData.bio}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}