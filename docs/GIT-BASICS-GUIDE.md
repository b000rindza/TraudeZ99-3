# Git Basics Guide: Merge, Squash & Rebase

> Written for beginners — explained like you're in high school.

---

## Table of Contents

1. [What is Merging?](#1-what-is-merging)
2. [What is Squash?](#2-what-is-squash)
3. [What is Rebase?](#3-what-is-rebase)
4. [Merge vs Squash vs Rebase — Quick Comparison](#4-merge-vs-squash-vs-rebase--quick-comparison)
5. [Handling Merge Conflicts](#5-handling-merge-conflicts)
6. [How to Use Claude AI "+New Session" for Co-Active Development](#6-how-to-use-claude-ai-new-session-for-co-active-development)

---

## 1. What is Merging?

### The Analogy

Imagine you and your friend are both writing chapters of the same book. You're writing Chapter 3, and your friend is writing Chapter 4. When you're both done, you **combine** (merge) your chapters into the main book.

### In Git Terms

A **merge** takes the changes from one branch and combines them into another branch.

```
main:        A --- B --- C ----------- M  (merge commit)
                          \           /
feature:                   D --- E --
```

- You create a **feature branch** to work on something new.
- When you're done, you **merge** it back into `main`.
- Git creates a special **merge commit** (M) that ties everything together.

### How to Do It

```bash
# Step 1: Switch to the branch you want to merge INTO
git checkout main

# Step 2: Merge your feature branch into main
git merge my-feature-branch

# Step 3: Push the result
git push
```

### On GitHub (what you see in your screenshots)

When you open a **Pull Request** on GitHub, the green **MERGE** button does exactly this. It takes your branch's changes and merges them into the target branch.

If you see **"Branch has merge conflicts"** (like in your screenshot), it means Git found lines that were changed in BOTH branches and doesn't know which version to keep. You have to manually pick which changes to keep — see [Section 5](#5-handling-merge-conflicts).

---

## 2. What is Squash?

### The Analogy

Imagine you wrote a school essay, but your drafts look like this:

1. "Started the essay"
2. "Fixed a typo"
3. "Added another paragraph"
4. "Oops, fixed another typo"
5. "Actually done now"

That's messy. **Squash** is like taking all 5 drafts and combining them into one clean final version: **"Wrote the essay."**

### In Git Terms

**Squash** combines multiple commits into a single commit. It keeps your history clean and easy to read.

```
BEFORE squash (5 messy commits):
  D1 --- D2 --- D3 --- D4 --- D5

AFTER squash (1 clean commit):
  S
```

### How to Do It

**Option A: Squash when merging (most common)**

```bash
git checkout main
git merge --squash my-feature-branch
git commit -m "Add login feature"
```

**Option B: On GitHub**

When merging a Pull Request, click the dropdown arrow next to the MERGE button and select **"Squash and merge"**. This takes all your branch's commits and squashes them into one before merging.

### When to Use Squash

- Your branch has a bunch of small "work in progress" commits.
- You want the main branch history to be clean and readable.
- Each feature = one commit in the history.

---

## 3. What is Rebase?

### The Analogy

Imagine you started building a LEGO set on Monday. While you were building, your friend added new pieces to the base on Tuesday. Now your section doesn't fit anymore because the base changed.

**Rebase** is like taking apart your section, updating the base to include your friend's changes, and then **re-building your section on top of the updated base** — as if you started after your friend was done.

### In Git Terms

**Rebase** moves your branch's commits so they start from the latest point of another branch, instead of where you originally branched off.

```
BEFORE rebase:
main:        A --- B --- C
                    \
feature:             D --- E

AFTER rebase:
main:        A --- B --- C
                          \
feature:                   D' --- E'
```

Notice D and E become D' and E' — they're the "same" changes but replayed on top of C.

### How to Do It

```bash
# While on your feature branch:
git checkout my-feature-branch

# Rebase onto the latest main:
git rebase main

# If there are conflicts, fix them, then:
git add .
git rebase --continue
```

### Why Use Rebase?

- It creates a **clean, straight-line history** (no merge commits).
- Makes it look like you always started from the latest code.
- Easier to read the project history.

### Warning

**Never rebase a branch that other people are also working on.** Rebase rewrites history, and that can cause chaos for your teammates. Only rebase your own local branches.

---

## 4. Merge vs Squash vs Rebase — Quick Comparison

| Feature | Merge | Squash | Rebase |
|---|---|---|---|
| **What it does** | Combines branches with a merge commit | Combines all commits into one, then merges | Replays your commits on top of another branch |
| **History** | Preserves all commits + adds merge commit | Cleans up into 1 commit | Linear, clean history |
| **Best for** | Team projects, preserving full history | Cleaning up messy feature branches | Keeping your branch up-to-date |
| **Difficulty** | Easy | Easy | Medium (can cause issues if misused) |
| **Safe for shared branches?** | Yes | Yes | NO — only for your own branches |

### Visual Summary

```
=== MERGE ===
main:    A---B---C-------M
              \         /
feature:       D---E---F

=== SQUASH + MERGE ===
main:    A---B---C---S
              \
feature:       D---E---F  (these commits are "squashed" into S)

=== REBASE + MERGE ===
main:    A---B---C---D'---E'---F'
              \
feature:       D---E---F  (original commits, now replayed as D', E', F')
```

---

## 5. Handling Merge Conflicts — Full Walkthrough

From your screenshot, PR #2 shows: **"Branch has merge conflicts"**. Here's what that means, and a complete step-by-step guide using the **real conflicts from your project**.

### Why Conflicts Happen

Two branches changed the **same lines** in the **same file**. Git doesn't know which version is correct, so it asks YOU to decide.

In your case, both `claude/trading-bot-roadmap-BcQbz` and `claude/trading-bot-roadmap-rXmUU` changed these files:
- `.gitignore`
- `README.md`
- `ROADMAP.md`
- `package.json`
- `src/index.ts`
- `tsconfig.json`

### Step 1: Understand the Conflict Markers

When Git finds a conflict, it marks the file with special markers. Here's a **real example** from your `src/index.ts`:

```typescript
<<<<<<< HEAD
/**
 * TraudeZ99-3 — Leveraged Trading Bot
 */
import { TradingEngine, TradingEngineConfig } from "./core/engine";

async function main(): Promise<void> {
  const config: TradingEngineConfig = {
    exchange: process.env.EXCHANGE ?? "binance",
    // ... simpler version
  };
  console.log("TraudeZ99-3 Trading Bot");
  const engine = new TradingEngine(config);
  await engine.start();
}
=======
import { env } from './config/index.js';
import { createChildLogger } from './utils/logger.js';

const log = createChildLogger('main');

async function main() {
  log.info({ mode: env.TRADING_MODE, exchange: env.DEFAULT_EXCHANGE },
    'TraudeZ99-3 starting');
  log.info('Bot initialized successfully.');
}
>>>>>>> origin/claude/trading-bot-roadmap-rXmUU
```

**Think of it like this:**

```
<<<<<<< HEAD                    ← "HERE IS VERSION A (the branch you're merging INTO)"
  ... version A code ...
=======                         ← "HERE IS THE DIVIDER"
  ... version B code ...
>>>>>>> other-branch            ← "HERE IS VERSION B (the branch you're merging FROM)"
```

It's like Git is saying: *"Hey, I found two different answers. You pick."*

### Step 2: Decide What to Keep

You have **three choices** for every conflict:

#### Choice A: Keep Only the TOP Version (HEAD)

Delete everything from `=======` to `>>>>>>>`, and delete the marker lines:

```typescript
// RESULT: kept HEAD only
/**
 * TraudeZ99-3 — Leveraged Trading Bot
 */
import { TradingEngine, TradingEngineConfig } from "./core/engine";

async function main(): Promise<void> {
  const config: TradingEngineConfig = { /* ... */ };
  console.log("TraudeZ99-3 Trading Bot");
  const engine = new TradingEngine(config);
  await engine.start();
}
```

#### Choice B: Keep Only the BOTTOM Version (incoming branch)

Delete everything from `<<<<<<< HEAD` to `=======`, and delete the marker lines:

```typescript
// RESULT: kept incoming only
import { env } from './config/index.js';
import { createChildLogger } from './utils/logger.js';

const log = createChildLogger('main');

async function main() {
  log.info({ mode: env.TRADING_MODE, exchange: env.DEFAULT_EXCHANGE },
    'TraudeZ99-3 starting');
  log.info('Bot initialized successfully.');
}
```

#### Choice C: Keep BOTH (combine them)

Sometimes you want pieces from both versions. You manually edit the file to combine the best parts:

```typescript
// RESULT: combined the best of both
import { env } from './config/index.js';
import { createChildLogger } from './utils/logger.js';

const log = createChildLogger('main');

async function main(): Promise<void> {
  log.info({
    mode: env.TRADING_MODE,
    exchange: env.DEFAULT_EXCHANGE,
    pairs: env.TRADING_PAIRS,
  }, 'TraudeZ99-3 starting');

  log.info('Bot initialized successfully. Waiting for market data...');
}
```

### Step 3: Remove ALL Conflict Markers

This is the most important step. After you decide, make sure **none** of these lines remain in the file:

```
<<<<<<< HEAD
=======
>>>>>>> branch-name
```

If you leave even one marker in, your code will be broken. Most editors highlight these in bright red/yellow to help you spot them.

### Step 4: Save, Stage, and Commit

```bash
# After fixing ALL conflicted files:
git add .gitignore README.md ROADMAP.md package.json src/index.ts tsconfig.json

# Create a commit that records the resolution:
git commit -m "Resolve merge conflicts between roadmap branches"

# Push the result:
git push
```

### Real Example: Your `package.json` Conflict

Here's another real conflict from your project. Both branches defined `package.json` differently:

```json
{
<<<<<<< HEAD
  "name": "traudez99-3",
  "description": "Leveraged trading bot with multi-strategy support",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "test": "jest"
  },
  "dependencies": {
    "ccxt": "^4.0.0"
  }
=======
  "name": "tradez99-3",
  "description": "A modular, strategy-agnostic cryptocurrency trading bot",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ tests/"
  },
  "dependencies": {
    "ccxt": "^4.4.0",
    "dotenv": "^16.4.0",
    "pino": "^9.5.0",
    "zod": "^3.24.0"
  }
>>>>>>> origin/claude/trading-bot-roadmap-rXmUU
}
```

**How to decide:**
- The bottom version (`rXmUU`) has more dependencies, more scripts, and uses newer tools (`tsx`, `vitest` instead of `ts-node`, `jest`).
- If `rXmUU` is the more complete/recent work, keep that version.
- If both have things you want, combine them manually.

### Doing It on GitHub (Browser)

If the conflicts are simple enough, GitHub shows a **"Resolve conflicts"** button on the PR page:

1. Click **"Resolve conflicts"**
2. GitHub opens a text editor showing the conflict markers
3. Edit the file directly in your browser — delete the markers, keep what you want
4. Click **"Mark as resolved"** for each file
5. When all files are resolved, click **"Commit merge"**

### Doing It on Your Computer (Command Line)

```bash
# 1. Switch to the base branch
git checkout claude/trading-bot-roadmap-BcQbz

# 2. Pull the latest
git pull

# 3. Start the merge
git merge origin/claude/trading-bot-roadmap-rXmUU

# 4. Git will say "CONFLICT" — this is normal!
# 5. Open each conflicted file in your editor
# 6. Fix the conflicts (remove markers, pick the code you want)
# 7. Stage the fixed files
git add .

# 8. Complete the merge
git commit -m "Resolve merge conflicts"

# 9. Push
git push
```

### Pro Tips

- **When in doubt, keep the newer version.** If one branch is clearly more recent/complete, go with that one.
- **Use VS Code** — it has a built-in merge conflict editor with buttons: "Accept Current", "Accept Incoming", "Accept Both". Extremely helpful.
- **Don't panic.** Conflicts look scary but they're just Git asking you to make a decision. You can always undo with `git merge --abort` if you mess up.
- **Test after resolving.** After fixing all conflicts, run your code (`npm run build`, `npm test`) to make sure nothing is broken.

---

## 6. How to Use Claude AI "+New Session" for Co-Active Development

From your screenshot, you have the Claude Code app with sessions like:
- "0 -- Create trading bot roadmap"
- "1 -- Trading bot roadmap planning session"

### What is a Session?

Think of each session as a **separate conversation** with Claude about your project. Like having different chat threads with a tutor — one for math homework, one for science.

### How to Use Multiple Sessions Effectively

#### Strategy 1: One Session Per Task

```
Session 0: "Create trading bot roadmap"     → Planning & big picture
Session 1: "Implement exchange client"       → Actual coding for one module
Session 2: "Write tests for risk manager"    → Testing a different module
Session 3: "Fix merge conflicts"             → Troubleshooting
```

Each session stays focused on ONE thing. This keeps context clean and avoids confusion.

#### Strategy 2: Planning + Execution Split

```
Session A (Planning):    "Help me plan the architecture for feature X"
Session B (Execution):   "Now implement feature X based on this plan: ..."
```

Use one session to think and plan, another to actually write code.

#### Strategy 3: Parallel Workstreams

If your project has independent parts (like yours has `strategies/`, `exchange/`, `risk/`), you can have:

```
Session 1: Working on strategies/mean-reversion.ts
Session 2: Working on exchange/client.ts
Session 3: Working on risk/manager.ts
```

Each session works on a different part of the codebase without stepping on each other's toes.

### Tips for Getting the Most Out of Sessions

1. **Give each session a clear name** — Future you will thank present you.
2. **Start sessions with context** — Tell Claude what files you're working on and what you want to accomplish.
3. **Keep sessions focused** — Don't mix "fix this bug" with "plan new feature" in the same session.
4. **Reference other sessions** — "In my other session, we planned X. Now implement it."
5. **Use sessions for different branches** — One session per Git branch keeps things organized.

### Your Workflow Example

Based on your screenshots, here's how you could organize:

```
Session 0: "Create trading bot roadmap"
  → Already done! Created ROADMAP.md and project scaffolding.

Session 1: "Trading bot roadmap planning session"
  → Refined the plan, discussed architecture.

Session 2 (NEW): "Implement Phase 0 — exchange client"
  → Start coding the actual exchange integration.

Session 3 (NEW): "Resolve PR #2 merge conflicts"
  → Fix the conflicts shown in your screenshot.
```

---

## Quick Reference Cheat Sheet

```bash
# === MERGE ===
git checkout main
git merge feature-branch

# === SQUASH MERGE ===
git checkout main
git merge --squash feature-branch
git commit -m "One clean commit message"

# === REBASE ===
git checkout feature-branch
git rebase main

# === FIX MERGE CONFLICTS ===
# 1. Edit the conflicted files
# 2. Remove <<<<<<< ======= >>>>>>> markers
# 3. git add <fixed-files>
# 4. git commit (for merge) or git rebase --continue (for rebase)

# === CHECK STATUS ===
git status          # See what's going on
git log --oneline   # See commit history
git branch          # See which branch you're on
```

---

*This guide was created for the TraudeZ99-3 trading bot project to help team members understand core Git workflows and Claude AI session management.*
