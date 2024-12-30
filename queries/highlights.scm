; Variables
(identifier) @variable

; Identifier naming conventions
((identifier) @type
  (#lua-match? @type "^[A-Z].*[a-z]"))

((identifier) @constant
  (#lua-match? @constant "^[A-Z][A-Z_0-9]*$"))

((identifier) @constant.builtin
  (#lua-match? @constant.builtin "^__[a-zA-Z0-9_]*__$"))

((identifier) @constant.builtin
  (#any-of? @constant.builtin
    ; https://docs.python.org/3/library/constants.html
    "NotImplemented" "Ellipsis" "quit" "exit" "copyright" "credits" "license"))

((attribute
  attribute: (identifier) @variable.member)
  (#lua-match? @variable.member "^[%l_].*$"))

((filter
  filter: (identifier) @variable.member)
  (#lua-match? @variable.member "^[%l_].*$"))

((assignment
  left: (identifier) @type.definition))

((assignment
  left: (identifier) @type.definition
  right: (call
    function: (identifier) @_func))
  (#any-of? @_func "TypeVar" "NewType"))

; Function calls
(call
  function: (identifier) @function.call)

(call
  function: (attribute
    attribute: (identifier) @function.method.call))

((call
  function: (identifier) @constructor)
  (#lua-match? @constructor "^%u"))

((call
  function: (attribute
    attribute: (identifier) @constructor))
  (#lua-match? @constructor "^%u"))

; Builtin functions
((call
  function: (identifier) @function.builtin)
  (#any-of? @function.builtin
    "abs" "all" "any" "ascii" "bin" "bool" "breakpoint" "bytearray" "bytes" "callable" "chr"
    "classmethod" "compile" "complex" "delattr" "dict" "dir" "divmod" "enumerate" "eval" "exec"
    "filter" "float" "format" "frozenset" "getattr" "globals" "hasattr" "hash" "help" "hex" "id"
    "input" "int" "isinstance" "issubclass" "iter" "len" "list" "locals" "map" "max" "memoryview"
    "min" "next" "object" "oct" "open" "ord" "pow" "print" "property" "range" "repr" "reversed"
    "round" "set" "setattr" "slice" "sorted" "staticmethod" "str" "sum" "super" "tuple" "type"
    "vars" "zip" "__import__"))

; Function definitions
(macro_statement
  name: (identifier) @function)

((call
  function: (identifier) @_isinstance
  arguments: (argument_list
    (_)
    (identifier) @type))
  (#eq? @_isinstance "isinstance"))

; Normal parameters
(parameters
  (identifier) @variable.parameter)

; Default parameters
(keyword_argument
  name: (identifier) @variable.parameter)

; Naming parameters on call-site
(default_parameter
  name: (identifier) @variable.parameter)

; Literals
(none) @constant.builtin

[
  (true)
  (false)
] @boolean

((identifier) @variable.builtin
  (#eq? @variable.builtin "self"))

((identifier) @variable.builtin
  (#eq? @variable.builtin "cls"))

(integer) @number

(float) @number.float

(comment) @comment @spell

[
  (escape_sequence)
] @string.escape

(string) @string

; Tokens
[
  "-"
  "!="
  "*"
  "**"
  "/"
  "//"
  "%"
  "+"
  "<"
  "<="
  "="
  "=="
  ">"
  ">="
  "~"
  "|"
] @operator

[
 "{%"
 "{%-"
 "%}"
 "-%}"
 "{{"
 "{{-"
 "}}"
 "-}}"
] @tag

; Keywords
[
  "and"
  "in"
  "is"
  "not"
  "or"
  "is not"
  "not in"
] @keyword.operator

[
  "as"
  "macro"
  "block"
  "call"
  "filter"
  "set"
  "extends"
  "endmacro"
  "endcall"
  "endfilter"
  "endset"
  "endblock"
] @keyword

"include" @keyword.import

(import_from_statement
  "from" @keyword.import)

"import" @keyword.import

(aliased_import
  "as" @keyword.import)

[
  "if"
  "elif"
  "else"
  "endif"
] @keyword.conditional

[
  "for"
  "endfor"
] @keyword.repeat

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  "."
  ":"
] @punctuation.delimiter
