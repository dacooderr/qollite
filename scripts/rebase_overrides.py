#!/usr/bin/env python3
"""Three-way rebase of QOL Lite's Valve-path overrides onto a new game build.

Every file QOL Lite ships at a Valve path replaces Valve's file wholesale, so a
game patch silently stales it: new Valve panels go unstyled, renamed classes stop
matching, removed rules linger. This tool carries each patch's Valve changes into
the overrides without losing the mod's own edits:

    ours   = the override in this repo
    base   = the Valve revision the override was forked from -- the tracker
             revision with the smallest diff against ours
    theirs = the Valve file in the new build
    result = ours + (theirs - base)          via `git merge-file --diff3`

Valve's history comes from a local clone of SteamDatabase/GameTracking-Deadlock
(a blobless clone is enough: `git clone --filter=blob:none --no-checkout ...`).

Usage:
    python scripts/rebase_overrides.py --tracker <clone> --old <rev> --new <rev>
    python scripts/rebase_overrides.py ... --apply      # write results into the tree

Without --apply nothing in the repo changes; inputs and results go to --out.
Conflicted results keep diff3 markers and must be resolved by hand, and **every
result is unverified until someone looks at it in game** (docs/FIELD_NOTES.md §6).

The base pick is a heuristic and is wrong for two known shapes, which the report
flags as `review-base` rather than trusting:
  * an override that is only `@import base/...` plus the mod's rules -- it has no
    inlined Valve copy, so there is nothing to merge; keep it as it is;
  * a full replacement of Valve's file (e.g. the former hud_hero_testing.xml) --
    no Valve revision is close, and merging replays Valve's whole history into the mod.

It also reports `engine-ids`: ids in the new Valve layout that the override lacks
and that client.dll names in its strings. The engine looks some of those up and
aborts start-up when one is missing -- 6722's hud_hero_testing.xml did exactly
that ("FATAL ERROR: Unable to find child 'BotsSpawnBotCard'"). A name in the
strings is evidence of a lookup, not proof, so treat the list as "must keep
unless proven otherwise" (docs/FIELD_NOTES.md §10).

Exit codes: 0 = nothing to do   1 = conflicts, review-base or engine-ids flags   2 = error
"""

import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRACKER_PREFIX = "game/citadel/pak01_dir/"
DEFAULT_CANDIDATES = 40
# A pick is suspicious when the mod's delta against it exceeds this share of the
# override's own length: a genuine fork differs from its base by the mod's edits,
# not by most of the file. Measured on the 6711 rebase: the four grossly wrong
# picks scored 0.94-63.8, the highest right pick 0.84 (citadel_db_page_training.xml).
# It cannot catch a subtly wrong base: hud_escape_menu.xml scored 0.30 against a
# base two revisions too old, below several right picks.
REVIEW_DELTA_RATIO = 0.9

# Mod-named files that are really forks of a Valve file. They are not at a Valve
# path, so nothing else would find them. See docs/FIELD_NOTES.md §2.
ALIASES = {
    "panorama/styles/topbar_rank_topbar.css": "panorama/styles/citadel_hud_top_bar.css",
}
# Pristine Valve copies kept under mod-invented directories (docs/ARCHITECTURE.md §4).
BASE_DIRS = re.compile(r"panorama/styles/(base|topbar_rank_base)/(.*)")
DECOMPILER_HEADER = ("reconstructed by Source 2 Viewer", "Prettified by Source 2 Viewer")
# Since build 6711 Valve's compiled files reference `.vcss`; this repo uses `.vcss_c`.
# Both resolve; mapping Valve's form keeps the churn out of the merge.
VCSS_REF = re.compile(r'(s2r://panorama/styles/[^"\)]*?\.vcss)(["\)])')
# Strings extracted from the client binary; the tracker keeps them per build.
CLIENT_STRINGS = "game/citadel/bin/win64/client_strings.txt"
LAYOUT_ID = re.compile(r'\bid="([^"]+)"')


def layout_that_ships(entry):
    """Which text the engine-ids check must read for a rebased layout: the merge
    result only when --apply would write it. A review-base result is a merge
    against the wrong base -- it replays Valve's history and so carries Valve's
    ids -- and is never applied, so the file that ships is still ours."""
    return entry.get("result") if entry and entry.get("status") != "review-base" else None


def missing_engine_ids(valve_layout, our_layout, engine_names):
    """Ids Valve's layout declares, ours lacks, and the client binary names."""
    return sorted((set(LAYOUT_ID.findall(valve_layout)) - set(LAYOUT_ID.findall(our_layout)))
                  & engine_names)


def git(cwd, *args):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.decode(errors='replace').strip()}")
    return r.stdout.decode("utf-8", errors="replace")


def git_show(cwd, rev, path):
    try:
        return git(cwd, "show", f"{rev}:{path}")
    except RuntimeError:
        return None


def normalise(text, strip_ws=True):
    """Drop the decompiler header and Valve's ref-form churn; optionally trailing
    whitespace, which is used only for picking a base, never for the merge."""
    lines = text.replace("\r\n", "\n").split("\n")
    if lines and any(h in lines[0] for h in DECOMPILER_HEADER):
        lines = lines[1:]
    out = []
    for ln in lines:
        ln = VCSS_REF.sub(r"\1_c\2", ln)
        out.append(ln.rstrip() if strip_ws else ln)
    return "\n".join(out).rstrip("\n") + "\n"


def header_of(text):
    first = text.replace("\r\n", "\n").split("\n", 1)[0]
    return first if any(h in first for h in DECOMPILER_HEADER) else None


def eof_of(text):
    return text[len(text.rstrip("\r\n")):]


def diff_size(a, b):
    return sum(1 for l in difflib.unified_diff(a.splitlines(), b.splitlines(), n=0, lineterm="")
               if l[:1] in "+-" and not l.startswith(("+++", "---")))


def valve_path(repo_path):
    if repo_path in ALIASES:
        return ALIASES[repo_path]
    m = BASE_DIRS.match(repo_path)
    return "panorama/styles/" + m.group(2) if m else repo_path


def pick_base(tracker, old_rev, gtp, ours, candidates):
    revs = [r for r in git(tracker, "log", "--format=%h %cs", f"-n{candidates}", old_rev, "--", gtp).split("\n") if r]
    best = None
    for r in revs:
        sha, date = r.split()
        cand = git_show(tracker, sha, gtp)
        if cand is None:
            continue
        d = diff_size(ours, normalise(cand))
        if best is None or d < best[0]:
            best = (d, sha, date)
        if d == 0:
            break
    return best


def rebase_file(args, f, out_dir):
    vp = valve_path(f)
    gtp = TRACKER_PREFIX + vp
    theirs_raw = git_show(args.tracker, args.new, gtp)
    if theirs_raw is None:
        return None  # not a Valve path
    old_raw = git_show(args.tracker, args.old, gtp) or ""
    if normalise(theirs_raw) == normalise(old_raw):
        return {"file": f, "status": "valve-unchanged"}
    ours_raw = git(ROOT, "show", f"{args.ref}:{f}")
    ours = normalise(ours_raw)
    best = pick_base(args.tracker, args.old, gtp, ours, args.candidates)
    if best is None:
        return {"file": f, "status": "no-base"}
    mod_delta, base_sha, base_date = best
    base_raw = git_show(args.tracker, base_sha, gtp)
    entry = {"file": f, "valve_path": vp, "base_rev": base_sha, "base_date": base_date,
             "mod_delta_lines": mod_delta,
             "valve_delta_lines": diff_size(normalise(base_raw), normalise(theirs_raw))}

    stem = os.path.join(out_dir, f.replace("/", "__"))
    inputs = {"ours": ours_raw, "base": base_raw, "theirs": theirs_raw}
    for k, raw in inputs.items():
        with open(f"{stem}.{k}", "w", encoding="utf-8", newline="\n") as fh:
            fh.write(normalise(raw, strip_ws=False))
    r = subprocess.run(["git", "merge-file", "-p", "--diff3", "-L", "ours", "-L", "valve-base",
                        "-L", "valve-new", f"{stem}.ours", f"{stem}.base", f"{stem}.theirs"],
                       capture_output=True)
    if r.returncode < 0:
        raise RuntimeError(f"git merge-file failed on {f}")
    merged = r.stdout.decode("utf-8", errors="replace")
    hdr = header_of(ours_raw)
    if hdr:
        merged = hdr + "\n" + merged
    merged = merged.rstrip("\r\n") + (eof_of(ours_raw) or "\n")
    with open(f"{stem}.merged", "w", encoding="utf-8", newline="") as fh:
        fh.write(merged)

    entry["conflicts"] = r.returncode
    entry["result"] = f"{stem}.merged"
    own_lines = max(1, len(ours.splitlines()))
    if mod_delta == 0:
        entry["status"] = "valve-copy"
    elif mod_delta > REVIEW_DELTA_RATIO * own_lines:
        entry["status"] = "review-base"
    else:
        entry["status"] = "modded"
    return entry


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--tracker", required=True, help="local clone of GameTracking-Deadlock")
    ap.add_argument("--old", required=True, help="tracker revision of the last pre-patch build")
    ap.add_argument("--new", required=True, help="tracker revision of the patched build")
    ap.add_argument("--ref", default="HEAD", help="repo revision whose overrides are rebased")
    ap.add_argument("--out", default=os.path.join(tempfile.gettempdir(), "qollite_rebase_out"),
                    help="where inputs and results go (default: outside the repo, so nothing lands in git)")
    ap.add_argument("--candidates", type=int, default=DEFAULT_CANDIDATES,
                    help="how many tracker revisions to try as the base")
    ap.add_argument("--apply", action="store_true", help="write results into the working tree")
    args = ap.parse_args()

    try:
        os.makedirs(args.out, exist_ok=True)
        files = git(ROOT, "ls-tree", "-r", "--name-only", args.ref, "panorama/layout", "panorama/styles").split()
        report = []
        for f in files:
            e = rebase_file(args, f, args.out)
            if e is None:
                continue
            report.append(e)
            if "conflicts" in e:
                print(f"{e['status']:12} conflicts={e['conflicts']:<3} mod={e['mod_delta_lines']:<5} "
                      f"valve={e['valve_delta_lines']:<5} base={e['base_rev']}@{e['base_date']}  {f}")
                if args.apply and e["status"] != "review-base":
                    with open(e["result"], "rb") as src, open(os.path.join(ROOT, f), "wb") as dst:
                        dst.write(src.read())
        engine_names = set((git_show(args.tracker, args.new, CLIENT_STRINGS) or "").split())
        by_file = {e["file"]: e for e in report}
        for f in files:
            if not f.startswith("panorama/layout/"):
                continue
            valve = git_show(args.tracker, args.new, TRACKER_PREFIX + valve_path(f))
            if valve is None:
                continue
            e = by_file.get(f)
            shipped = layout_that_ships(e)
            if shipped:
                with open(shipped, encoding="utf-8") as fh:
                    ours = fh.read()
            else:
                ours = git(ROOT, "show", f"{args.ref}:{f}")
            missing = missing_engine_ids(valve, ours, engine_names)
            if missing:
                if e is None:
                    e = by_file[f] = {"file": f, "status": "valve-unchanged"}
                    report.append(e)
                e["engine_ids"] = missing
                print(f"engine-ids   {len(missing)} missing, e.g. {', '.join(missing[:5])}  {f}")
        with open(os.path.join(args.out, "report.json"), "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=1)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    flagged = [e for e in report
               if e.get("conflicts") or e.get("status") == "review-base" or e.get("engine_ids")]
    print(f"\n{len(report)} Valve-path files checked, {len(flagged)} need a human "
          f"(conflicts, review-base or engine-ids). Report: {os.path.join(args.out, 'report.json')}")
    return 1 if flagged else 0


if __name__ == "__main__":
    sys.exit(main())
