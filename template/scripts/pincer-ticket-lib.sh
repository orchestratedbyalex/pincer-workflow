#!/bin/bash
# Shared, read-only parsing for the supported Pincer ticket format.
# Validators return nonzero with a diagnostic; callers decide how to report it.

PINCER_LIB_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PINCER_EVIDENCE="$PINCER_LIB_DIR/pincer-evidence.cjs"

# Run the shared evidence validator; prints its combined output, returns its status.
# Usage: evidence_validate <manifest> <candidate> <prd> [--files]
evidence_validate() {
  command -v node >/dev/null 2>&1 || { printf 'evidence: %s: Node.js 18+ is required to validate evidence\n' "$1"; return 1; }
  node "$PINCER_EVIDENCE" validate "$1" --candidate "$2" --prd "$3" "${@:4}" 2>&1
}
evidence_reason() { printf '%s\n' "$1" | head -1 | sed 's/^evidence: [^:]*: //'; }

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

# PRDs and evaluation notes use the same deliberately small metadata format.
validate_metadata() {
  awk -v file="$1" '
    function fail(msg) { print "pincer: " file ": " msg > "/dev/stderr"; bad = 1; exit 1 }
    NR == 1 { if ($0 != "---") fail("frontmatter must begin with ---"); next }
    !closed {
      if ($0 == "---") { closed = 1; next }
      if ($0 ~ /^[ \t]*(#.*)?$/) next
      if ($0 !~ /^[a-z_][a-z0-9_]*:[ \t]*/) fail("expected unindented key: value metadata")
      key = $0; sub(/:.*/, "", key)
      if (seen[key]++) fail("duplicate metadata key: " key)
    }
    END { if (bad) exit 1; if (!closed) fail("frontmatter must close with ---") }
  ' "$1"
}

validate_prd() {
  local ref=$1 version
  if ! [[ $ref =~ ^\.prd/prd-v([1-9][0-9]{0,8})\.md$ ]]; then
    printf 'pincer: invalid PRD reference %s; use .prd/prd-vN.md\n' "$ref" >&2; return 1
  fi
  version=${BASH_REMATCH[1]}
  [ -f "$ref" ] || { printf 'pincer: PRD does not exist: %s\n' "$ref" >&2; return 1; }
  validate_metadata "$ref" || return 1
  [ "$(fm_get "$ref" version)" = "$version" ] || { printf 'pincer: %s: version must match filename (%s)\n' "$ref" "$version" >&2; return 1; }
  case "$(fm_get "$ref" status)" in draft|ticketed|built) ;; *) printf 'pincer: %s: PRD status must be draft, ticketed, or built\n' "$ref" >&2; return 1 ;; esac
  case "$(fm_get "$ref" profile)" in ''|small|standard) ;; *) printf 'pincer: %s: profile must be small or standard (omit for standard)\n' "$ref" >&2; return 1 ;; esac
}

prd_profile() { # effective planning profile; older PRDs without the field are standard
  local profile; profile=$(fm_get "$1" profile)
  printf '%s' "${profile:-standard}"
}

latest_prd() {
  local ref latest='' highest=0 n
  for ref in .prd/prd-v*.md; do
    [ -e "$ref" ] || continue
    if ! [[ $ref =~ ^\.prd/prd-v([1-9][0-9]{0,8})\.md$ ]]; then
      printf 'pincer: invalid PRD filename: %s\n' "$ref" >&2; return 1
    fi
    n=${BASH_REMATCH[1]}
    if [ "$n" -gt "$highest" ]; then highest=$n; latest=$ref; fi
  done
  [ -z "$latest" ] || validate_prd "$latest" || return 1
  printf '%s' "$latest"
}

ticket_prd() { # resolve without writing; ambiguous legacy tickets require bind.
  local file=$1 ref candidate count=0
  ref=$(fm_get "$file" prd)
  if [ -z "$ref" ]; then
    for candidate in .prd/prd-v*.md; do
      [ -e "$candidate" ] || continue
      ref=$candidate; count=$((count + 1))
    done
    if [ "$count" -ne 1 ]; then
      printf 'pincer: %s: missing or ambiguous PRD association; use pincer-ticket.sh bind %s .prd/prd-vN.md\n' "$file" "$(fm_get "$file" ticket)" >&2
      return 1
    fi
  fi
  validate_prd "$ref" || return 1
  printf '%s' "$ref"
}

usable_ticket_prd() {
  local ref
  ref=$(ticket_prd "$1") || return 1
  case "$(fm_get "$ref" status)" in
    ticketed|built) printf '%s' "$ref" ;;
    *) printf 'pincer: %s: PRD is draft; complete the authorized breakdown before starting (expected ticketed or built)\n' "$ref" >&2; return 1 ;;
  esac
}

sha256() { if command -v sha256sum >/dev/null; then sha256sum; else shasum -a 256; fi; }
verify_hash() { verification_cmds "$1" | sha256 | cut -c1-12; }

ticket_readiness() { # explain why a done ticket needs attention, without mutation.
  local file=$1 receipt attempt hash
  receipt=$(fm_get "$file" verified); attempt=$(fm_get "$file" last_check)
  hash=$(verify_hash "$file")
  if [ -z "$attempt" ]; then
    printf 'missing latest verification outcome — re-run verify'; return 1
  fi
  if ! [[ $attempt =~ ^[0-9T:Z-]+\ passed\ [a-f0-9]{12}$ ]] || [ "${attempt##* }" != "$hash" ]; then
    printf 'latest verification: %s — re-run verify' "$attempt"; return 1
  fi
  if [ -z "$receipt" ]; then printf 'done without a verification receipt — re-run verify'; return 1; fi
  if ! [[ $receipt =~ ^[0-9T:Z-]+\ [a-f0-9]{12}$ ]] || [ "${receipt##* }" != "$hash" ]; then
    printf 'stale or malformed verification receipt — re-run verify'; return 1
  fi
  if [ -n "$(unticked "$file")" ]; then printf 'unticked acceptance criteria — complete and re-run verify'; return 1; fi
}

# An evaluation is current when NOTES.md names this PRD, a reviewed base and
# candidate that are ancestors of HEAD, and an evidence manifest that validates
# for that candidate; after the candidate, only NOTES.md and the files the
# manifest lists may have changed, all of them tracked, and the working tree is
# clean apart from NOTES.md. Legacy notes without a manifest never grant readiness.
notes_current() {
  local prd=$1 candidate base changes manifest output listed file offending
  [ -f NOTES.md ] || { printf 'missing'; return 1; }
  validate_metadata NOTES.md >/dev/null 2>&1 || { printf 'stale: invalid or missing evaluation metadata'; return 1; }
  [ "$(fm_get NOTES.md prd)" = "$prd" ] || { printf 'stale: evaluation PRD does not match'; return 1; }
  candidate=$(fm_get NOTES.md candidate); base=$(fm_get NOTES.md base)
  if ! [[ $candidate =~ ^([a-f0-9]{40}|[a-f0-9]{64})$ ]] || ! [[ $base =~ ^([a-f0-9]{40}|[a-f0-9]{64})$ ]]; then
    printf 'stale: candidate and base must be full commit IDs'; return 1
  fi
  if ! git rev-parse --verify "$candidate^{commit}" >/dev/null 2>&1 ||
     ! git rev-parse --verify "$base^{commit}" >/dev/null 2>&1 ||
     ! git merge-base --is-ancestor "$base" "$candidate" 2>/dev/null ||
     ! git merge-base --is-ancestor "$candidate" HEAD 2>/dev/null; then
    printf 'stale: evaluation commits or ancestry unavailable'; return 1
  fi
  manifest=$(fm_get NOTES.md evidence)
  if [ -z "$manifest" ]; then
    printf 'stale: legacy evaluation without evidence manifest — re-run /pincer-evaluate for evidence schema 1'; return 1
  fi
  if ! output=$(evidence_validate "$manifest" "$candidate" "$prd" --files); then
    printf 'stale: evidence invalid: %s' "$(evidence_reason "$output")"; return 1
  fi
  listed=$(printf '%s\n' "$output" | tail -n +2)
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    git ls-files --error-unmatch -- "$file" >/dev/null 2>&1 || { printf 'stale: evidence not tracked: %s' "$file"; return 1; }
  done <<< "$listed"
  changes=$(git diff --name-only "$candidate" HEAD -- . ':(exclude)NOTES.md') || return 1
  offending=$(printf '%s\n' "$changes" | grep -vxF -f <(printf '%s\n' "$listed") | grep -v '^$' | head -1)
  if [ -n "$offending" ]; then printf 'stale: candidate changed after evaluation: %s' "$offending"; return 1; fi
  changes=$(git status --porcelain --untracked-files=all -- . ':(exclude)NOTES.md') || return 1
  if [ -n "$changes" ]; then printf 'stale: working tree has changes outside NOTES.md'; return 1; fi
  printf 'current (%s)' "$candidate"
}
