#!/bin/bash
# Shared, read-only parsing for the supported Pincer ticket format.
# Validators return nonzero with a diagnostic; callers decide how to report it.

normalize() { # CLI shorthand -> canonical ID; bound arithmetic before conversion.
  local n=${1#T-}; n=${n#t-}
  if ! [[ $n =~ ^[0-9]{1,6}$ ]] || [ "$((10#$n))" -eq 0 ]; then
    printf 'pincer-ticket: not a ticket id (expected 1..999999): %s\n' "$1" >&2
    return 1
  fi
  printf 'T-%02d' "$((10#$n))"
}

fm_get() {
  awk -v k="$2" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    NR > 1 && index($0, k ":") == 1 {
      v = substr($0, length(k) + 2); sub(/#.*/, "", v)
      gsub(/^[ \t]+|[ \t]+$/, "", v); print v; exit
    }' "$1"
}

verification_cmds() {
  awk '
    inb { if ($0 ~ /^[ \t]*```[ \t]*$/) exit; print; next }
    otherfence { if ($0 ~ /^[ \t]*```/) otherfence = 0; next }
    /^## Verification[ \t]*$/ { inv = 1; next }
    inv && /^[ \t]*```bash[ \t]*$/ { inb = 1; next }
    inv && /^## / { exit }
    /^[ \t]*```/ { otherfence = 1 }
  ' "$1"
}

unticked() {
  awk '
    otherfence { if ($0 ~ /^[ \t]*```/) otherfence = 0; next }
    /^[ \t]*```/ { otherfence = 1; next }
    /^## Acceptance Criteria[ \t]*$/ { ina = 1; next }
    ina && /^## / { exit }
    ina && /^[ \t]*([-+*]|[0-9]+[.)])[ \t]+\[ \]/ { print }
  ' "$1"
}

validate_ticket() {
  local file=$1 cmds
  awk -v file="$file" '
    function fail(msg) { print "pincer-ticket: " file ": " msg > "/dev/stderr"; bad = 1; exit 1 }
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    function idok(s, n) {
      if (s !~ /^T-[0-9][0-9]+$/) return 0
      n = substr(s, 3)
      return length(n) <= 6 && n + 0 > 0 && sprintf("T-%02d", n + 0) == s
    }
    NR == 1 { if ($0 != "---") fail("frontmatter must begin with ---"); next }
    !closed {
      if ($0 == "---") { closed = 1; next }
      if ($0 ~ /^[ \t]*(#.*)?$/) next
      if ($0 !~ /^[a-z_][a-z0-9_]*:[ \t]*/) fail("frontmatter requires unindented key: value fields")
      key = $0; sub(/:.*/, "", key)
      if (seen[key]++) fail("duplicate frontmatter key: " key)
      value = substr($0, length(key) + 2); sub(/#.*/, "", value); values[key] = trim(value)
      next
    }
    inverify {
      if ($0 ~ /^[ \t]*```[ \t]*$/) { inverify = 0; next }
      if ($0 ~ /^[ \t]*```/) fail("Verification requires one closed bash fence")
      if ($0 !~ /^[ \t]*(#.*)?$/) runnable++
      next
    }
    otherfence {
      if ($0 ~ /^[ \t]*```/) otherfence = 0
      next
    }
    /^## Acceptance Criteria[ \t]*$/ { if (accept++) fail("duplicate Acceptance Criteria section"); section = "accept"; next }
    /^## Verification[ \t]*$/ { if (verify++) fail("duplicate Verification section"); section = "verify"; next }
    /^## / { section = ""; next }
    section == "accept" {
      if ($0 ~ /^[ \t]*(```|~~~)/) fail("Acceptance Criteria must contain visible checkboxes, not fences")
      if ($0 ~ /^[ \t]*([-+*]|[0-9]+[.)])[ \t]+/ || $0 ~ /^[ \t]*([-+*]|[0-9]+[.)])?[ \t]*\[/) {
        if ($0 !~ /^[ \t]*([-+*]|[0-9]+[.)])[ \t]+\[[ xX]\][ \t]+[^ \t]/)
          fail("malformed acceptance checkbox; use - [ ] text or - [x] text (indented/list marker variants supported)")
        boxes++
      }
    }
    /^[ \t]*~~~/ { fail("use backtick fences; tilde fences are unsupported") }
    /^[ \t]*```/ {
      if (section == "verify") {
        if ($0 !~ /^[ \t]*```bash[ \t]*$/ || fences++) fail("Verification requires exactly one bash fence")
        inverify = 1
      } else otherfence = 1
    }
    END {
      if (bad) exit 1
      if (!closed) fail("frontmatter must close with ---")
      if (!seen["ticket"] || !idok(values["ticket"])) fail("ticket must be a canonical ID between T-01 and T-999999")
      base = file; sub(/^.*\//, "", base)
      prefix = values["ticket"] "-"
      if (index(base, prefix) != 1 || base !~ /.+\.md$/ || length(base) <= length(prefix) + 3) fail("ticket ID must match filename T-NN-slug.md")
      if (values["status"] !~ /^(open|in_progress|done)$/) fail("status must be open, in_progress, or done")
      if (values["size"] !~ /^(S|M|L)$/) fail("size must be S, M, or L")
      timestamp = "^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z$"
      for (key in seen) {
        if ((key == "started" || key == "finished") && values[key] !~ timestamp) fail(key " must be an ISO UTC timestamp")
        if (key == "verified" || key == "last_check") {
          parts = split(values[key], stamp, /[ \t]+/)
          expected = key == "verified" ? 2 : 3
          if (parts != expected || stamp[1] !~ timestamp || length(stamp[parts]) != 12 || stamp[parts] !~ /^[0-9a-f]+$/)
            fail("malformed " key " timestamp/hash")
          if (key == "last_check" && stamp[2] !~ /^(running|passed|failed|interrupted)$/) fail("invalid last_check outcome")
        }
      }
      deps = values["depends_on"]
      if (!seen["depends_on"] || deps !~ /^\[[ \t]*(T-[0-9]+([ \t]*,[ \t]*T-[0-9]+)*)?[ \t]*\]$/) fail("depends_on must be an inline list such as [T-01, T-02]")
      sub(/^\[[ \t]*/, "", deps); sub(/[ \t]*\]$/, "", deps)
      count = split(deps, entries, ",")
      for (i = 1; i <= count; i++) {
        dep = trim(entries[i]); if (dep == "") continue
        if (!idok(dep)) fail("depends_on contains noncanonical ticket ID: " dep)
        if (dep == values["ticket"]) fail("ticket cannot depend on itself")
        if (depseen[dep]++) fail("duplicate depends_on ID: " dep)
      }
      if (!accept || !boxes) fail("Acceptance Criteria requires at least one nonempty checkbox")
      if (!verify || fences != 1 || inverify || !runnable) fail("Verification requires exactly one closed runnable bash fence")
    }
  ' "$file" || return 1
  cmds=$(verification_cmds "$file") || return 1
  if ! bash -n -c "$cmds"; then
    printf 'pincer-ticket: %s: invalid bash syntax in Verification block\n' "$file" >&2
    return 1
  fi
}

validate_ticket_set() {
  local file id ids=' '
  for file in tickets/T-*.md; do
    [ -e "$file" ] || continue
    id=$(fm_get "$file" ticket)
    if [ -n "$id" ]; then
      case "$ids" in *" $id "*) printf 'pincer-ticket: duplicate ticket ID: %s\n' "$id" >&2; return 1 ;; esac
      ids="$ids$id "
    fi
  done
  for file in tickets/T-*.md; do
    [ -e "$file" ] || continue
    validate_ticket "$file" || return 1
  done
}

ticket_file() {
  local id file found=''
  id=$(normalize "$1") || return 1
  for file in "tickets/$id"-*.md; do
    [ -e "$file" ] || continue
    if [ -n "$found" ]; then printf 'pincer-ticket: several files match tickets/%s-*.md\n' "$id" >&2; return 1; fi
    found=$file
  done
  if [ -z "$found" ]; then printf 'pincer-ticket: no ticket file tickets/%s-*.md\n' "$id" >&2; return 1; fi
  printf '%s' "$found"
}
