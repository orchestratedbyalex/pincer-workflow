# ui-states — validation, error and accessibility states for a sign-up form

UI feature with error and accessibility states. The base renders a sign-up form as an
HTML string from a state object (server-side rendering, no framework) with a stub
validator. The evaluator inspects the rendered markup structurally in Node; there is no
browser in the loop, which is a stated limitation of this brief.

## Task

`src/form.js` exports `render(state)` returning the HTML of a sign-up form and
`src/validate.js` exports `validate(values)`. Implement validation with accessible error
states:

- `validate({ email, password })` returns an object with one message per invalid
  field and nothing for valid ones: email missing or blank → `Enter your email address`;
  email without `@` → `Enter a valid email address`; password missing → `Enter a
  password`; password shorter than 8 characters → `Use at least 8 characters`. Valid
  input returns `{}`.
- `render({ values, errors, submitting })` (all optional, defaults empty/false):
  - every input has an `id` (`email`, `password`), a `name`, and a `<label for="<id>">`;
    the current value is rendered in `value="…"` HTML-escaped (`&`, `<`, `>`, `"`).
  - a field with an error gets `aria-invalid="true"` and `aria-describedby="<id>-error"`,
    and its message renders in `<p id="<id>-error" class="error">…</p>` right after the
    input; a field without an error has no `aria-invalid="true"` and no error element.
  - when there is at least one error, an error summary `<div role="alert"
    id="form-errors">` precedes the fields and lists every message in a `<ul>`, each
    item linking to its field (`<a href="#<id>">`). Without errors the summary is absent.
  - `submitting: true` sets `aria-busy="true"` on the `<form>`, `disabled` on the submit
    button and its text to `Signing up…`; otherwise the button reads `Sign up`.
- Add tests for the validator and for each rendered state.

Commit your work; the last commit is what gets evaluated.

## Prompt 1

Read BRIEF.md in this repository and implement what it asks for, committing your work as you go. Work autonomously; when you are done, stop and summarize what you built and how you verified it.

## Acceptance (held out)

Hidden tests call `validate` on a table of inputs and `render` on the empty state, an
error state, the submitting state and an escaping case, parsing the markup for the
input attributes, labels, error elements, the summary and the button. This is a
structural check of the markup, not a browser or screen-reader test.
