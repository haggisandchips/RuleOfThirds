---
name: todo
description: Summarize this project's outstanding work - TODO.md's items (in order, with completion status) plus any local commits not yet pushed to origin/main - in a clear, scannable format. Use when asked for a status update, "where are we", or to summarize the TODO list.
---

# TODO summary

Give the user a concise status summary of this project's outstanding work. Do this every time
this skill is invoked - don't skip steps even if you believe you already know the current
state, since TODO.md and git state can change between conversations (including from another
device - see CLAUDE.md).

## Steps

1. Read `TODO.md` at the project root. If it doesn't exist, say so plainly and stop (don't
   fabricate a summary) - it's gitignored (`.git/info/exclude`), so it's only present locally,
   not guaranteed to exist in every checkout.
2. Run `git log --oneline origin/main..HEAD` to list local commits not yet on the remote, and
   `git status --short` to check for uncommitted changes.
3. Present the summary in two parts:
   - **Unpushed commits**: short hash + message for each, newest last. If none, say the working
     tree is in sync with `origin/main`. Note any uncommitted changes too, if present.
   - **TODO.md status**: the items in the file's own order, each as one tight bullet - a
     checkmark for a completed (`[x]`) item (what was done, plus its commit hash if the entry
     names one) or an empty box for an open (`[ ]`) item (what it is, condensed - don't just
     paste the full multi-line entry verbatim). Preserve the file's own ordering and numbering;
     don't reorder or reprioritize here - that's TODO.md's own job (see CLAUDE.md's "TODO.md"
     section), this skill only reports.
4. Close with one line noting whether anything is actively in progress or everything is caught
   up, and invite the user to say what to tackle next.

Keep the whole thing scannable - this is a status check, not a full re-read of every TODO
entry's reasoning.
