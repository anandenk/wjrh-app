"""Regression cases for actual broken-link failures and ignored Markdown examples."""

from pathlib import Path
import tempfile
import unittest

from check_docs import check_document


class DocsLinksTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, path, content=""):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(content, encoding="utf-8")
        return file

    def check(self, content, path="docs/guide.md"):
        return check_document(self.root, self.write(path, content))

    def test_encoded_paths_and_balanced_parentheses(self):
        self.write("assets/cover (demo).png")
        self.write("docs/other.md", "# Other")
        count, errors = self.check('![cover](../assets/cover%20(demo).png)\n[page](other.md "Title")')
        self.assertEqual((count, errors), (2, []))

    def test_missing_file_reports_source_and_line(self):
        _, errors = self.check("# Guide\n\n[missing](gone.md)")
        self.assertEqual(errors, ["docs/guide.md:3: gone.md: missing path"])

    def test_self_and_cross_file_heading_anchors(self):
        self.write("docs/api.md", "# API layer (`src/api/`)\n## Usage\n## Usage\n")
        count, errors = self.check("# Guide\n[here](#guide)\n[API](api.md#api-layer-srcapi)\n[second](api.md#usage-1)")
        self.assertEqual((count, errors), (3, []))

    def test_missing_heading_fails_even_when_file_exists(self):
        self.write("docs/api.md", "# API")
        _, errors = self.check("[API](api.md#deleted-heading)")
        self.assertIn("missing anchor", errors[0])

    def test_explicit_html_anchor_and_setext_heading(self):
        count, errors = self.check('<a id="details"></a>\nTitle\n=====\n[one](#details) [two](#title)')
        self.assertEqual((count, errors), (2, []))

    def test_external_urls_are_not_fetched(self):
        self.assertEqual(self.check('[web](https://example.invalid/a#b) [mail](mailto:x@example.invalid)'), (0, []))

    def test_fenced_inline_and_comment_examples_are_ignored(self):
        content = "```md\n[bad](missing.md)\n```\n~~~\n[bad](missing.md)\n~~~\n`[bad](missing.md)`\n<!-- [bad](missing.md) -->"
        self.assertEqual(self.check(content), (0, []))

    def test_reference_links_are_resolved_case_insensitively(self):
        self.write("docs/api.md", "# API")
        count, errors = self.check('[read][API Guide]\n[API Guide][]\n[api guide]\n\n[api guide]: api.md#api')
        self.assertEqual((count, errors), (1, []))

    def test_reference_target_missing_file_is_detected(self):
        _, errors = self.check('[read][guide]\n\n[guide]: gone.md')
        self.assertIn("gone.md: missing path", errors[0])

    def test_undefined_explicit_reference_is_detected(self):
        _, errors = self.check('[read][missing]')
        self.assertIn("undefined reference [missing]", errors[0])

    def test_standalone_project_import_is_checked(self):
        _, errors = self.check("# Instructions\n@AGENTS.md", "CLAUDE.md")
        self.assertIn("missing path", errors[0])
        self.write("AGENTS.md", "# Rules")
        self.assertEqual(self.check("@AGENTS.md", "CLAUDE.md"), (1, []))

    def test_local_link_cannot_escape_the_repository(self):
        _, errors = self.check('[outside](../../outside.md)')
        self.assertIn("path leaves the repository", errors[0])


if __name__ == "__main__":
    unittest.main()
