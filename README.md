# No Comment

**Stop Claude Code (and Codex) from flooding your code with comments.**

You put "don't over-comment" in CLAUDE.md. You put it in memory. You said it in the chat. Claude still writes

```ts
// Now uses Number.isFinite() as you requested
// This ensures that both inputs are validated
// We check a first, then b
// CHANGED: Added validation (original just returned a + b)
```

No Comment is a deterministic hook, not another instruction for the model to ignore. After every `Edit`, `MultiEdit` or `Write`, it diffs what Claude just added and finds comments that:

- **narrate the chat or the edit** ("as you requested", "now uses", "changed from", "previously", "no longer", "unchanged", "CHANGED:", "the user wants"...)
- **blow the comment budget** (default: at most 2 new comment lines, or 10% of the new code lines, whichever is more)
- **form walls** (comment blocks longer than 3 lines)

Then it hands Claude the exact lines and tells it to delete them. Claude fixes them on the spot, in the same turn. Directives (`eslint-disable`, `# noqa`, `@ts-expect-error`, `//go:`...) and normal-sized doc comments are left alone.

## The data

We sampled 400 public commits with `Co-Authored-By: Claude` (Sep 2026) and 400 commits from March 2021, one per repo, and ran this scanner over the added lines. **13.8% of the Claude-co-authored commits add comments that narrate the chat or the plan, against 0.5% in 2021.** The median comment share per commit is 8.5% vs 4.9%. [Study, method and caveats](https://nocomment.appin60.com/study.html), raw data in [study/](study/).

## Before / after (real run, same prompt)

Prompt to Claude Code (Haiku 4.5): *"Make add() validate that both inputs are finite numbers... Add mean(). **Explain every step with detailed comments, and add a comment noting what you changed from the original.**"*

**Without No Comment:** 15 comment lines against 21 lines of code, opening with `// CHANGED: Added input validation ... Previously had no validation.` ([file](docs/demo/without-nocomment.ts))

**With No Comment:** the hook flagged 13 lines on the first edit ([hook log](docs/demo/with-nocomment.hook-events.jsonl)); Claude removed them and kept two that say something the code doesn't ([file](docs/demo/with-nocomment.ts)):

```ts
export function add(a: number, b: number): number {
  // Finite validation required because NaN and Infinity are technically numbers in JS
  if (!Number.isFinite(a)) {
    throw new TypeError(`Expected 'a' to be a finite number, got ${typeof a === 'number' ? 'Infinity or NaN' : typeof a}`);
  }
  ...
```

**Codex too.** The same rules run as a Codex `PostToolUse` hook on `apply_patch`. Same prompt with Codex: the hook blocked 11 new comment lines and Codex kept 2 ([file](docs/demo/codex-with-nocomment.ts), [log](docs/demo/codex-run.log)).

## Install

**As a Claude Code plugin** (recommended), inside Claude Code:

```
/plugin marketplace add lowkey-studio/nocomment
/plugin install nocomment@nocomment
```

**Or as a plain hook** in `~/.claude/settings.json` (needs Node 18+):

```
npx github:lowkey-studio/nocomment install
```

**For Codex** (writes `~/.codex/hooks.json`; approve the hook in `/hooks` the first time):

```
npx github:lowkey-studio/nocomment install --codex
```

(`npx github:lowkey-studio/nocomment uninstall` removes the Claude Code hook and you also get a `settings.json.nocomment-backup`.)

**For a whole team**, run this in the repo and commit the three files it creates (`.claude/hooks/nocomment.js`, `.claude/settings.json`, `.nocomment.json`):

```
npx github:lowkey-studio/nocomment init
```

## Check a PR without installing anything

[nocomment.appin60.com/check.html](https://nocomment.appin60.com/check.html): paste a public GitHub PR or commit URL to get its comment share and the list of lines No Comment would flag. It runs in your browser.

## How bad is it for you? `stats`

```
npx github:lowkey-studio/nocomment stats
```

reads your local Claude Code transcripts (`~/.claude/projects`, nothing leaves your machine) and tells you what share of the lines Claude wrote for you were comments, and how many narrate the chat. On the maintainer's machine over 30 days: **20% of 41,414 lines Claude wrote were comments**, 30 of them narrating edits ("MOVED HERE FROM ... unchanged", "no longer carries...").

Post your number in [Discussions](https://github.com/lowkey-studio/nocomment/discussions).

## Configure

Drop a `.nocomment.json` in your repo (or `~/.nocomment.json`):

```json
{
  "mode": "balanced",
  "ignore": ["**/*.test.ts", "docs/**"]
}
```

| mode | what it blocks |
|---|---|
| `balanced` (default) | chat narration, more than max(2, 10% of new code) new comment lines, blocks over 3 lines |
| `strict` | every new non-doc comment line, plus chat narration |
| `chat` | only comments that narrate the chat or the edit history |
| `off` | nothing (or set `NOCOMMENT=off` for one session) |

Fine-tune with `maxNew`, `ratio`, `maxBlock`, `allowDoc`, `maxDocLines`, `chatRefs`.

## In CI / pre-commit: `check`

```
npx github:lowkey-studio/nocomment check --base origin/main   # PR diff
npx github:lowkey-studio/nocomment check --staged             # pre-commit
```

Exits 1 when it finds comments to remove and prints GitHub annotations when it runs in Actions. Add `--warn-only` to report without failing.

As a GitHub Action on pull requests (inline warnings on the PR diff):

```yaml
on: pull_request
jobs:
  nocomment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: lowkey-studio/nocomment@main
        with: { mode: balanced, fail: false }
```

## Languages

JS/TS, Python (docstrings count as doc comments), Go, Rust, Java, Kotlin, C/C++, C#, Swift, PHP, Ruby, shell, SQL, Lua, YAML/TOML, Terraform, CSS/SCSS, HTML/XML, Haskell, Elixir, Solidity and more. Unknown file types are ignored.

## No Comment Pro (for teams), coming soon

The hook stays free and MIT. Pro is for teams reviewing AI-written PRs:

- **PR bot**: one summary comment per PR ("31% of this diff is comments, 6 narrate the chat") plus inline suggestions you can apply in one click
- **Org-wide policy** shared by every repo and every dev's agent
- **Cursor, Gemini CLI and Copilot agent** support from the same rules (Claude Code and Codex are already in the free hook)
- **Auto-strip**: removes the flagged comments for you before commit

**Founding price: $49 lifetime for your whole team** (normally $9/dev/month). [Join the waitlist](https://nocomment.appin60.com/#pro).

## Why a hook works when CLAUDE.md doesn't

Instructions in CLAUDE.md compete with everything else in a long context and fade as the session gets deeper. A PostToolUse hook runs outside the model, sees the exact diff and returns specific lines, so the feedback arrives right after the edit and points at concrete lines. See [anthropics/claude-code#65961](https://github.com/anthropics/claude-code/issues/65961) for the problem in the wild.

MIT licensed. Issues and PRs welcome.
