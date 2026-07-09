---
name: bump-version-release
description: Standard release workflow for this repository. Use when the user asks to bump the project version, prepare a release commit, create a git tag, or push a release for poe2-marketwright.
---

# Bump Version Release

## Workflow

Use this sequence for poe2-marketwright release bumps:

1. Verify the worktree with `git status --short`. Stop and ask before mixing unrelated uncommitted changes into a release.
2. Confirm the target version and tag do not already exist with `git tag --list "vX.Y.Z"`.
3. Update release version files. For this repository, update `manifest.json` for the Chrome extension version. If `scripts/pyproject.toml` is intentionally being kept aligned with the release version, update it too and refresh `scripts/uv.lock` with `uv lock --project scripts`.
4. Run the smallest reliable validation. For normal code/data changes, run `uv run --project scripts python -m unittest discover -s scripts/tests`.
5. Commit the version bump with `git add ...` and `git commit -m "Bump version to X.Y.Z"`.
6. Create the tag with `git tag vX.Y.Z`.
7. Push the branch first, then the tag: `git push origin <branch>` and `git push origin vX.Y.Z`.
8. Report the commit hash, tag, pushed branch, and validation command.

## Rules

- Do not amend an existing release commit unless the user explicitly asks.
- Do not force-push or delete/recreate tags without explicit approval.
- Keep release bump commits focused on version files and release-process documentation only.
- Use `vX.Y.Z` tag names to match `.github/workflows/release.yml`.
- If `uv` rewrites `scripts/uv.lock` because `scripts/pyproject.toml` changed, include the lockfile in the same commit.
