## ADDED Requirements

### Requirement: Benefits splash with attribution

The survey app SHALL open on a splash explaining the State of Airtable DevOps survey and its benefits — the findings report first, a Baseout sneak peek, early access, and founding partner-program status for agencies/consultants — and SHALL attribute the survey to Baseout and On2Air with one-line descriptions and links to both.

#### Scenario: Visitor starts the survey

- **WHEN** a visitor clicks Start on the splash
- **THEN** the first survey step renders with a progress indicator

### Requirement: Branching multi-step survey

The survey SHALL render one question per screen from a typed question model supporting single-select, multi-select, short-text, long-text, and email inputs, with conditional steps (`showIf` on prior answers) — including an audience branch (consultant/agency → partner-interest step + partner flag) and at least one skip branch. Back navigation SHALL preserve answers; answers SHALL survive a reload until submit.

#### Scenario: Agency branch

- **WHEN** a respondent selects the consultant/agency role
- **THEN** the partner-interest step appears and the response carries the agency flag

### Requirement: Response capture

On completion the app SHALL submit `{surveyVersion, answers, email, audienceFlags}` to its own Worker endpoint persisting to the app's D1 (stubbed until provisioned; the stub keeps the flow completable and labeled as preview), and SHALL issue a completion token for the sneak-peek link.

#### Scenario: Submit persists

- **WHEN** a respondent submits (with D1 provisioned)
- **THEN** one response row is stored with stable question IDs and a completion token is returned

### Requirement: Thank-you and private sneak peek

The thank-you page SHALL confirm the report is coming and present "Get your sneak peek of Baseout — click here" linking to a private, unlisted (`noindex`), token-guarded page with an embedded Baseout video; when the respondent is an agency/consultant, the page SHALL additionally present the founding partner-program block (perks + a confirm-interest action recorded against their response).

#### Scenario: Agency sneak peek

- **WHEN** an agency respondent opens the sneak-peek link and confirms partner interest
- **THEN** the video renders, the founding-partner block is shown, and the interest is recorded on their response
