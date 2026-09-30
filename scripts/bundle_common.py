#!/usr/bin/env python3
"""Shared plumbing for the first-party bundlers (bundle_bettermap.py, bundle_mer.py).

Each bundler owns its transformation (file-name table, renames, deltas). This
module owns what they have in common: reading an upstream commit through git,
the command line, and comparing or writing the result under panorama/scripts/.

Upstream content is always read from a commit via `git show`, never from the
upstream working tree, so uncommitted edits there cannot leak into the bundle.

Not run directly; see the bundlers for usage and exit codes.
"""

import argparse
import glob
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "panorama", "scripts")
# git's default abbreviation length; the provenance headers in the bundled files
# carry 7-character SHAs. Fixed rather than `rev-parse --short`, whose length grows
# when a prefix becomes ambiguous, so the same commit always yields the same header.
SHORT_SHA_LEN = 7

EXIT_OK, EXIT_DIFFERS, EXIT_ERROR = 0, 1, 2


class BundleError(Exception):
    """Anything that makes the bundle untrustworthy: a git failure, a delta anchor
    that no longer matches, an upstream name that escaped renaming."""


def git(upstream, *args):
    try:
        r = subprocess.run(["git", "-C", upstream, *args], capture_output=True)
    except OSError as exc:
        raise BundleError(f"cannot run git: {exc}") from exc
    if r.returncode != 0:
        raise BundleError(f"git {' '.join(args)} in {upstream}: "
                          f"{r.stderr.decode(errors='replace').strip()}")
    return r.stdout


def resolve_rev(upstream, rev):
    """Full SHA of `rev`; fails if it is not a commit in `upstream`."""
    try:
        return git(upstream, "rev-parse", "--verify", "--quiet", rev + "^{commit}").decode().strip()
    except BundleError as exc:
        raise BundleError(f"{rev!r} is not a commit in {upstream} ({exc})") from exc


def short_sha(full_sha):
    return full_sha[:SHORT_SHA_LEN]


def git_show(upstream, rev, path):
    """Committed content of `path` at `rev`, decoded as strict UTF-8."""
    return git(upstream, "show", f"{rev}:{path}").decode("utf-8")


def compare(out, out_dir, prefix):
    """Compare the in-memory bundle with disk.

    Returns (status, name) pairs for every mismatch: DIFF (content differs),
    MISSING (not on disk), EXTRA (a `<prefix>*.js` on disk the build does not
    produce -- a module removed upstream would otherwise linger unnoticed).
    """
    problems = []
    for name, text in out.items():
        path = os.path.join(out_dir, name)
        try:
            with open(path, "rb") as fh:
                current = fh.read()
        except FileNotFoundError:
            problems.append(("MISSING", name))
            continue
        if _lf(current) != text.encode("utf-8"):
            problems.append(("DIFF", name))
    for path in sorted(glob.glob(os.path.join(out_dir, prefix + "*.js"))):
        name = os.path.basename(path)
        if name not in out:
            problems.append(("EXTRA", name))
    return problems


def _lf(data):
    return data.replace(b"\r\n", b"\n")


def write(out, out_dir):
    """Write every file whose content changed; returns the names written.

    The bundle is built LF. On disk a file keeps the line endings it already has:
    with `text=auto` a Windows checkout holds CRLF while git stores LF, so
    comparing or writing raw bytes would report -- and create -- whole-file churn.
    A new file takes the endings of the existing files in out_dir."""
    written = []
    crlf_dir = False
    for existing in glob.glob(os.path.join(out_dir, "*.js")):
        with open(existing, "rb") as fh:
            crlf_dir = b"\r\n" in fh.read()
        break
    for name, text in out.items():
        path = os.path.join(out_dir, name)
        data = text.encode("utf-8")
        crlf = crlf_dir
        try:
            with open(path, "rb") as fh:
                current = fh.read()
            if _lf(current) == data:
                continue
            crlf = b"\r\n" in current
        except FileNotFoundError:
            pass
        with open(path, "wb") as fh:
            fh.write(data.replace(b"\n", b"\r\n") if crlf else data)
        written.append(name)
    return written


def cli(doc, build, prefix, argv=None, out_dir=OUT_DIR):
    """Command line shared by the bundlers. `build(upstream, full_sha)` returns
    {bundled file name: text}."""
    ap = argparse.ArgumentParser(description=doc,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--upstream", required=True, metavar="PATH",
                    help="local git checkout of the upstream mod (read-only: only `git show`)")
    ap.add_argument("--rev", required=True, metavar="COMMIT",
                    help="upstream commit to bundle (recorded in docs/BUNDLE.md)")
    ap.add_argument("--check", action="store_true",
                    help="build in memory and compare with panorama/scripts; write nothing")
    args = ap.parse_args(argv)

    try:
        full = resolve_rev(args.upstream, args.rev)
        out = build(args.upstream, full)
        if args.check:
            problems = compare(out, out_dir, prefix)
            for status, name in problems:
                print(f"{status:8} {name}")
            print(f"{len(out) - sum(1 for s, _ in problems if s != 'EXTRA')}/{len(out)} files "
                  f"identical to {short_sha(full)}" + (", tree differs" if problems else ""))
            return EXIT_DIFFERS if problems else EXIT_OK
        written = write(out, out_dir)
        for name in written:
            print(f"wrote    {name}")
        print(f"{len(written)} written, {len(out) - len(written)} unchanged ({short_sha(full)})")
        stale = [n for s, n in compare(out, out_dir, prefix) if s == "EXTRA"]
        if stale:
            # Not deleted automatically: removing a module also means editing the
            # layout that includes it, which is a reviewed change, not a rebuild.
            print("not produced by this build (remove them and their includes by hand): "
                  + ", ".join(stale), file=sys.stderr)
        return EXIT_OK
    except (BundleError, OSError, UnicodeDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_ERROR
