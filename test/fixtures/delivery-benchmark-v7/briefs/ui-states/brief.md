# ui-states — a sign-up form with empty, error and submitting states

A UI feature with accessibility and error states. The base repository renders one form and
has no state handling at all.

## Task

`render(state)` in `src/form.js` returns the HTML of a sign-up form for three states.
`state` is `{ mode, values, errors }` where `mode` is `'empty'`, `'error'` or
`'submitting'`.

- **empty**: an email input with a `<label for>` bound to its `id`, a submit button
  reading `Sign up`, and no error summary anywhere.
- **error**: each invalid input carries `aria-invalid="true"` and an `aria-describedby`
  naming the `id` of its message element; an alert summary (`role="alert"`) lists the
  messages. Values entered by the user are echoed back, HTML-escaped.
- **submitting**: the form carries `aria-busy="true"` and the button reads
  `Signing up…` and **is actually disabled** — a real browser must refuse to activate it,
  not merely describe it as disabled to assistive technology.

Add tests that `npm test` runs. Commit your work.

## Changes

1

## Prompt 1

Read BRIEF.md in this repository and implement what it asks for, committing your work as
you go. Work autonomously; when you are done, stop and summarize what you built.
