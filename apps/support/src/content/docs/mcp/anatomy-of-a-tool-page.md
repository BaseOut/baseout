---
title: Anatomy of a tool page
description: The layout every page in the MCP tool reference follows, and why it has a block the API reference does not.
# A TEMPLATE ON PURPOSE. See the frontmatter note on `api/index.md`, and on
# `api/anatomy-of-a-reference-page.md`, which this page is the MCP half of.
# `{tool_name}` is generic BECAUSE no tool name is settled. It is the safeguard against the thing
# that is worse than an unfinished page: an invented one a reader cannot detect. Add tool pages
# beside this; leave the braces alone.
---

Every page in the tool reference is built from the same five blocks. Four of them are the endpoint
page's blocks under different names. The fifth exists only here.

## 1 · The tool

The name, exactly as a client sees it, and nothing else on the line:

```text
{tool_name}
```

Tool names are stable in a way endpoint paths are not: a client may have the name written into a
saved configuration, so renaming one is a breaking change even when the behaviour is identical.

## 2 · What the model is told

**This is the block an endpoint page does not have, and it is the most important one on the page.**

It reproduces, verbatim, the description string the server sends to the client — the text the model
reads when it is deciding whether this tool is the right one. It is quoted rather than paraphrased
because paraphrasing it hides the thing you are usually here to debug: a tool that is never called,
or called for the wrong job, is nearly always a description problem rather than a code problem.

> {The description string, exactly as the server sends it.}

## 3 · Arguments

The same table as the API reference, with one column added:

| Argument | Type | Required | Description | What the model sees |
|---|---|---|---|---|
| `{argument}` | `{type}` | Yes | What it selects, and what identifies it. | The schema description string for this argument. |
| `{optional_argument}` | `{type}` | No | What it filters, and the default when omitted. | The schema description string for this argument. |

The last column is not a duplicate of the fourth. The fourth is written for you; the fifth is written
for the model, and when they say different things the model's version is the one that decides what
happens.

## 4 · What comes back

The result the client receives, shown once in full. Where a result is long enough to be truncated
before it reaches the model, the page says where the limit falls, because a truncated result that
looks complete is the second most common cause of a wrong answer.

```json
{
  "{field}": "{type_name}",
  "{list}": [],
  "{field_that_may_be_absent}": null
}
```

## 5 · When it is the wrong tool

One short paragraph naming the tool a reader probably wanted instead. A tool reference is read by
people who guessed, and the cheapest correction is on the page they guessed at.

## What is deliberately not on the page

Client setup. Which file a configuration goes in and what the server address is are the same for
every tool, so they are stated once under **Connecting** and never repeated.
