---
title: Anatomy of a reference page
description: The layout every page in the API reference follows, and what each block of it tells you.
# THIS PAGE IS A TEMPLATE ON PURPOSE, AND THE BRACES ARE THE POINT.
# See the frontmatter note on `api/index.md` for the full reasoning. In short: the portal carries no
# "unfinished" affordance by ruling, and the API surface is not settled, so the only honest thing a
# request-shaped page can show today is the SHAPE. Every `{placeholder}` below is generic so that no
# reader can mistake it for a name we have committed to — that is the safeguard, not an oversight.
# When real endpoints exist, this page stays exactly as it is: it is the page that explains how to
# read the ones beside it. Add reference pages; do not turn these braces into endpoint names.
---

Every page in this reference is built from the same six blocks, in the same order. Once you have
read one page you know where to look on all of them, which is the only thing a reference is really
for.

## 1 · The signature

The first line of every page is the request, and nothing else:

```http
{METHOD} {base_url}/{version}/{collection}/{id}
```

`{METHOD}` and the path are literal; anything in braces on a real page is a value you supply.
Nothing about authentication appears here — it is identical on every endpoint and is stated once, in
the concepts section.

## 2 · What it does

One paragraph, in the present tense, naming the object it acts on and the side effect it has. If an
endpoint changes something that outlives the request — starting a run, writing to a destination — it
is said here, before the parameters, not discovered in the response.

## 3 · Parameters

One table, with the same four columns everywhere:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `{path_parameter}` | `{type}` | Yes | Where it appears in the path, and what identifies it. |
| `{query_parameter}` | `{type}` | No | What it filters, sorts or limits, and what happens when you omit it. |
| `{body_field}` | `{type}` | No | What it sets, and the values it accepts. |

The **Required** column is never left implied. An optional parameter's description always says what
the default is, because "optional" without a default is a question rather than an answer.

## 4 · The response

The shape you get back, as a single annotated example rather than a second table. Fields that are
nullable are shown null at least once, since a field that is only ever shown populated is a field
somebody will assume is always there.

```json
{
  "{object}": "{type_name}",
  "id": "{identifier}",
  "created_at": "{timestamp}",
  "{field}": null
}
```

## 5 · Errors

Only the errors this endpoint can produce that the generic list does not already cover. The shared
ones — authentication, rate limiting, malformed requests — are described once in the concepts
section and not repeated here, so anything in this block is specific to this call and worth reading.

## 6 · An example

One complete, runnable request and its real response, with credentials redacted. It goes last
because it is what you copy after you have decided this is the right endpoint, and first only for
people who already knew that.

## What is deliberately not on the page

Prose about *why* the object exists, or how to decide between two endpoints. That belongs in the
concepts section or in the [product documentation](/start/what-baseout-is/); a reference page that
argues with you is a reference page you have to read to the end.
