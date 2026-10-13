---
description: Set the No Comment mode for this repo (strict | balanced | chat | off), or show comment stats
argument-hint: "[strict|balanced|chat|off|stats]"
allowed-tools: Bash(node:*), Read, Write
---

The user ran `/nocomment $ARGUMENTS`.

- If the argument is `strict`, `balanced`, `chat` or `off`: write `.nocomment.json` at the repository root with `{"mode": "<that mode>"}`, keeping any other keys already in the file. Then reply with one line confirming the mode:
  - strict: no new comment lines except doc comments
  - balanced: chat narration blocked, small budget
  - chat: only narration blocked
  - off: nothing blocked
- If the argument is `stats` or empty: run `node "${CLAUDE_PLUGIN_ROOT}/bin/nocomment.js" stats --days 30` and show the output as is.

Do not add any comments to files while doing this.
