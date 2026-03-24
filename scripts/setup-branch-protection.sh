#!/usr/bin/env bash
# ═══════════════════════════════════════════
# FitQuest — Main Branch Protection Setup
# ═══════════════════════════════════════════
# Run once to lock main branch with required CI checks.
# Requires: GitHub CLI (gh) authenticated with repo admin access.
#
# Usage: bash scripts/setup-branch-protection.sh

set -euo pipefail

REPO="Jomophobeous/FitQuest"
BRANCH="main"

echo "╔══════════════════════════════════════╗"
echo "║  Locking main branch: ${REPO}       ║"
echo "╚══════════════════════════════════════╝"

# Require PR reviews before merging
# Require CI status checks to pass
# Do not allow force pushes
# Do not allow deletions
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${REPO}/branches/${BRANCH}/protection" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=typecheck-and-test' \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -f 'required_pull_request_reviews[dismiss_stale_reviews]=true' \
  -F 'enforce_admins=false' \
  -f 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false' \
  -F 'block_creations=false' \
  -F 'required_conversation_resolution=true'

echo ""
echo "✅ Branch protection applied to ${BRANCH}:"
echo "   • PR required (1 approval)"
echo "   • CI must pass (typecheck-and-test job)"
echo "   • Stale reviews dismissed on new push"
echo "   • Force push blocked"
echo "   • Branch deletion blocked"
echo "   • Conversations must be resolved"
echo ""
echo "Branch flow: feature/* → develop → main (via PR)"
