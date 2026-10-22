## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels are used: needs-triage, needs-info, ready-for-agent, ready-for-human and wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and one `docs/adr/` folder at the repo root. See `docs/agents/domain.md`.

## Git workflow

- `main`: stable, release-ready code. Only receives merges from `dev` (or `hotfix/*`).
- `dev`: integration branch. Every feature branch starts from `dev` and merges back into it through a pull request.
- Work branches are created from `dev`, one per feature or functionality, named `<type>/<short-kebab-description>`, with the issue number when there is one (e.g. `feature/12-training-plan-generator`):
  - `feature/`: a new feature or functionality
  - `fix/`: a bug fix
  - `refactor/`: restructuring without changing behaviour
  - `docs/`: documentation only
  - `chore/`: tooling, config, dependencies
  - `hotfix/`: urgent fix branched from `main`, merged into both `main` and `dev`
- Commit messages follow Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `chore: ...`.
- Never commit directly to `main` or `dev`.
