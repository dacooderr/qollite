#!/usr/bin/env python3
"""Tests for check_upstream.py.

Runs entirely offline against captured fixtures in scripts/fixtures/, so it is
deterministic and does not hit GameBanana. No dependencies beyond the standard
library -- this repo has no test framework and does not need one for this.

    python scripts/test_check_upstream.py

Exit code 0 if every case passes.
"""

import copy
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(HERE, "check_upstream.py")
FIXTURES = os.path.join(HERE, "fixtures")

QUICKBUY, STATLOCKER = 664041, 675877

# What the fixtures actually contain, so the tests assert against known values
# rather than against whatever the tool happens to produce.
LIVE_QUICKBUY = {
    "name": "Enhanced QuickBuy", "version": "1.6", "license": "CC BY-NC-ND",
}


def run(manifest_path, *args):
    env = dict(os.environ, QOLLITE_UPSTREAM_FIXTURES=FIXTURES)
    proc = subprocess.run(
        [sys.executable, TOOL, "--sources", manifest_path, *args],
        capture_output=True, text=True, env=env)
    return proc.returncode, proc.stdout + proc.stderr


def manifest(tmp, entries, name="sources.json"):
    path = os.path.join(tmp, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"checked": None, "mods": entries}, fh, indent=2)
    return path


def entry(feature, mod_id, pinned=None):
    return {"feature": feature, "tier": "vendored", "gamebanana_id": mod_id,
            "upstream": None, "note": "", "pinned": pinned or {}}


def pinned_matching_fixture(mod_id):
    """The pin that means 'what ships is exactly what upstream has now'."""
    with open(os.path.join(FIXTURES, f"{mod_id}.json"), encoding="utf-8") as fh:
        d = json.load(fh)
    return {
        "name": d.get("_sName"),
        "version": d.get("_sVersion") or None,
        "updated": d.get("_tsDateUpdated") or d.get("_tsDateModified"),
        "author": (d.get("_aSubmitter") or {}).get("_sName"),
        "license": "CC BY-NC-ND",
        "files": {f["_sFile"]: f.get("_sMd5Checksum")
                  for f in (d.get("_aFiles") or []) if f.get("_sFile")},
    }


CASES = []


def case(name):
    def deco(fn):
        CASES.append((name, fn))
        return fn
    return deco


@case("in sync -> ok, exit 0")
def t_in_sync(tmp):
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pinned_matching_fixture(QUICKBUY))])
    code, out = run(p)
    assert code == 0, f"exit {code}"
    assert " ok" in out, out
    assert "UPDATE" not in out, out


@case("version drift -> UPDATE, exit 1")
def t_version_drift(tmp):
    pin = pinned_matching_fixture(QUICKBUY)
    pin["version"] = "1.4"
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pin)])
    code, out = run(p)
    assert code == 1, f"exit {code}"
    assert "UPDATE" in out, out
    assert "version 1.4 -> 1.6" in out, out


@case("timestamp drift is reported even when version is unchanged")
def t_timestamp_drift(tmp):
    pin = pinned_matching_fixture(QUICKBUY)
    pin["updated"] = 1700000000
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pin)])
    code, out = run(p)
    assert code == 1, f"exit {code}"
    assert "updated 2023-11-14 ->" in out, out


@case("silent re-upload caught by checksum")
def t_checksum_drift(tmp):
    pin = pinned_matching_fixture(QUICKBUY)
    pin["files"] = {k: "0" * 32 for k in pin["files"]} or {"x.zip": "0" * 32}
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pin)])
    code, out = run(p)
    assert code == 1, f"exit {code}"
    assert "file checksums differ" in out, out


@case("license change raises a loud alarm")
def t_license_change(tmp):
    pin = pinned_matching_fixture(QUICKBUY)
    pin["license"] = "CC BY"
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pin)])
    code, out = run(p)
    assert code == 1, f"exit {code}"
    assert "LICENSE CHANGED: CC BY -> CC BY-NC-ND" in out, out


@case("no baseline reports unknown, not 'up to date'")
def t_no_baseline(tmp):
    p = manifest(tmp, [entry("quickbuy", QUICKBUY)])
    code, out = run(p)
    assert code == 0, f"exit {code}"
    assert "no baseline" in out, out
    assert "UPDATE" not in out, out
    assert "cannot be detected" in out, out


@case("untracked entries are named, not silently dropped")
def t_untracked(tmp):
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pinned_matching_fixture(QUICKBUY)),
                       entry("mystery-mod", None)])
    code, out = run(p)
    assert "mystery-mod" in out, out
    assert "cannot be tracked" in out, out


@case("--update pins, and a re-run then reports ok")
def t_update_roundtrip(tmp):
    pin = pinned_matching_fixture(QUICKBUY)
    pin["version"] = "0.1"
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pin)])
    code, out = run(p, "--update")
    assert code == 0, f"exit {code}"
    with open(p, encoding="utf-8") as fh:
        after = json.load(fh)
    assert after["mods"][0]["pinned"]["version"] == "1.6", after["mods"][0]["pinned"]
    assert after["checked"], "checked date not stamped"
    code, out = run(p)
    assert code == 0 and "UPDATE" not in out, out


@case("--json is valid JSON and carries the verdicts")
def t_json(tmp):
    pin = pinned_matching_fixture(QUICKBUY)
    pin["version"] = "1.4"
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pin)])
    code, out = run(p, "--json")
    assert code == 1, f"exit {code}"
    data = json.loads(out)
    assert data["results"][0]["changed"], data
    assert data["results"][0]["live"]["version"] == "1.6", data


@case("several mods, mixed verdicts")
def t_mixed(tmp):
    stale = pinned_matching_fixture(STATLOCKER)
    stale["version"] = "0.9"
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pinned_matching_fixture(QUICKBUY)),
                       entry("statlocker", STATLOCKER, stale)])
    code, out = run(p)
    assert code == 1, f"exit {code}"
    assert "1 mod(s) have moved upstream" in out, out
    # the stale one must sort above the healthy one
    assert out.index("statlocker") < out.index("quickbuy"), out


@case("missing manifest -> exit 2, no traceback")
def t_missing_manifest(tmp):
    code, out = run(os.path.join(tmp, "nope.json"))
    assert code == 2, f"exit {code}"
    assert "not found" in out, out
    assert "Traceback" not in out, out


@case("unreachable mod is reported, run still completes")
def t_unreachable(tmp):
    p = manifest(tmp, [entry("quickbuy", QUICKBUY, pinned_matching_fixture(QUICKBUY)),
                       entry("ghost", 999999999)])
    code, out = run(p)
    assert "failed to reach" in out, out
    assert "ghost" in out, out
    assert " ok" in out, "the healthy entry should still be reported\n" + out


def main():
    passed, failed = 0, []
    for name, fn in CASES:
        with tempfile.TemporaryDirectory() as tmp:
            try:
                fn(tmp)
                print(f"  PASS  {name}")
                passed += 1
            except AssertionError as exc:
                print(f"  FAIL  {name}\n        {exc}")
                failed.append(name)
            except Exception as exc:  # noqa: BLE001 - a crash is a test failure
                print(f"  ERROR {name}\n        {type(exc).__name__}: {exc}")
                failed.append(name)
    print(f"\n{passed}/{len(CASES)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    if not os.path.isdir(FIXTURES):
        print(f"error: {FIXTURES} missing", file=sys.stderr)
        sys.exit(2)
    sys.exit(main())
