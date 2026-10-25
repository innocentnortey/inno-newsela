"""Signature-completeness check for the zero-to-hero section 6 gate (ARTIFACT-MAP 1.14.0).

Read-only and stdlib only. The contract is DESIGN-OUTPUTS.md -> *Before the ticket-ready gate*.
It reads a code design (DO-3), its component contracts (DO-4), the observability contract (DO-6)
and, optionally, the UI contracts (OpenAPI), and reports four kinds of finding:

    signature    a service, adapter, port or graph node named in DO-3's module tables (header
                 starts 'Module' or 'Port') or build-areas table (header 'Wave | Area | Owns')
                 with no class or Protocol in DO-4 that has method signatures (for a node, a
                 def is enough). A class whose definition line says `implements X` borrows the
                 methods of Protocol X. A module named without a class is satisfied by any
                 annotated signature (a def with `->`, a class method, or a dotted repository
                 signature `core.x.get(a: T) -> R`) that DO-4 places in that module: under a
                 heading that names the path, after a top-level `# <path>` comment in the same
                 code block, or with the path in the signature's own comment. A comment
                 `# fn_name (<path> ...)` links an annotated top-level def to the module.
    return-type  a DO-4 signature whose return type names a type DO-4 never defines (with
                 fields, enum members, methods, as an alias or NewType/Callable/Literal alias,
                 as a documented marker class `class X(Base): ...  # why`, by an import, or by
                 a prose alias "`X` = `Y`" where Y is defined), is not an --openapi component
                 schema (directly, through "`X` = `Schema`", "X: the OpenAPI Schema", or a
                 "# = OpenAPI Schema" comment on the signature), is not module-qualified
                 (`anyio.CapacityLimiter`) and is not on the allow-list (ALLOWED_TYPES plus
                 --allow-type); a bare dict/Any/list/tuple/object; or a missing annotation
    error-code   an error code in the OpenAPI file (the `code` enum of ApiError and of any schema
                 whose name contains Error or Notice; any `x-error`/`x-errors` value) that DO-4
                 does not hold: as a member of a class or Literal alias named *Code, in a table
                 under a heading containing 'error', or in a paragraph under such a heading
                 that names a *Code type ("`ApiErrorCode` ... adds `X`, `Y` and drops `Z`"; the
                 dropped codes do not count)
    record       a record named in DO-6's workflow registry ('Required records' column) that no
                 storage line in DO-3 or DO-4 names (a table, a repository, a .sql/.sqlite/
                 .json/.jsonl file, a `tx.`/`core.` repository path). A multi-word record also
                 matches a file or backticked table named by its last word ("ingestion
                 manifest" -> `manifest.json`). Notes in the cell ("**Note (...):** ...") and
                 anything after the cell's first sentence are not record names.

CLI:
    signature_check.py --code-design DO3.md --contracts DO4.md --observability DO6.md
                       [--openapi FILE] [--allow-type NAME ...] [--json]

--contracts may repeat when DO-4 spans several files; so may --allow-type (an external or
standard-library type name to accept as defined). Exit codes: 0 no findings, 1 findings,
2 usage or file error. The matching is name-based and deliberately conservative: a finding is a
lead for a reviewer, and a clean run does not prove the types are field-complete.
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import design_outputs as do  # noqa: E402  (sibling module; shared table helpers)

KINDS = ("signature", "return-type", "error-code", "record")

_FENCE_OPEN = re.compile(r"^\s*(```|~~~)")
_CLASS = re.compile(r"^(\s*)class\s+(\w+)\s*(?:\((.*)\))?\s*:")
_DEF = re.compile(r"^\s*(?:async\s+)?def\s+(\w+)\s*\(")
_ALIAS = re.compile(r"^(?:type\s+)?([A-Z]\w*)\s*(?::\s*\w+\s*)?=\s*(\S.*)$")
_IMPORT = re.compile(r"^\s*(?:from\s+[\w.]+\s+)?import\s+(.+)$")
_RET = re.compile(r"\)\s*->\s*(.+?)\s*:\s*(?:\.\.\.|…|pass\b.*|return\b.*|raise\b.*)?\s*$")
_DOTTED_SIG = re.compile(r"^\s*[a-z_]\w*(?:\.\w+)+\(.*\)\s*->\s*\S")
_QUALIFIED = re.compile(r"\b[a-z_]\w*(?:\.[A-Za-z_]\w*)*\.[A-Z]\w*")
_MODULE_PATH = re.compile(r"(?:[\w./-]|\{[\w,\s]*\})+\.py\b")
_IMPLEMENTS = re.compile(r"#.*?\bimplements\s+`?([A-Z]\w*)")
_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
_CODE_TOKEN = re.compile(r"`([A-Z][A-Z0-9_]{2,})`")
_PROSE_ALIAS = re.compile(r"`([A-Z]\w*)`\s*=\s*`([^`]+)`")
_OPENAPI_REF = re.compile(r"\b([A-Z]\w*)`?\s*[:=]\s*(?:the\s+)?OpenAPI\s+`?([A-Z]\w*)")
_SIG_OPENAPI = re.compile(r"#.*?\bOpenAPI\s+`?([A-Z]\w*)")
_COMMENT_LINK = re.compile(r"^#\s*(\w+)\s*\(([^)]*?\.py)\b")
_FIELD = re.compile(r"^\s*([a-z_]\w*)\s*:\s*\S")
_MEMBER = re.compile(r"^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+?)\s*$")
_CAMEL = re.compile(r"\b[A-Z][A-Za-z0-9_]*\b")
_LITERAL = re.compile(r"Literal\[[^\]]*\]")
_BACKTICK = re.compile(r"`([^`]+)`")
_COMPONENT_NAME = re.compile(r"^([A-Z][a-z][A-Za-z0-9]*)(?:$|[.(/\s\[])")
_PATH_SPEC = re.compile(r"[\w./*{},-]+\.py\b|[\w/]+/\*")

TYPING_NAMES = {
    "None", "Any", "Optional", "Union", "Sequence", "Mapping", "MutableMapping", "Iterable",
    "Iterator", "Callable", "ContextManager", "AbstractContextManager", "AsyncContextManager",
    "Generator", "AsyncIterator", "AsyncGenerator", "Awaitable", "Coroutine", "Literal",
    "Generic", "Protocol", "Self", "Type", "ClassVar", "Final", "Annotated", "TypeVar",
    "NoReturn", "Never", "Decimal", "UUID", "Path", "SecretStr", "JsonValue", "BaseModel",
    "Enum", "StrEnum", "IntEnum", "True", "False", "Dict", "List", "Tuple", "Set", "FrozenSet",
}
BARE = {"dict", "Any", "list", "tuple", "object", "Dict", "List", "Tuple", "set"}
# Third-party types a contract names without importing them. Small on purpose: anything else is
# accepted only when DO-4 imports it, qualifies it (`anyio.CapacityLimiter`) or --allow-type names it.
ALLOWED_TYPES = {
    "Send", "Command",                                        # langgraph.types
    "CapacityLimiter",                                        # anyio
    "Request", "Response", "JSONResponse", "StreamingResponse", "HTMLResponse",  # starlette
}

PATH_KINDS = (("services/", "service"), ("adapters/", "adapter"), ("ports/", "port"),
              ("nodes/", "node"), ("repos_", "adapter"))
DERIVED_SUFFIX = {"service": ("Service",), "adapter": ("Adapter", "Repos", "Repo"),
                  "port": ("",), "node": ("Node",)}

_STORAGE_CUE = re.compile(
    r"\.sql\b|\.sqlite\b|\.jsonl?\b|\.db\b|\.csv\b|\bschema/|\btables?\b|repo|"
    r"\bCREATE\s+TABLE\b|\b(?:tx|core|uow)\.\w+", re.I)
_REC_STOP = {"every", "each", "all", "the", "a", "an", "one", "its", "their", "any", "plus"}
_REC_QUALIFIER = {"when", "for", "tagged", "on", "in", "per", "with", "of", "from", "at", "by",
                  "if", "only", "never", "is", "are", "counted", "where", "to", "results"}
_FILE_TOKEN = re.compile(r"[\w*.-]*/[\w*./-]+|\b[\w*-]+\.(?:sql|sqlite|db|jsonl?|csv|parquet)\b")


# --------------------------------------------------------------------------- reading

def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def code_blocks(text):
    """Return the text of every fenced block, each as a list of lines."""
    blocks, cur = [], None
    for line in text.splitlines():
        if _FENCE_OPEN.match(line):
            if cur is None:
                cur = []
            else:
                blocks.append(cur)
                cur = None
            continue
        if cur is not None:
            cur.append(line)
    return blocks


def _strip_comment(line):
    """Drop a trailing # comment that is not inside a string literal."""
    quote = None
    for i, ch in enumerate(line):
        if quote:
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == "#":
            return line[:i]
    return line


def _indent(line):
    return len(line) - len(line.lstrip())


# --------------------------------------------------------------------------- DO-4 model

def parse_contracts(text):
    """Return a dict describing DO-4's code: classes, aliases, signatures and enums.

    classes: name -> {fields, members, methods, bases, header, marker} (header = the class line
    with its comment, used to match a module path; marker = a documented field-less class
    `class X(Base): ...  # why`). signatures: [(owner, name, return or None, raw text)].
    aliases: name -> right-hand side. imports: names a code block imports. prose_aliases and
    openapi_refs: "`X` = `Y`" and "X: the OpenAPI Y" anywhere in the text. placed and links:
    see _module_scopes. schemas and allowed are filled by run().
    """
    classes, aliases, sigs, imports = {}, {}, [], set()
    for block in code_blocks(text):
        stack = []  # (indent, class name)
        i = 0
        while i < len(block):
            raw = block[i]
            code = _strip_comment(raw)
            if not code.strip():
                i += 1
                continue
            ind = _indent(code)
            while stack and ind <= stack[-1][0]:
                stack.pop()
            m = _CLASS.match(code)
            if m:
                name = m.group(2)
                rest = code[m.end():].strip()
                marker = rest in ("...", "pass") and bool(_comment_of(raw).strip("# \t"))
                classes.setdefault(name, {"fields": set(), "members": {}, "methods": set(),
                                          "bases": m.group(3) or "", "header": raw,
                                          "marker": marker})
                stack.append((len(m.group(1)), name))
                if rest and rest not in ("...", "pass"):
                    _absorb(classes[name], rest)
                i += 1
                continue
            d = _DEF.match(code)
            if d:
                joined, raw_joined, j = code, raw, i
                while joined.count("(") > joined.count(")") or not re.search(r"\)\s*(->[^:]*)?:",
                                                                            joined):
                    j += 1
                    if j >= len(block):
                        break
                    joined += " " + _strip_comment(block[j]).strip()
                    raw_joined += "\n" + block[j]
                owner = stack[-1][1] if stack else None
                if owner:
                    classes[owner]["methods"].add(d.group(1))
                ret = _RET.search(joined)
                sigs.append((owner, d.group(1), ret.group(1).strip() if ret else None, raw_joined))
                i = j + 1
                continue
            if stack:
                _absorb(classes[stack[-1][1]], code)
                i += 1
                continue
            imp = _IMPORT.match(code)
            if imp:
                for part in imp.group(1).replace("(", " ").replace(")", " ").split(","):
                    words = part.split()
                    if words:
                        imports.add(words[-1].split(".")[-1])
                i += 1
                continue
            a = _ALIAS.match(code)
            if a:
                rhs, j = a.group(2), i
                while rhs.count("[") > rhs.count("]") and j + 1 < len(block):
                    j += 1
                    rhs += " " + _strip_comment(block[j]).strip()
                aliases[a.group(1)] = rhs.strip()
                i = j + 1
                continue
            i += 1
    id_types = set()
    for header, rows in do._tables(text):
        if header and header[0] == "type":
            for _, cells in rows:
                for tok in _BACKTICK.findall(cells[0]):
                    id_types.add(tok.strip())
    prose_aliases, openapi_refs = {}, {}
    for line in text.splitlines():
        for a, b in _PROSE_ALIAS.findall(line):
            prose_aliases.setdefault(a, b.strip())
        for a, b in _OPENAPI_REF.findall(line):
            openapi_refs.setdefault(a, b)
    placed, links = _module_scopes(text)
    return {"classes": classes, "aliases": aliases, "signatures": sigs, "id_types": id_types,
            "imports": imports, "prose_aliases": prose_aliases, "openapi_refs": openapi_refs,
            "placed": placed, "links": links, "schemas": set(), "allowed": set(ALLOWED_TYPES),
            "text": text}


def _absorb(cls, code):
    for part in code.split(";"):
        part = part.strip()
        if not part or part.startswith(("def ", "@", '"""', "'''", "...")):
            continue
        m = _MEMBER.match(part)
        if m:
            value = m.group(2).strip().strip("\"'")
            cls["members"][m.group(1)] = value
            continue
        f = _FIELD.match(part)
        if f:
            cls["fields"].add(f.group(1))


def _module_mentions(s):
    out = []
    for spec in _MODULE_PATH.findall(s):
        out.extend(re.sub(r"^\./", "", p) for p in _expand(spec))
    return out


def _comment_of(raw):
    return raw[len(_strip_comment(raw)):]


def _module_scopes(text):
    """Return (placed, links). placed: every module path DO-4 gives at least one annotated
    signature in (a def with `->`, a class method, a dotted `x.y(a: T) -> R` line), taken from
    the headings above it, the latest top-level `# <path>` comment in its code block, its
    class's definition line and its own comments. links: (function, path) from a top-level
    comment `# fn (<path> ...)` naming where a def given elsewhere lives."""
    placed, links = set(), []
    headings, scope, cls_stack = [], [], []
    lines, in_block, k = text.splitlines(), False, 0
    while k < len(lines):
        line = lines[k]
        if _FENCE_OPEN.match(line):
            in_block, scope, cls_stack = not in_block, [], []
            k += 1
            continue
        if not in_block:
            h = _HEADING.match(line)
            if h:
                level = len(h.group(1))
                while headings and headings[-1][0] >= level:
                    headings.pop()
                headings.append((level, _module_mentions(h.group(2))))
            k += 1
            continue
        code = _strip_comment(line)
        if not code.strip():
            s = line.strip()
            if s.startswith("#") and _indent(line) == 0 and _module_mentions(s):
                scope = _module_mentions(s)
                link = _COMMENT_LINK.match(s)
                if link:
                    links.extend((link.group(1), p) for p in _module_mentions(link.group(2)))
            k += 1
            continue
        ind = _indent(code)
        while cls_stack and ind <= cls_stack[-1][0]:
            cls_stack.pop()
        m = _CLASS.match(code)
        if m:
            cls_stack.append((len(m.group(1)), _module_mentions(_comment_of(line))))
            k += 1
            continue
        j, signed, comments = k, False, _comment_of(line)
        if _DEF.match(code):
            joined = code
            while joined.count("(") > joined.count(")") or not re.search(r"\)\s*(->[^:]*)?:",
                                                                        joined):
                if j + 1 >= len(lines) or _FENCE_OPEN.match(lines[j + 1]):
                    break
                j += 1
                joined += " " + _strip_comment(lines[j]).strip()
                comments += " " + _comment_of(lines[j])
            signed = bool(_RET.search(joined))
        elif _DOTTED_SIG.match(code):
            signed = True
        if signed:
            placed.update(p for _, ps in headings for p in ps)
            placed.update(scope)
            placed.update(p for _, ps in cls_stack for p in ps)
            placed.update(_module_mentions(comments))
        k = j + 1
    return placed, links


def _defined(model, name, _seen=None):
    if name in model["aliases"] or name in model["id_types"]:
        return True
    if name in model.get("imports", ()) or name in model.get("allowed", ()):
        return True
    schemas = model.get("schemas", ())
    if name in schemas or model.get("openapi_refs", {}).get(name) in schemas:
        return True
    cls = model["classes"].get(name)
    if cls and (cls["fields"] or cls["members"] or cls["methods"] or cls.get("marker")):
        return True
    rhs = model.get("prose_aliases", {}).get(name)
    if rhs:
        if rhs.startswith("Literal["):
            return True
        seen = (_seen or set()) | {name}
        target = _CAMEL.search(rhs)
        if target and target.group(0) not in seen:
            return _defined(model, target.group(0), seen)
    return False


# --------------------------------------------------------------------------- check 1

def _expand(spec):
    """'services/{a,b}.py' -> ['services/a.py', 'services/b.py']."""
    m = re.search(r"\{([^{}]*)\}", spec)
    if not m:
        return [spec]
    out = []
    for alt in m.group(1).split(","):
        out.extend(_expand(spec[:m.start()] + alt.strip() + spec[m.end():]))
    return out


def _kind_for(path):
    p = path.replace("\\", "/")
    if "/schema/" in p or not p.endswith(".py"):
        return None
    for prefix, kind in PATH_KINDS:
        if p.startswith(prefix) or ("/" + prefix) in p:
            return kind
    return None


def _names_in(cell):
    names = []
    for tok in _BACKTICK.findall(cell):
        m = _COMPONENT_NAME.match(tok.strip())
        if m:
            names.append(m.group(1))
    return names


def _paths_in(cell):
    out = []
    for tok in _BACKTICK.findall(cell) or [cell]:
        for spec in _PATH_SPEC.findall(tok):
            out.extend(_expand(spec))
    return out


def design_components(text):
    """Return (named, modules): named = {class name: (kind, where)}; modules = {path: kind}
    for service/adapter/port/node modules whose rows name no class."""
    named, modules, module_paths = {}, {}, {}
    for header, rows in do._tables(text):
        if not header:
            continue
        first = header[0]
        if first.startswith("port"):
            impl = [n for n, h in enumerate(header) if h.startswith("implement")]
            for line, cells in rows:
                for name in _names_in(cells[0]):
                    named.setdefault(name, ("port", "DO-3 line %d" % line))
                for idx in impl:
                    if idx < len(cells):
                        for name in _names_in(cells[idx]):
                            named.setdefault(name, ("adapter", "DO-3 line %d" % line))
        elif first.startswith("module"):
            cols = [n for n, h in enumerate(header)
                    if n == 0 or h.startswith(("responsib", "expos", "interface"))]
            for line, cells in rows:
                paths = _paths_in(cells[0])
                kinds = {_kind_for(p) for p in paths} - {None}
                for p in paths:
                    module_paths[p] = line
                if not kinds:
                    continue
                kind = sorted(kinds)[0]
                found = []
                for idx in cols:
                    if idx < len(cells):
                        found += _names_in(cells[idx])
                for name in found:
                    named.setdefault(name, (kind, "DO-3 line %d" % line))
                if not found:
                    for p in paths:
                        if "*" not in p and _kind_for(p):
                            modules.setdefault(p, (_kind_for(p), "DO-3 line %d" % line))
                else:
                    for p in paths:
                        modules.pop(p, None)
                        module_paths[p] = -1  # covered by named classes
        elif first.startswith("wave") and any(h.startswith("owns") for h in header):
            owns = next(n for n, h in enumerate(header) if h.startswith("owns"))
            for line, cells in rows:
                if owns >= len(cells):
                    continue
                for p in _paths_in(cells[owns]):
                    if "*" in p:
                        continue
                    full = _resolve(p, module_paths)
                    if module_paths.get(full) == -1 or full in modules:
                        continue
                    module_paths.setdefault(full, line)
                    kind = _kind_for(full)
                    if kind:
                        modules[full] = (kind, "DO-3 build areas line %d" % line)
    return named, modules


def _resolve(path, known):
    """Turn a partial build-area path ('nodes/act.py', 'repos_spend.py') into a full one using
    the module tables' paths: a unique suffix match, else a known directory ending in the
    partial's directory, else the directory of a sibling with the same name prefix."""
    if path in known:
        return path
    hits = [k for k in known if k.endswith("/" + path)]
    if len(hits) == 1:
        return hits[0]
    head, base = os.path.split(path)
    dirs = sorted({os.path.dirname(k) for k in known if "/" in k})
    if head:
        cands = [d for d in dirs if d == head or d.endswith("/" + head)]
    else:
        prefix = base.split("_")[0] + "_"
        cands = sorted({os.path.dirname(k) for k in known
                        if "_" in base and os.path.basename(k).startswith(prefix)})
    return os.path.join(cands[0], base) if len(cands) == 1 else path


def _camel(stem):
    return "".join(part.capitalize() for part in re.split(r"[_\-]", stem) if part)


def check_signatures(design_text, model):
    findings = []
    named, modules = design_components(design_text)
    classes = model["classes"]
    for name, (kind, where) in sorted(named.items()):
        cls = classes.get(name)
        if cls is None:
            findings.append("%s %s (%s): no class or Protocol in DO-4" % (kind, name, where))
        elif not cls["methods"] and not _implemented_methods(cls, classes):
            findings.append("%s %s (%s): DO-4 defines it with no method signatures"
                            % (kind, name, where))
    top_defs = {n for owner, n, _, _ in model["signatures"] if owner is None}
    annotated_defs = {n for owner, n, ret, _ in model["signatures"]
                      if owner is None and ret is not None}
    placed = set(model.get("placed", ()))
    placed.update(p for fn, p in model.get("links", ()) if fn in annotated_defs)
    for path, (kind, where) in sorted(modules.items()):
        stem = os.path.splitext(os.path.basename(path))[0]
        base = stem[len("repos_"):] if stem.startswith("repos_") else stem
        derived = [_camel(base) + s for s in DERIVED_SUFFIX[kind]]
        if any(n in named for n in derived):
            continue  # already reported (or passed) under its class name
        ok = any(classes.get(n, {}).get("methods") for n in derived)
        ok = ok or any(c["methods"] and path in c["header"] for c in classes.values())
        if kind == "node":
            ok = ok or stem in top_defs or (stem + "_node") in top_defs
        ok = ok or any(_same_module(path, p, modules) for p in placed)
        if not ok:
            findings.append("%s module %s (%s): names no class, and DO-4 has none with methods "
                            "(looked for %s or a class whose definition line cites the path)"
                            % (kind, path, where, " / ".join(derived)))
    return findings


def _implemented_methods(cls, classes):
    """A class whose definition line says `# implements X` takes X's method signatures."""
    m = _IMPLEMENTS.search(cls["header"])
    return bool(m and classes.get(m.group(1), {}).get("methods"))


def _same_module(path, mention, modules):
    """True when a path DO-4 mentions ('nodes/front.py', 'repos_ops.py', or a longer
    'src/pkg/agent/nodes/front.py') names this DO-3 module and no other candidate module."""
    def hit(p):
        return p == mention or p.endswith("/" + mention) or mention.endswith("/" + p)
    return hit(path) and sum(1 for p in modules if hit(p)) == 1


# --------------------------------------------------------------------------- check 2

def _return_names(ret):
    text = _LITERAL.sub("", ret).replace('"', "").replace("'", "")
    text = _QUALIFIED.sub(" ", text)  # module-qualified (anyio.CapacityLimiter): named exactly
    return [n for n in _CAMEL.findall(text) if n not in TYPING_NAMES and len(n) > 1]


def check_return_types(model):
    findings, seen = [], set()
    schemas = model.get("schemas", ())
    for owner, name, ret, raw in model["signatures"]:
        where = "%s.%s" % (owner, name) if owner else name
        if name.startswith("__") and name.endswith("__"):
            continue
        if ret is None:
            findings.append("%s: no return type" % where)
            continue
        bare = ret.strip().strip('"')
        if bare in BARE:
            findings.append("%s -> %s: a bare %s says nothing a test can check" % (where, ret, bare))
            continue
        missing = [t for t in _return_names(ret) if not _defined(model, t)]
        ref = _SIG_OPENAPI.search(raw or "")
        if len(missing) == 1 and ref and ref.group(1) in schemas:
            continue  # "-> StaffingView: ...  # = OpenAPI Staffing": fields are that schema's
        for t in missing:
            if (where, t) not in seen:
                seen.add((where, t))
                findings.append("%s -> %s: %s is never defined with fields in DO-4"
                                % (where, ret, t))
    return findings


# --------------------------------------------------------------------------- check 3

def openapi_error_codes(text):
    """Return {code: where} from ApiError/*Error*/*Notice* `code` enums and x-error(s) values."""
    lines = text.splitlines()
    codes = {}
    for n, line in enumerate(lines):
        m = re.match(r"^(\s*)x-errors?\s*:\s*(.*)$", line)
        if m:
            for c in _yaml_list(lines, n, m.group(2), len(m.group(1))):
                codes.setdefault(c, "x-error line %d" % (n + 1))
            continue
        m = re.match(r"^(\s*)(\w+)\s*:\s*$", line)
        if not m or not re.search(r"error|notice", m.group(2), re.I):
            continue
        base = len(m.group(1))
        end = _block_end(lines, n, base)
        for k in range(n + 1, end):
            cm = re.match(r"^(\s*)code\s*:\s*$", lines[k])
            if not cm:
                continue
            cend = _block_end(lines, k, len(cm.group(1)))
            for e in range(k + 1, cend):
                em = re.match(r"^(\s*)enum\s*:\s*(.*)$", lines[e])
                if em:
                    for c in _yaml_list(lines, e, em.group(2), len(em.group(1))):
                        codes.setdefault(c, "%s line %d" % (m.group(2), e + 1))
                    break
    return codes


def _block_end(lines, start, base):
    k = start + 1
    while k < len(lines):
        s = lines[k]
        if s.strip() and not s.lstrip().startswith("#") and _indent(s) <= base:
            break
        k += 1
    return k


def _yaml_list(lines, n, inline, base):
    inline = inline.strip()
    if inline.startswith("["):
        return [v.strip().strip("\"'") for v in inline.strip("[]").split(",") if v.strip()]
    if inline:
        return [inline.strip("\"'")]
    out, k = [], n + 1
    while k < len(lines):
        s = lines[k]
        if not s.strip():
            k += 1
            continue
        m = re.match(r"^(\s*)-\s+(.*?)\s*$", s)
        if not m or _indent(s) < base:
            break
        out.append(m.group(2).strip("\"'"))
        k += 1
    return out


_DROP_WORDS = {"drop", "drops", "dropped", "remove", "removes", "removed", "without", "gone",
               "replaces", "replaced"}
_MODE_WORD = re.compile(r"`([A-Z][A-Z0-9_]{2,})`|\b((?i:adds?|added|includes?|plus|keeps?|"
                        r"drops?|dropped|removes?|removed|without|replaces|replaced))\b")


def _declared_codes(model):
    """Codes DO-4 declares: members of a class or Literal alias named *Code, plus the codes a
    section headed '...error...' lists in a table, or adds in a paragraph naming a *Code type."""
    known = set()
    for name, cls in model["classes"].items():
        if name.endswith("Code"):
            known.update(cls["members"])
            known.update(cls["members"].values())
    for name, rhs in model["aliases"].items():
        if name.endswith("Code") and "Literal[" in rhs:
            known.update(re.findall(r"[\"']([^\"']+)[\"']", rhs))
    return known | _error_section_codes(model.get("text", ""))


def _error_section_codes(text):
    codes, headings, para, table_header = set(), [], [], None
    in_block = False

    def flush():
        joined = " ".join(para)
        if re.search(r"`\w*Code\b", joined):
            keep = True
            for m in _MODE_WORD.finditer(joined):
                if m.group(2):
                    keep = m.group(2).lower() not in _DROP_WORDS
                elif keep:
                    codes.add(m.group(1))
        del para[:]

    for line in text.splitlines() + [""]:
        if _FENCE_OPEN.match(line):
            in_block = not in_block
            flush()
            continue
        if in_block:
            continue
        h = _HEADING.match(line)
        if h:
            flush()
            level = len(h.group(1))
            while headings and headings[-1][0] >= level:
                headings.pop()
            headings.append((level, bool(re.search(r"error", h.group(2), re.I))))
            table_header = None
            continue
        in_error = any(flag for _, flag in headings)
        s = line.strip()
        if s.startswith("|"):
            flush()
            cells = [c.strip() for c in s.strip("|").split("|")]
            if table_header is None:
                table_header = [c.lower() for c in cells]
                continue
            if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                continue
            if in_error:
                cols = {0} | {n for n, c in enumerate(table_header) if "code" in c}
                for n in cols:
                    if n < len(cells):
                        codes.update(_CODE_TOKEN.findall(cells[n]))
            continue
        table_header = None
        if not s:
            flush()
        elif in_error:
            para.append(s)
    return codes


def check_error_codes(openapi_text, model):
    known = _declared_codes(model)
    if not known:
        return ["DO-4 has no *ErrorCode enum to map the OpenAPI error codes to"]
    return ["%s (%s): no DO-4 *ErrorCode member" % (code, where)
            for code, where in sorted(openapi_error_codes(openapi_text).items())
            if code not in known]


# --------------------------------------------------------------------------- check 4

def required_records(obs_text):
    """Return {record name: [WF ids]} from the 'Required records' column of DO-6."""
    flows, _ = do.parse_workflows(obs_text)
    out = {}
    for wf in flows:
        for name in _record_names(wf["records"]):
            out.setdefault(name, []).append(wf["id"])
    return out


_REC_NOTE = re.compile(r"(?:\*\*|_)?\s*\b(?:Note|NB|See also)\b[^:]{0,80}:.*$", re.S)
_SENTENCE_END = re.compile(r"(?<=[\w`)\]])\.\s+(?=[A-Z*_`])")


def _record_names(cell):
    # The record list is the cell's first sentence; a "**Note (...):** ..." that follows (or
    # any later sentence) is prose about the records, never a record name.
    text = _REC_NOTE.sub(" ", cell)
    text = _SENTENCE_END.split(text, maxsplit=1)[0]
    while True:
        stripped = re.sub(r"\([^()]*\)", " ", text)
        if stripped == text:
            break
        text = stripped
    names = []
    for seg in re.split(r"[;,]|\band\b|\bplus\b", text):
        if re.search(r"\bWF-\d+\b", seg, re.I) or _FILE_TOKEN.search(seg.replace("`", "")):
            continue  # a reference to another workflow's records, or a file named in place
        seg = re.sub(r"`[^`]*`", lambda m: m.group(0) if seg.strip().startswith("`") else " ", seg)
        words = re.findall(r"[A-Za-z][A-Za-z0-9_\-]*", seg.replace("`", ""))
        while words and words[0].lower() in _REC_STOP:
            words.pop(0)
        phrase = []
        for w in words:
            if w.lower() in _REC_QUALIFIER:
                break
            phrase.append(w.lower().replace("-", "_"))
        if phrase:
            names.append("_".join(phrase))
    return names


def storage_vocabulary(*texts):
    vocab = set()
    for text in texts:
        for line in text.splitlines():
            if not _STORAGE_CUE.search(line):
                continue
            for tok in re.findall(r"[A-Za-z][A-Za-z0-9_\-]*", line):
                vocab.add(tok.lower().replace("-", "_"))
            for tok in _FILE_TOKEN.findall(line):
                stem = os.path.splitext(os.path.basename(tok))[0]
                vocab.add(stem.lower().replace("-", "_"))
    return vocab


def storage_names(*texts):
    """The names a storage line gives explicitly: file stems and backticked identifiers."""
    names = set()
    for text in texts:
        for line in text.splitlines():
            if not _STORAGE_CUE.search(line):
                continue
            for tok in _FILE_TOKEN.findall(line):
                names.add(os.path.splitext(os.path.basename(tok))[0].lower().replace("-", "_"))
            for tok in _BACKTICK.findall(line):
                if re.fullmatch(r"[A-Za-z][\w-]*", tok.strip()):
                    names.add(tok.strip().lower().replace("-", "_"))
    return names


def _forms(name):
    forms = {name, name + "s", name + "es"}
    if name.endswith("y"):
        forms.add(name[:-1] + "ies")
    if name.endswith("s"):
        forms.add(name[:-1])
    return forms


def check_records(obs_text, design_text, contract_texts):
    vocab = storage_vocabulary(design_text, *contract_texts)
    named = storage_names(design_text, *contract_texts)
    findings = []
    for name, flows in sorted(required_records(obs_text).items()):
        words = name.split("_")
        candidates = _forms(name) | _forms(words[0]) if len(words) > 1 else _forms(name)
        # the head noun of a multi-word record against an explicitly named file or table:
        # "ingestion manifest" is satisfied by `manifest.json`
        head = _forms(words[-1]) if len(words) > 1 else set()
        if not (candidates & vocab or head & named):
            findings.append("%s (required by %s): no table or file named for it in DO-3 or DO-4"
                            % (name, ", ".join(flows)))
    return findings


# --------------------------------------------------------------------------- run and CLI

def openapi_schemas(text):
    """Return the names under `components: schemas:` in an OpenAPI YAML file."""
    lines, names = text.splitlines(), set()
    for n, line in enumerate(lines):
        m = re.match(r"^(\s*)schemas\s*:\s*$", line)
        if not m:
            continue
        base, child = len(m.group(1)), None
        for s in lines[n + 1:]:
            if not s.strip() or s.lstrip().startswith("#"):
                continue
            ind = _indent(s)
            if ind <= base:
                break
            child = ind if child is None else child
            k = re.match(r"^\s*([A-Za-z_][\w.-]*)\s*:", s)
            if ind == child and k:
                names.add(k.group(1))
    return names


def run(design_text, contract_texts, obs_text, openapi_text=None, allow_types=()):
    model = parse_contracts("\n\n".join(contract_texts))
    model["schemas"] = openapi_schemas(openapi_text) if openapi_text else set()
    model["allowed"] |= set(allow_types)
    result = {
        "signature": check_signatures(design_text, model),
        "return-type": check_return_types(model),
        "error-code": check_error_codes(openapi_text, model) if openapi_text is not None else [],
        "record": check_records(obs_text, design_text, contract_texts),
    }
    return result


def _cli(argv):
    parser = argparse.ArgumentParser(prog="signature_check.py",
                                     description=__doc__.split("\n")[0])
    parser.add_argument("--code-design", required=True, help="DO-3 Markdown file")
    parser.add_argument("--contracts", required=True, action="append",
                        help="DO-4 Markdown file (repeat when DO-4 spans files)")
    parser.add_argument("--observability", required=True, help="DO-6 Markdown file")
    parser.add_argument("--openapi", help="UI contracts (OpenAPI YAML)")
    parser.add_argument("--allow-type", action="append", default=[], metavar="NAME",
                        help="accept NAME (an external or stdlib type) as defined; repeatable")
    parser.add_argument("--json", action="store_true", help="print findings as JSON")
    args = parser.parse_args(argv)
    try:
        design = _read(args.code_design)
        contracts = [_read(p) for p in args.contracts]
        obs = _read(args.observability)
        openapi = _read(args.openapi) if args.openapi else None
    except OSError as e:
        sys.stderr.write("signature_check.py: %s\n" % e)
        return 2
    findings = run(design, contracts, obs, openapi, args.allow_type)
    total = sum(len(v) for v in findings.values())
    counts = ", ".join("%s %d" % (k, len(findings[k])) for k in KINDS)
    if args.json:
        json.dump({"findings": findings, "counts": {k: len(findings[k]) for k in KINDS},
                   "total": total, "openapi_checked": openapi is not None},
                  sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 1 if total else 0
    for kind in KINDS:
        for f in findings[kind]:
            sys.stdout.write("%s: %s\n" % (kind, f))
    if openapi is None:
        sys.stdout.write("note: no --openapi given; error codes not checked\n")
    if total:
        sys.stdout.write("result: %d finding(s) (%s)\n" % (total, counts))
        return 1
    sys.stdout.write("result: signatures complete (name-based; a reviewer still judges fields)\n")
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
