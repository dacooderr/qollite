#!/usr/bin/env python3
"""Check bundled mods against their GameBanana pages.

QOL Lite bundles mods written by other people. Without this, there is no way to
notice that an author has shipped an update -- the pack silently keeps serving an
old build until a user reports it.

Reads sources.json, fetches each mod's current state from the GameBanana API, and
reports what changed since the version recorded there.

Usage:
    python scripts/check_upstream.py            # report drift
    python scripts/check_upstream.py --update   # rewrite sources.json to current state
    python scripts/check_upstream.py --json     # machine-readable, for CI

Exit codes:  0 = up to date   1 = updates available   2 = error
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

API = "https://gamebanana.com/apiv11/Mod/{}/ProfilePage"
UA = "qol-lite-upstream-check (+https://github.com/dacooderr/qollite)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, "sources.json")
THROTTLE_S = 0.5  # be a good citizen; this is someone else's free service


def fetch(mod_id):
    """Fetch a mod's profile. Reads from a fixture directory instead when
    QOLLITE_UPSTREAM_FIXTURES is set, so the tool can be tested offline and
    deterministically -- see scripts/test_check_upstream.py."""
    fixtures = os.environ.get("QOLLITE_UPSTREAM_FIXTURES")
    if fixtures:
        with open(os.path.join(fixtures, f"{mod_id}.json"), encoding="utf-8") as fh:
            return json.load(fh)
    req = urllib.request.Request(API.format(mod_id), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def license_name(raw):
    """CC licenses arrive as an HTML badge; pull the short name out of the URL."""
    m = re.search(r"licenses/([a-z-]+)/", raw or "")
    if m:
        return "CC " + m.group(1).upper()
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", raw or "")).strip()
    return text[:40] or "(none stated)"


def summarise(data):
    return {
        "name": data.get("_sName"),
        "version": data.get("_sVersion") or None,
        "updated": data.get("_tsDateUpdated") or data.get("_tsDateModified"),
        "author": (data.get("_aSubmitter") or {}).get("_sName"),
        "license": license_name(data.get("_sLicense")),
        "files": {
            f.get("_sFile"): f.get("_sMd5Checksum")
            for f in (data.get("_aFiles") or [])
            if f.get("_sFile")
        },
    }


def ts(value):
    if not value:
        return "unknown"
    return datetime.fromtimestamp(int(value), tz=timezone.utc).strftime("%Y-%m-%d")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--update", action="store_true",
                    help="record the current upstream state as the new baseline")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    ap.add_argument("--sources", default=SOURCES, metavar="PATH",
                    help="manifest to read (default: sources.json at the repo root)")
    args = ap.parse_args()

    sources_path = args.sources
    if not os.path.exists(sources_path):
        print(f"error: {sources_path} not found", file=sys.stderr)
        return 2

    with open(sources_path, encoding="utf-8") as fh:
        sources = json.load(fh)

    results, failed = [], []
    entries = [e for e in sources["mods"] if e.get("gamebanana_id")]
    skipped = [e for e in sources["mods"] if not e.get("gamebanana_id")]

    for entry in entries:
        try:
            live = summarise(fetch(entry["gamebanana_id"]))
        except (OSError, ValueError, KeyError) as exc:
            # OSError covers URLError, HTTPError, timeouts and DNS failures.
            # One unreachable mod must not cost us the report on all the others.
            failed.append((entry["feature"], f"{type(exc).__name__}: {exc}"[:70]))
            continue

        pinned = entry.get("pinned", {})
        if not pinned:
            # No baseline: we do not know which version is bundled, so we can claim
            # neither "current" nor "stale". Say unknown rather than guessing.
            results.append({"feature": entry["feature"], "id": entry["gamebanana_id"],
                            "live": live, "changed": [], "baseline": False})
            if args.update:
                entry["pinned"] = live
            if not os.environ.get("QOLLITE_UPSTREAM_FIXTURES"):
                time.sleep(THROTTLE_S)
            continue

        changed = []
        if pinned.get("version") != live["version"]:
            changed.append(f"version {pinned.get('version') or '?'} -> {live['version'] or '?'}")
        if pinned.get("updated") != live["updated"]:
            changed.append(f"updated {ts(pinned.get('updated'))} -> {ts(live['updated'])}")
        if pinned.get("files") and pinned["files"] != live["files"]:
            changed.append("file checksums differ")
        if pinned.get("license") and pinned["license"] != live["license"]:
            changed.append(f"LICENSE CHANGED: {pinned['license']} -> {live['license']}")

        results.append({"feature": entry["feature"], "id": entry["gamebanana_id"],
                        "live": live, "changed": changed, "baseline": True})
        if args.update:
            entry["pinned"] = live
        if not os.environ.get("QOLLITE_UPSTREAM_FIXTURES"):
            time.sleep(THROTTLE_S)

    if args.update:
        sources["checked"] = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        with open(sources_path, "w", encoding="utf-8", newline="\r\n") as fh:
            json.dump(sources, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        print(f"sources.json updated ({len(results)} entries)")
        return 0

    if args.json:
        json.dump({"results": results, "failed": failed, "untracked": len(skipped)},
                  sys.stdout, indent=2)
        print()
        return 1 if any(r["changed"] for r in results) else 0

    stale = [r for r in results if r["changed"]]
    unpinned = [r for r in results if not r["baseline"]]
    print(f"{'feature':26} {'bundled':>9}  {'upstream':>9}  status")
    print("-" * 78)
    for r in sorted(results, key=lambda x: bool(x["changed"]), reverse=True):
        pinned_v = next((e.get("pinned", {}).get("version")
                         for e in entries if e["feature"] == r["feature"]), None)
        mark = "UPDATE" if r["changed"] else ("no baseline" if not r["baseline"] else "ok")
        print(f"{r['feature'][:26]:26} {str(pinned_v or '-'):>9}  "
              f"{str(r['live']['version'] or '-'):>9}  {mark}")
        for c in r["changed"]:
            print(f"{'':26} {'':>9}  {'':>9}    - {c}")

    if skipped:
        print(f"\n{len(skipped)} entr{'y' if len(skipped) == 1 else 'ies'} with no gamebanana_id "
              f"(cannot be tracked): " + ", ".join(e["feature"] for e in skipped))
    if failed:
        print("\nfailed to reach:")
        for name, err in failed:
            print(f"  {name}: {err}")

    if unpinned:
        print(f"\n{len(unpinned)} mod(s) have no recorded baseline, so drift cannot be detected.")
        print("Confirm which version is actually bundled, then pin it. Do NOT just run --update on")
        print("a fresh checkout: that records upstream's CURRENT state as though it were what ships,")
        print("which is exactly the false 'we are up to date' this tool exists to prevent.")
    if stale:
        print(f"\n{len(stale)} mod(s) have moved upstream. Review, rebundle if appropriate, then:")
        print("  python scripts/check_upstream.py --update")
        print("Update the matching rows in docs/BUNDLE.md in the same commit.")
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main())
