#!/usr/bin/env python3
"""Check local links/anchors in tracked Markdown, without fetching external URLs.

Supports inline links/images, reference definitions, explicit reference uses, common
GitHub heading anchors, HTML id/name anchors and standalone CLAUDE.md imports.
Code examples/comments are ignored. Backticked prose paths and factual freshness
remain review responsibilities; this is a link checker, not a full Markdown parser.
"""

from __future__ import annotations

import html
from pathlib import Path
import re
import subprocess
import sys
import unicodedata
from urllib.parse import unquote, urlsplit


def visible_text(text: str) -> str:
    def blank(match: re.Match) -> str:
        return re.sub(r"[^\n]", " ", match.group())

    text = re.sub(r"<!--.*?-->", blank, text, flags=re.S)
    lines = []
    fence = None
    for line in text.splitlines(keepends=True):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fence:
            lines.append(re.sub(r"[^\n]", " ", line))
            if marker and marker[1][0] == fence[0] and len(marker[1]) >= len(fence):
                fence = None
        elif marker:
            fence = marker[1]
            lines.append(re.sub(r"[^\n]", " ", line))
        else:
            lines.append(line)
    return "".join(lines)


def anchors(text: str) -> set[str]:
    text = visible_text(text)
    result = set(re.findall(r"\b(?:id|name)=[\"']([^\"']+)[\"']", text))
    lines = text.splitlines()
    for i, line in enumerate(lines):
        match = re.match(r"^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$", line)
        if match:
            heading = match[1]
        elif line.strip() and i + 1 < len(lines) and re.fullmatch(r" {0,3}(?:=+|-+)\s*", lines[i + 1]):
            heading = line.strip()
        else:
            continue
        heading = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", heading)
        heading = re.sub(r"<[^>]+>", "", heading)
        heading = html.unescape(heading).lower().replace("`", "").replace("*", "").strip("_~")
        slug = "".join(c for c in heading if c in " -_" or unicodedata.category(c)[0] in "LNM")
        slug = slug.replace(" ", "-")
        unique, suffix = slug, 0
        while unique in result:
            suffix += 1
            unique = f"{slug}-{suffix}"
        result.add(unique)
    return result


def inline_targets(text: str):
    # Read balanced destinations so filenames containing parentheses work too.
    for match in re.finditer(r"!?\[(?:\\.|[^\]\\\n])*\]\(\s*", text):
        start = match.end()
        if start >= len(text):
            continue
        if text[start] == "<":
            end = text.find(">", start + 1)
            if end != -1:
                yield match.start(), text[start + 1:end]
            continue
        end, depth = start, 0
        while end < len(text):
            char = text[end]
            if char == "\\" and end + 1 < len(text):
                end += 2
                continue
            if char == "(":
                depth += 1
            elif char == ")":
                if not depth:
                    break
                depth -= 1
            elif char.isspace() and not depth:
                break
            end += 1
        yield match.start(), re.sub(r"\\(.)", r"\1", text[start:end])


def check_document(root: Path, source: Path) -> tuple[int, list[str]]:
    text = visible_text(source.read_text(encoding="utf-8"))
    # Do not interpret literal Markdown examples in inline code as real links.
    text = re.sub(r"(`+)(.*?)\1", lambda m: re.sub(r"[^\n]", " ", m.group()), text, flags=re.S)
    targets = list(inline_targets(text))
    definitions = set()
    for match in re.finditer(r"^ {0,3}\[([^\]\n]+)\]:\s*(<[^>\n]+>|\S+)", text, re.M):
        definitions.add(" ".join(match[1].split()).casefold())
        targets.append((match.start(), match[2].strip("<>")))
    errors = []
    for match in re.finditer(r"!?\[([^\]\n]+)\]\[([^\]\n]*)\]", text):
        label = " ".join((match[2] or match[1]).split()).casefold()
        if label not in definitions:
            line = text.count("\n", 0, match.start()) + 1
            errors.append(f"{source.relative_to(root)}:{line}: undefined reference [{label}]")
    if source.name == "CLAUDE.md":
        targets.extend((m.start(), m[1]) for m in re.finditer(r"^@([^\s]+)\s*$", text, re.M))
    checked = 0
    for offset, target in targets:
        try:
            url = urlsplit(target)
        except ValueError:
            errors.append(f"{source.relative_to(root)}: invalid link URL {target}")
            continue
        if url.scheme or url.netloc:
            continue
        checked += 1
        line = text.count("\n", 0, offset) + 1
        label = f"{source.relative_to(root)}:{line}: {target}"
        path = unquote(url.path)
        destination = (root / path.lstrip("/")) if path.startswith("/") else source.parent / path
        if not path:
            destination = source
        if not destination.resolve().is_relative_to(root.resolve()):
            errors.append(f"{label}: path leaves the repository")
            continue
        if not destination.exists():
            errors.append(f"{label}: missing path")
        elif url.fragment and destination.suffix.lower() in {".md", ".html"}:
            if unquote(url.fragment) not in anchors(destination.read_text(encoding="utf-8")):
                errors.append(f"{label}: missing anchor")
    return checked, errors


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    files = subprocess.check_output(["git", "ls-files", "-z", "--", "*.md"], cwd=root).decode().split("\0")
    files = [root / name for name in files if name]
    checked, errors = 0, []
    for source in files:
        count, problems = check_document(root, source)
        checked += count
        errors.extend(problems)
    for error in errors:
        print(error, file=sys.stderr)
    print(f"{len(files)} tracked Markdown files; {checked} local links/imports; {len(errors)} error(s)")
    return bool(errors)


if __name__ == "__main__":
    sys.exit(main())
