## ADDED Requirements

### Requirement: Starlight documentation site

The support portal SHALL serve product documentation on Starlight with sidebar navigation and built-in search, deployed to Cloudflare Workers.

#### Scenario: Find an answer in docs

- **WHEN** a visitor searches a product term
- **THEN** matching doc pages are returned and render inside the docs shell

### Requirement: Chatbot with anonymous message budget

The portal SHALL provide a support chat whose anonymous usage is limited to a configurable message budget (enforced server-side once the engine lands); exhausting the budget SHALL replace the composer with a sign-in affordance deep-linking to the Baseout app login. Until the chat engine ships, a stub responder keeps the flow walkable.

#### Scenario: Budget exhausted

- **WHEN** an anonymous visitor sends their last free message
- **THEN** the reply still renders and the composer is replaced by "Sign in to Baseout to keep chatting"

### Requirement: Ticketing gated on Baseout login

The tickets surface SHALL require a verified Baseout app session (server-side session verification via the deferred auth bridge; never a client-asserted identity) and then offer ticket list, create, and thread view. Before the bridge exists, the page SHALL show only the signed-out state.

#### Scenario: Signed-out visitor

- **WHEN** a visitor without a Baseout session opens /tickets
- **THEN** they see an explanation and a sign-in link to the app — no ticket UI

### Requirement: Public roadmap with voting

The portal SHALL show a public roadmap (Planned / In progress / Shipped) where visitors can vote once per feature (best-effort dedupe via cookie+IP hash; votes persisted in the app's own D1; Shipped items don't vote).

#### Scenario: Vote on a planned feature

- **WHEN** a visitor votes on a Planned feature
- **THEN** the count increments and a second vote from the same visitor is rejected
