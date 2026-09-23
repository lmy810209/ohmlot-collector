# ohmlot-collector

Daily collector (`src/`) for personal-robot list prices and FCC grants → `data/`, plus the ohmlot.com site in
`web/` (Next.js App Router, statically built from `data/`). See `README.md` and `web/README.md`.

## Visual Development

### Design Principles
- Comprehensive design checklist in `context/design-principles.md`
- Brand style guide in `context/style-guide.md`
- When making visual (front-end, UI/UX) changes, always refer to these files for guidance

### Quick Visual Check
IMMEDIATELY after implementing any front-end change:
1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view (local preview: `cd web && npm run build && npm start -- -p 3210`)
3. **Verify design compliance** - Compare against `context/design-principles.md` and `context/style-guide.md`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshots at desktop (1440px) and phone (390px) widths, light and dark
7. **Check for errors** - Run `mcp__playwright__browser_console_messages`

### Comprehensive Design Review
Invoke the `@agent-design-review` subagent for thorough design validation when:
- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- Needing comprehensive accessibility and responsiveness testing
