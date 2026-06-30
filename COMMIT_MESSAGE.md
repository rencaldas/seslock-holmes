feat(ui): sticky, collapsible dark search panels for Overview and Investigate

Summary:
- Add sticky, unified search panels under the navbar for both Overview and /investigate pages.
- Convert search/filter panels to a dark theme and unify input/select/button styles.
- Make filters hidden by default and reveal on hover; ensure filters hide again on mouse leave.
- Fix JSX/format issues and bump frontend package version to 0.3.0.

Details:
- Introduced a `group` wrapper and transition-based reveal using max-height + opacity.
- Wrapped investigation and overview search controls with `sticky top-[7rem] z-20` and `max-w-7xl` layout.
- Standardized form control classes (`bg-slate-950`, `text-slate-100`, `border-slate-700`).
- Removed `group-focus-within` to avoid keeping filters open after clicking buttons.

Files changed (representative):
- `frontend/package.json`
- `frontend/src/features/overview/overview-page.tsx`
- `frontend/src/features/overview/overview-filters.tsx`
- `frontend/src/features/recipient-search/recipient-search-form.tsx`
- `frontend/src/features/recipient-search/recipient-investigation-page.tsx`

Testing:
- `npm run typecheck --prefix frontend`
- `npm run dev --prefix frontend` and visually verify sticky and hover behavior.

Changelog:
- See `frontend/CHANGELOG.md` for the v0.3.0 entry.

Signed-off-by: rencaldas <renato.deacaldas@gmail.com>
