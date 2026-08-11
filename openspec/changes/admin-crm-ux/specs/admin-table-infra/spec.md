# admin-table-infra

URL-driven server-side pagination, sorting, filtering, and search for every admin listing page.

## ADDED Requirements

### Requirement: Listing state lives in the URL query string

Every admin listing page SHALL derive its full table state — page, page size, sort column, sort direction, search text, and filters — exclusively from URL query parameters (`page`, `per`, `sort`, `dir`, `q`, plus page-specific filter keys). The rendered page SHALL work without client-side JavaScript: sort headers, pager controls, and filter submission are server-rendered links and GET forms. Any change to sort, search, or filter parameters SHALL reset `page` to 1.

#### Scenario: Shareable filtered view

- **WHEN** a staff member copies the URL of `/spaces?status=active&sort=created&dir=desc&page=3` and another staff member opens it
- **THEN** the second staff member sees the identical page of results with the same filter, sort, and pagination state

#### Scenario: Sort change resets pagination

- **WHEN** a staff member on page 3 of a listing clicks a column header to change the sort
- **THEN** the resulting URL has the new `sort`/`dir` values and `page=1`, with all other filter parameters preserved

#### Scenario: No-JS operation

- **WHEN** a staff member uses a listing page with JavaScript disabled
- **THEN** sorting, paginating, searching, and filtering all function via plain links and GET form submission

### Requirement: Server-side pagination on every listing

Every admin listing page SHALL paginate in SQL using `LIMIT`/`OFFSET` derived from validated `page` (1-based integer) and `per` (one of 25, 50, 100; default 50) parameters, and SHALL compute the total matching-row count with a query sharing the identical WHERE clause. Pages SHALL NOT load unbounded or fixed-cap result sets and paginate in memory. The pager SHALL display the current range and total (e.g. "51–100 of 4,231") with previous/next and numbered page links. A `page` beyond the last page SHALL clamp to the last page. This requirement supersedes the bounded 100–200-row caps on existing directory and read surfaces.

#### Scenario: Large table paginates instead of truncating

- **WHEN** the master DB contains 5,000 backup runs and a staff member opens `/backups`
- **THEN** the page issues a query for at most the page size of rows plus a count query, and renders 50 rows with a pager showing the true total

#### Scenario: Out-of-range page clamps

- **WHEN** a staff member opens a listing with `?page=999` but only 4 pages exist
- **THEN** the last page of results is rendered and the pager reflects the clamped page number

#### Scenario: Invalid pagination params fall back

- **WHEN** a listing is requested with `?page=abc&per=7`
- **THEN** the page renders with `page=1` and the default page size, with no error

### Requirement: Whitelisted server-side column sorting

Every admin listing page SHALL support sorting via `sort` (a page-declared column key) and `dir` (`asc`/`desc`), applied in SQL through a whitelist mapping column keys to known columns/expressions. User input SHALL never be interpolated as a SQL identifier or expression. Unknown `sort` or `dir` values SHALL fall back to the page's declared default sort. Sortable column headers SHALL render as links toggling direction and SHALL indicate the active sort column and direction; columns whose values are derived in memory (not SQL-computable) SHALL render as plain non-sortable headers.

#### Scenario: Column sort round-trip

- **WHEN** a staff member clicks the "Created" header on `/organizations` twice
- **THEN** the first click sorts by creation date in one direction and the second click reverses it, both applied in the SQL query via the whitelist

#### Scenario: Unknown sort key rejected safely

- **WHEN** a listing is requested with `?sort=;drop table--`
- **THEN** the query uses the default sort and the parameter never reaches SQL as an identifier

### Requirement: Shared table-query planner and chrome components

`apps/admin` SHALL implement the parse/validate/plan logic as a pure, DB-free module (parsing URL parameters against a per-page spec declaring allowed sort keys, filter keys, allowed filter values, and defaults) with unit tests, and SHALL provide shared Astro components for sortable headers, the pager, and the filter bar. All listing pages SHALL use the shared planner and components rather than page-local implementations. Generated links SHALL preserve all other active query parameters.

#### Scenario: Planner validates against the page spec

- **WHEN** a listing page parses a request URL with the shared planner and a filter parameter carries a value outside the page's allowed set
- **THEN** the planner drops that filter (falling back to unfiltered) and returns a normalized plan whose every field is whitelist-validated

#### Scenario: Chrome preserves sibling parameters

- **WHEN** a staff member on `/spaces?status=active&q=acme` clicks a pager or sort link
- **THEN** the target URL still contains `status=active&q=acme`

### Requirement: Search and filters execute in SQL

Where a listing offers `q` search or filter parameters, they SHALL be applied as parameterized SQL predicates in both the page query and the count query, so pagination totals reflect the filtered set. Filterable and sortable columns MUST be computable in SQL; in-memory derivation in the pure lib modules is reserved for display-only enrichment of the current page's rows. Every listing whose rows belong to an Organization SHALL support an `org=<organizationId>` filter (the command center's "view all" links depend on it).

#### Scenario: Filtered count matches filtered rows

- **WHEN** `/backups?status=failed` matches 132 runs
- **THEN** the pager total reads 132 and every rendered row has status `failed`

#### Scenario: Org-scoped listing

- **WHEN** a staff member follows a "view all backups" link from an organization's command center
- **THEN** `/backups?org=<id>` lists only that Organization's runs, with search/sort/pagination operating within that scope
