#!/usr/bin/env bash
# Publish only the public website. The application and its Git history stay private.
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
site_repository="lilhammerfun/swartz-site"
publish_dir="$(mktemp -d -t swartz-site-publish.XXXXXXXX)"
trap 'rm -rf -- "$publish_dir"' EXIT

gh repo clone "$site_repository" "$publish_dir" -- --quiet
mkdir -p "$publish_dir/site" "$publish_dir/.github/workflows"
rsync -a --delete "$project_root/site/" "$publish_dir/site/"
cp "$project_root/deploy/site-pages.yml" "$publish_dir/.github/workflows/pages.yml"
cp "$project_root/LICENSE" "$publish_dir/LICENSE"

git -C "$publish_dir" add -- site .github/workflows/pages.yml LICENSE
if git -C "$publish_dir" diff --cached --quiet; then
  echo 'The public website already matches this checkout.'
  exit 0
fi

git -C "$publish_dir" commit -m 'Update the Swartz website'
git -C "$publish_dir" push origin main
echo 'Website deployment: https://github.com/lilhammerfun/swartz-site/actions'
