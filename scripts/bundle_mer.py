#!/usr/bin/env python3
"""Bundle Map Event Reminders (MER) into QOL Lite as panorama/scripts/qollite_notifications_*.js.

MER is a first-party mod with its own repository. Its scripts are regenerated
from an upstream commit by this tool -- editing the bundled copies here loses the
change on the next rebuild (docs/BUNDLE.md).

Transformation (derived from the previously bundled Closure build vs MER b8907bc):
  1. file rename    notif_<x>.js / event_schedule.js / notif.js ->
                    qollite_notifications_<y>.js (FILES; the table is the rule)
  2. global rename  NotifLog, NOTIF_CONFIG, ... -> QolLiteNotifications* (GLOBALS),
                    word boundary, longest name first
  3. module file names mentioned in comments -> bundled names
  4. QOL Lite delta: notif_log.js `var DEBUG = true;` -> false
  5. non-ASCII: inside string literals -> \\uXXXX escapes; in comments -> ASCII
     punctuation (COMMENT_ASCII). The previous bundle was pure ASCII; whether
     Panorama decodes raw UTF-8 JS correctly is not verified.
  6. a 4-line provenance header per file
Unchanged on purpose: log prefixes ([NOTIF], [NOTIF][bridge], [NOTIF][urn]), bus
payloads ({notif:1,...}), UMM id "eventnotifier" and every setting key, "use strict".

Usage:
    python scripts/bundle_mer.py --upstream <MapEventReminders checkout> --rev <commit>
    python scripts/bundle_mer.py --upstream <MapEventReminders checkout> --rev <commit> --check

The upstream checkout is only read (`git show`), never its working tree.

Exit codes:  0 = written / identical   1 = --check found differences   2 = error
"""

import re
import sys

from bundle_common import BundleError, cli, git_show, short_sha

UPSTREAM_URL = "github.com/gfkm/MapEventReminders"
UPSTREAM_DIR = "mod/panorama/scripts"
OUT_PREFIX = "qollite_notifications_"

# Upstream file -> bundled suffix; order = overlay load order, then the two top-bar bridges.
FILES = {
    "notif_log.js": "log", "notif_config.js": "config", "notif_strings.js": "strings",
    "event_schedule.js": "event_schedule", "notif_clock.js": "clock",
    "notif_scheduler.js": "scheduler", "notif_manager.js": "manager",
    "notif_umm.js": "umm_adapter", "notif.js": "bootstrap",
    "notif_clock_bridge.js": "clock_bridge", "notif_urn.js": "urn_detector",
}
GLOBALS = {
    "NotifLog": "QolLiteNotificationsLog", "NOTIF_CONFIG": "QolLiteNotificationsConfig",
    "NOTIF_STRINGS": "QolLiteNotificationsStrings", "EVENT_SCHEDULE": "QolLiteNotificationsEventSchedule",
    "NotifClockBridge": "QolLiteNotificationsClockBridge", "NotifClock": "QolLiteNotificationsClock",
    "NotifScheduler": "QolLiteNotificationsScheduler", "NotifManager": "QolLiteNotificationsManager",
    "NotifUmm": "QolLiteNotificationsUmmAdapter", "NotifUrn": "QolLiteNotificationsUrnDetector",
}
# Every non-ASCII character MER uses in comments (as of the bundled commit). A new
# one fails the build rather than being guessed at.
COMMENT_ASCII = {"—": "-", "–": "-", "’": "'", "‘": "'", "“": '"',
                 "”": '"', "→": "->", "…": "..."}

DEBUG_FILE = "notif_log.js"
DEBUG_ON = "var DEBUG = true;"
# Replaces the DEBUG line and the comment line that follows it upstream.
DEBUG_LINES = re.compile(r"var DEBUG = true;[^\n]*\n[^\n]*\n")
DEBUG_OFF = ("var DEBUG = false; // QOL Lite delta: upstream ships true. log() only fires on\n"
             "                       // state changes; info/error stay on. See docs/BUNDLE.md.\n")


def bundled_name(up):
    return f"{OUT_PREFIX}{FILES[up]}.js"


def rename_globals(src):
    # Longest first, so NotifClockBridge is not consumed as NotifClock + "Bridge".
    for a, b in sorted(GLOBALS.items(), key=lambda kv: -len(kv[0])):
        src = re.sub(r"\b" + a + r"\b", b, src)
    return src


def rename_files(src):
    # The lookbehind leaves path-qualified names (mod/panorama/scripts/notif.js,
    # x.notif.js) alone: those describe upstream.
    for up in FILES:
        src = re.sub(r"(?<![\w/.])" + re.escape(up) + r"\b", bundled_name(up), src)
    return src


def disable_debug(src):
    if src.count(DEBUG_ON) != 1:
        raise BundleError("DEBUG line changed upstream - revisit the delta")
    src = DEBUG_LINES.sub(DEBUG_OFF, src, count=1)
    if "var DEBUG = false;" not in src:
        raise BundleError("DEBUG delta did not apply")
    return src


def to_ascii(src):
    """Escape non-ASCII in string literals, transliterate it in comments. Tiny JS lexer:
    tracks '...', "...", `...`, // and /* */. It does not know regex literals; none in
    MER contains a quote or non-ASCII, and the ASCII check in transform() plus
    `node --check` on the output catch it if that changes."""
    out, i, n, mode = [], 0, len(src), None
    while i < n:
        c = src[i]
        if mode is None:
            if src.startswith("//", i):
                mode = "lc"
            elif src.startswith("/*", i):
                mode = "bc"
            elif c in "'\"`":
                mode = c
            out.append(c)
            i += 1
            if mode in ("lc", "bc"):
                out.append(src[i])
                i += 1
            continue
        if mode in ("'", '"', "`"):
            if c == "\\":
                out.append(src[i:i + 2])
                i += 2
                continue
            if c == mode:
                mode = None
            out.append(c if ord(c) < 128 else "\\u%04x" % ord(c))
            i += 1
            continue
        # comments
        if mode == "lc" and c == "\n":
            mode = None
        if mode == "bc" and src.startswith("*/", i):
            out.append("*/")
            i += 2
            mode = None
            continue
        if ord(c) >= 128:
            if c not in COMMENT_ASCII:
                raise BundleError(f"unmapped non-ASCII in comment: {c!r}")
            out.append(COMMENT_ASCII[c])
        else:
            out.append(c)
        i += 1
    return "".join(out)


def header(short, up):
    return (f"// Bundled from Map Event Reminders ({UPSTREAM_URL}) @ {short}, {UPSTREAM_DIR}/{up}.\n"
            "// Our own mod: edit upstream and re-bundle; changes made only here are lost. Transformation\n"
            "// (renames, ASCII escaping, deltas) is recorded in docs/BUNDLE.md. docs/ paths in comments\n"
            "// below refer to the upstream repo.\n")


def transform(up, src, short):
    """One upstream file's text -> the bundled file's text. Pure; no git."""
    if "\r" in src:
        raise BundleError(f"{up}: CR in upstream source (the bundle is LF-only)")
    src = rename_files(rename_globals(src))
    if up == DEBUG_FILE:
        src = disable_debug(src)
    out = header(short, up) + to_ascii(src)
    if any(ord(ch) >= 128 for ch in out):
        raise BundleError(f"{up}: non-ASCII survived")
    left = [name for name in GLOBALS if re.search(r"\b" + name + r"\b", out)]
    if left:
        raise BundleError(f"{up}: unrenamed globals {left}")
    return out


def build(upstream, full_sha):
    short = short_sha(full_sha)
    return {bundled_name(up): transform(up, git_show(upstream, full_sha, f"{UPSTREAM_DIR}/{up}"), short)
            for up in FILES}


if __name__ == "__main__":
    sys.exit(cli(__doc__, build, OUT_PREFIX))
