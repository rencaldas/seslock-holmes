# Changelog

All notable changes to this project will be documented in this file.

# Changelog

All notable changes to this project will be documented in this file.

## [0.6.2] - 2026-07-02
### Changed
- Email lists in the overview and recipient investigation views now surface the subject inline so operators can identify recurring patterns faster without opening details.

## [0.6.1] - 2026-07-01
### Fixed
- Replaced non-generic provider examples with neutral `example.com` placeholders so the project stays safe to share publicly.

## [0.6.0] - 2026-07-01
### Added
- Overview provider filter with `Todos` support, allowing the dashboard to narrow metrics and tables to a specific recipient domain.
- Short bounce reason details in the overview table, with friendly labels such as `MailboxFull` -> `Caixa do email cheia`.
- Recipient-domain filtering helper coverage for provider-scoped investigation workflows.
### Changed
- Overview analytics now compute from provider-filtered events when a provider is selected.
- Overview filters gained a dedicated provider field alongside the existing origin filter.
### Fixed
- Improved table sizing and card layout so the overview tables use the available card width cleanly.

## [0.5.0] - 2026-07-01
### Added
- New overview analytics visuals with percentage-based event-distribution bars and color-coded states.
- Favicon, footer metadata improvements, and new display settings for timezone, clock format, and update interval.
- Overview metrics support and related regression tests.
### Changed
- Refined FAQ, settings, and overview layouts for better spacing, alignment, and card structure.
- Updated TypeScript path configuration and footer timestamp handling.
### Fixed
- Overview card layout issues, misaligned content blocks, and inconsistent bar-fill rendering.

## [0.3.0] - 2026-06-29
### Added
- Sticky, unified search panels under the navbar for both Overview and /investigate pages.
- Hover-expand behavior for filter panels: filters are hidden by default and reveal on hover.
### Changed
- Converted search/filter panels to a dark theme and standardized input/select/button styles.
- Removed `focus-within` expansion to ensure filters hide on mouse leave after clicks.
### Fixed
- Small JSX/format issues preventing builds and layout inconsistencies.

---

## [0.2.1] - previous
- Prior release notes.
