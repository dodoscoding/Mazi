#!/usr/bin/env python3
"""Create roadmap GitHub issues and assign dodoscoding (dodo).

Idempotent on issue title. Reads manifest.json beside this file.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO = "dodoscoding/Mazi"
ASSIGNEE = "dodoscoding"
ROOT = Path(__file__).resolve().parent

MILESTONES = [
    (
        "M0 Validate scope and contracts",
        "Validated scope, representative fixtures, privacy decisions, and architecture experiment results. Planning estimate is 1 to 2 working weeks, not a commitment.",
    ),
    (
        "M1 Private memory pilot",
        "An internal group can privately upload, review, share, and revisit a memory. Planning estimate is 5 to 7 working weeks, not a commitment.",
    ),
    (
        "M2 Historical import beta",
        "A closed beta can reconstruct history from supported archive exports. Planning estimate is 4 to 6 working weeks, not a commitment.",
    ),
    (
        "M3 Production archive launch",
        "Production launch with useful discovery, safe suggestions, recovery, and measured scale. Planning estimate is 5 to 8 working weeks, not a commitment.",
    ),
    (
        "M4 Continuous sources and places",
        "Selective Apple synchronization, authorized Discord server intake, and map exploration. Planning estimate is 5 to 8 working weeks, not a commitment.",
    ),
    (
        "M5 People and semantic search",
        "Authorized multimodal retrieval and People. Recognition only if consent gates pass. Planning estimate is 4 to 7 working weeks, not a commitment.",
    ),
    (
        "M6 Grounded Memory AI",
        "Memory AI gives evidence-backed answers with uncertainty. Planning estimate is 3 to 5 working weeks, not a commitment.",
    ),
    (
        "M7 Advanced memories",
        "Recaps, stories, capsules, and media generation as separate increments. Re-estimate per feature.",
    ),
]

LABELS = {
    "roadmap": ("Tracked from docs/ROADMAP.md", "0E8A16"),
    "design": ("Member-facing surface. Impeccable design discussion with dodo before UI implementation.", "1D76DB"),
}


def run(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=check, text=True, capture_output=True)


def existing_milestone_titles() -> set[str]:
    result = run(
        [
            "gh",
            "api",
            f"repos/{REPO}/milestones?state=open&per_page=100",
            "--jq",
            ".[].title",
        ]
    )
    return {line for line in result.stdout.splitlines() if line}


def ensure_milestones() -> None:
    have = existing_milestone_titles()
    for title, description in MILESTONES:
        if title in have:
            print(f"milestone exists: {title}")
            continue
        run(
            [
                "gh",
                "api",
                f"repos/{REPO}/milestones",
                "-f",
                f"title={title}",
                "-f",
                f"description={description}",
                "-f",
                "state=open",
            ]
        )
        print(f"milestone created: {title}")


def existing_labels() -> set[str]:
    result = run(["gh", "label", "list", "--repo", REPO, "--limit", "100", "--json", "name"])
    return {row["name"] for row in json.loads(result.stdout)}


def ensure_labels() -> None:
    have = existing_labels()
    for name, (description, color) in LABELS.items():
        if name in have:
            print(f"label exists: {name}")
            continue
        run(
            [
                "gh",
                "label",
                "create",
                name,
                "--repo",
                REPO,
                "--description",
                description,
                "--color",
                color,
            ]
        )
        print(f"label created: {name}")


def existing_issues_by_title() -> dict[str, dict]:
    result = run(
        [
            "gh",
            "issue",
            "list",
            "--repo",
            REPO,
            "--state",
            "all",
            "--limit",
            "200",
            "--json",
            "number,title,url,state",
        ]
    )
    rows = json.loads(result.stdout)
    return {row["title"]: row for row in rows}


def create_issues() -> list[dict]:
    manifest = json.loads((ROOT / "manifest.json").read_text())
    have = existing_issues_by_title()
    created: list[dict] = []
    for item in manifest:
        title = item["title"]
        if title in have:
            row = have[title]
            print(f"issue exists: #{row['number']} {title}")
            created.append({"created": False, **row, **item})
            continue
        body = (ROOT / item["file"]).read_text()
        cmd = [
            "gh",
            "issue",
            "create",
            "--repo",
            REPO,
            "--title",
            title,
            "--body-file",
            str(ROOT / item["file"]),
            "--assignee",
            ASSIGNEE,
            "--milestone",
            item["milestone"],
        ]
        for label in item["labels"]:
            cmd.extend(["--label", label])
        result = run(cmd)
        url = result.stdout.strip()
        print(f"issue created: {url} {title}")
        created.append({"created": True, "url": url, "title": title, **item, "body_bytes": len(body)})
    return created


def main() -> int:
    ensure_labels()
    ensure_milestones()
    rows = create_issues()
    (ROOT / "created.json").write_text(json.dumps(rows, indent=2) + "\n")
    print(f"recorded {len(rows)} issues")
    return 0


if __name__ == "__main__":
    sys.exit(main())
