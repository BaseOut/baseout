## MODIFIED Requirements

### Requirement: Branching multi-step survey

The survey SHALL render one question per screen from a typed question model supporting single-select, multi-select, short-text, long-text, and email inputs, with conditional steps (`showIf` on prior answers) — including an audience branch (consultant/agency → partner-interest step + partner flag) and at least one skip branch. Back navigation SHALL preserve answers. Answers SHALL persist server-side per respondent from the email-first start step onward (see `survey-resume`), surviving reloads, browser restarts, and device changes — client storage is a cache, not the source of truth. The question flow SHALL NOT ask for the respondent's email again at the end; the start-step email is carried into the submitted response.

#### Scenario: Agency branch

- **WHEN** a respondent selects the consultant/agency role
- **THEN** the partner-interest step appears and the response carries the agency flag

#### Scenario: Answers survive a browser restart

- **WHEN** a respondent closes the browser mid-survey and returns with a valid session
- **THEN** their previously answered steps are intact and the survey opens where they left off
