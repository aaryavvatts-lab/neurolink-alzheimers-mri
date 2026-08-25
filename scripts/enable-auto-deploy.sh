#!/usr/bin/env bash
#
# Turn on automatic deploys, so that pushing to main updates the live site.
#
# Run this once:   ./scripts/enable-auto-deploy.sh
#
# Why a script rather than something already set up: GitHub refuses to accept a
# workflow file from a token that lacks the "workflow" permission, and the
# GitHub CLI is normally logged in without it. Granting that permission needs a
# browser once. Everything after that is automatic.
#
# The Vercel credentials are already stored as repository secrets, so this only
# has to deal with the GitHub side.

set -euo pipefail
cd "$(dirname "$0")/.."

REPO=aaryavvatts-lab/neurolink-alzheimers-mri

echo "==> Step 1 of 3: granting the GitHub CLI permission to manage workflows"
echo "    A browser will open and show a one-time code. Paste it and approve."
echo
gh auth refresh --hostname github.com --scopes workflow,repo

echo
echo "==> Step 2 of 3: adding the workflow"
mkdir -p .github/workflows
cp scripts/github-actions-deploy.yml .github/workflows/deploy.yml
git add .github/workflows/deploy.yml
git commit -m "Deploy from GitHub Actions on every push to main" || true
git push origin main

echo
echo "==> Step 3 of 3: checking it ran"
sleep 12
gh run list --repo "$REPO" --limit 3

echo
echo "Done. From now on, any push to main rebuilds and redeploys the site."
echo "Watch a run with:  gh run watch --repo $REPO"
