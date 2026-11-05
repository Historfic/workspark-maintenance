# Setting up the other desktop

For Rafael. Work through this top to bottom; it takes about 20–30 minutes plus account sign-ups.
Claude Code's memory does not move between machines, so everything it needs is in `CLAUDE.md`
and `docs/handoff/`. Once the folder is on the new desktop and the plugins are installed, Claude
picks up where we left off.

## 1. Move the project folder

**Before copying anything:** move any personal documents out of the Workspark folder. This
folder becomes a **public** GitHub repository, and a stray `git add .` would publish them.

Copy the whole `Workspark` folder (the `.docx` brief, `CLAUDE.md`, and `docs/`) to the new desktop,
for example to `C:\Users\<you>\Documents\Claude Code\Workspark`. Any method works: USB, OneDrive,
or GitHub Desktop pushing to a temporary private repo. There is no git repo yet; Claude will
initialise one as the first build step once you have answered the open decisions.

## 2. Install tools

Open PowerShell as your normal user and run the ones you are missing:

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS          # Node 22 LTS
winget install GitHub.cli                 # gh — needed so Claude can create the repo and PRs
winget install Microsoft.VisualStudioCode # if not already installed
```

Then, in a fresh terminal:

```powershell
corepack enable                           # provides pnpm
pnpm --version
npm install -g @anthropic-ai/claude-code  # or use the Claude Code desktop app / VS Code extension
npm install -g vercel                     # optional — only if you want the live deploy
```

## 3. Sign in and set identities

Decide first which GitHub account will own the public repo, then set git to match it:

```powershell
git config --global user.name "Your Name"
git config --global user.email "the-email-on-that-github-account@example.com"
gh auth login                             # choose GitHub.com, HTTPS, login with browser
vercel login                              # optional
```

The old desktop's global identity was `Rafael B. Bashan <raffymcfee@gmail.com>`. If that is the
right account, keep it; if the repo should belong to a different account, change both values.

## 4. Install the Claude Code plugins

Start Claude Code inside the Workspark folder, then run these slash commands. If a command form
differs in your version, open `/plugin`, go to the Discover tab and install by name.

```
/plugin install superpowers
/plugin install frontend-design
/plugin marketplace add supabase/agent-skills
/plugin install supabase@supabase-agent-skills
/plugin install postgres-best-practices@supabase-agent-skills
/plugin marketplace add vercel-labs/agent-browser
/plugin install agent-browser@agent-browser
```

`claude-api` is bundled with Claude Code and needs no install. Restart Claude Code after installing.

## 5. Create accounts and keys

Keep every key in your password manager until the project is scaffolded, then paste them into
`.env.local` in the project root (Claude creates that file and gitignores it). Never paste keys
into the chat.

| Service | What to do | What you'll need from it |
|---|---|---|
| Anthropic | console.anthropic.com → API Keys → create key | `ANTHROPIC_API_KEY` |
| Supabase | supabase.com → New project (free tier, any region near you) → Project Settings → API and Database | Project URL, anon key, service-role key, Postgres connection string |
| GitHub | Nothing extra if `gh auth login` succeeded | — |
| Vercel (optional) | Sign up with your GitHub account | Login via CLI, or connect the repo in the dashboard later |
| Speech-to-text (voice bonus) | One of: platform.openai.com, console.deepgram.com (free credit), console.groq.com (free tier) | `STT_API_KEY` and which provider |
| Vapi (optional phone tier) | Your existing account; a phone number you can point at a webhook | API key, and permission for Claude to give you a webhook URL + secret to configure |

Optional but handy: in claude.ai → Settings → Connectors, authorize the **Supabase** connector so
Claude can run the migration and inspect tables directly instead of going through a script.

## 6. Start the session

Open the Workspark folder in VS Code, start Claude Code, and send this as the first message:

> Read CLAUDE.md and docs/handoff/2026-11-05-build-plan.md. Resume the Workspark plan from where
> the previous desktop left off: ask me the open decisions one at a time, record my answers in
> CLAUDE.md, then write the design spec for my review. Don't scaffold anything until I approve
> the spec.

Claude will ask the five open questions, write the spec to `docs/superpowers/specs/`, then an
implementation plan, and only then start building.

## 7. Things to have ready during the build

- The Loom app (or screen recorder) for the ≤ 5 minute walkthrough at the end. Claude writes the
  script; you record.
- About 6–8 hours of focused time across the 72-hour window. Deadline: **2026-11-08**.
