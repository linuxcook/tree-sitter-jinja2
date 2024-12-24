/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  conditional: -1,

  or: 10,
  and: 11,
  not: 12,
  compare: 13,
  plus: 18,
  times: 19,
  unary: 20,
  power: 21,
  tilde: 22,
  call: 23,
};

module.exports = grammar({
  name: "jinja2",

  conflicts: ($) => [
    [$.primary_expression, $.pattern],
    [$.primary_expression, $.parameter],
    [$.tuple, $.parameters],
    [$.tuple, $.tuple_pattern],
    [$.list, $.list_pattern],
  ],

  supertypes: ($) => [
    $._simple_statement,
    $._compound_statement,
    $.expression,
    $.primary_expression,
    $.pattern,
    $.parameter,
  ],

  externals: ($) => [$.string_start, $._string_content, $.string_end],

  inline: ($) => [
    $._simple_statement,
    $._compound_statement,
    $._expressions,
    $._left_hand_side,
  ],

  word: ($) => $.identifier,

  rules: {
    template: ($) =>
      repeat(
        choice($.jinja_statement, $.jinja_expression, $.jinja_comment, $._text),
      ),

    // Jinja2 statements
    jinja_statement: ($) =>
      prec(23, seq(/\{%-?/, optional($._statement), /-?%\}/)),

    // Jinja2 expressions
    jinja_expression: ($) =>
      prec(23, seq(/\{\{-?/, optional($.expression), /-?\}\}/)),

    // Jinja2 comments
    jinja_comment: ($) => prec(23, seq("{#", repeat(/./), "#}")),

    _statement: ($) => choice($._simple_statement, $._compound_statement),

    // Simple statements

    _simple_statement: ($) =>
      choice(
        $.import_statement,
        $.import_from_statement,
        $.expression_statement,
        $.extends_statement,
        $.include_statement,
        $.end_statement,
      ),

    import_statement: ($) =>
      seq(
        "import",
        $._import_list,
        optional(choice("with context", "without context")),
      ),

    import_from_statement: ($) =>
      seq(
        "from",
        field("module_name", $.string),
        "import",
        choice(
          $.wildcard_import,
          $._import_list,
          seq("(", $._import_list, ")"),
        ),
        optional(choice("with context", "without context")),
      ),

    _import_list: ($) =>
      seq(
        commaSep1(
          field(
            "name",
            choice(choice($.string, $.identifier), $.aliased_import),
          ),
        ),
        optional(","),
      ),

    aliased_import: ($) =>
      seq(
        field("name", choice($.string, $.identifier)),
        "as",
        field("alias", $.identifier),
      ),

    wildcard_import: (_) => "*",

    expression_statement: ($) =>
      choice(
        $.expression,
        seq(commaSep1($.expression), optional(",")),
        $.assignment,
      ),

    _expressions: ($) => choice($.expression, $.expression_list),

    extends_statement: ($) => seq("extends", $.expression),

    include_statement: ($) =>
      seq(
        "include",
        $.expression,
        optional("ignore missing"),
        optional(choice("without context", "with context")),
      ),

    end_statement: (_) =>
      choice(
        "endif",
        "endfor",
        "endwhile",
        "endmacro",
        "endcall",
        "endfilter",
        "endset",
        "endblock",
      ),

    // Compound statements

    _compound_statement: ($) =>
      choice(
        $.if_statement,
        $.elif_statement,
        $.else_statement,
        $.for_statement,
        $.while_statement,
        $.macro_statement,
        $.call_statement,
        $.filter_statement,
        $.set_statement,
        $.block_statement,
      ),

    if_statement: ($) => seq("if", field("condition", $.expression)),

    elif_statement: ($) => seq("elif", field("condition", $.expression)),

    else_statement: (_) => "else",

    for_statement: ($) =>
      seq(
        "for",
        field("left", $._left_hand_side),
        "in",
        field("right", $._expressions),
        optional($.if_statement),
        optional("recursive"),
      ),

    while_statement: ($) => seq("while", field("condition", $.expression)),

    macro_statement: ($) =>
      seq(
        "macro",
        field("name", $.identifier),
        field("parameters", $.parameters),
      ),

    call_statement: ($) =>
      seq(
        "call",
        optional(field("parameters", $.parameters)),
        field("callable", $.call),
      ),

    filter_statement: ($) => seq("filter", field("filter", $.expression)),

    set_statement: ($) =>
      seq("set", field("assignment", choice($.expression, $.assignment))),

    block_statement: ($) => seq("block", field("name", $.identifier)),

    parameters: ($) => seq("(", optional($._parameters), ")"),

    as_pattern: ($) =>
      prec.left(
        seq(
          $.expression,
          "as",
          field("alias", alias($.expression, $.as_pattern_target)),
        ),
      ),

    // Expressions

    expression: ($) =>
      choice(
        $.comparison_operator,
        $.not_operator,
        $.boolean_operator,
        $.primary_expression,
        $.conditional_expression,
        $.as_pattern,
      ),

    primary_expression: ($) =>
      choice(
        $.binary_operator,
        $.identifier,
        $.string,
        $.concatenated_string,
        $.integer,
        $.float,
        $.true,
        $.false,
        $.none,
        $.unary_operator,
        $.attribute,
        $.filter,
        $.subscript,
        $.call,
        $.list,
        $.dictionary,
        $.tuple,
      ),

    not_operator: ($) =>
      prec(PREC.not, seq("not", field("argument", $.expression))),

    boolean_operator: ($) =>
      choice(
        prec.left(
          PREC.and,
          seq(
            field("left", $.expression),
            field("operator", "and"),
            field("right", $.expression),
          ),
        ),
        prec.left(
          PREC.or,
          seq(
            field("left", $.expression),
            field("operator", "or"),
            field("right", $.expression),
          ),
        ),
      ),

    binary_operator: ($) => {
      /**@type {Array<[(value: number, rule: RuleOrLiteral) => PrecLeftRule | PrecRightRule, string, number]>}*/
      const table = [
        [prec.left, "+", PREC.plus],
        [prec.left, "-", PREC.plus],
        [prec.left, "*", PREC.times],
        [prec.left, "/", PREC.times],
        [prec.left, "%", PREC.times],
        [prec.left, "//", PREC.times],
        [prec.right, "**", PREC.power],
        [prec.left, "~", PREC.tilde],
      ];

      return choice(
        ...table.map(([fn, operator, precedence]) =>
          fn(
            precedence,
            seq(
              field("left", $.primary_expression),
              field("operator", operator),
              field("right", $.primary_expression),
            ),
          ),
        ),
      );
    },

    unary_operator: ($) =>
      prec(
        PREC.unary,
        seq(
          field("operator", choice("+", "-", "~")),
          field("argument", $.primary_expression),
        ),
      ),

    comparison_operator: ($) =>
      prec.left(
        PREC.compare,
        seq(
          $.primary_expression,
          repeat1(
            seq(
              field(
                "operators",
                choice(
                  "<",
                  "<=",
                  "==",
                  "!=",
                  ">=",
                  ">",
                  "in",
                  alias(seq("not", "in"), "not in"),
                  "is",
                  alias(seq("is", "not"), "is not"),
                ),
              ),
              $.primary_expression,
            ),
          ),
        ),
      ),

    assignment: ($) =>
      seq(
        field("left", $._left_hand_side),
        seq("=", field("right", $._right_hand_side)),
      ),

    _left_hand_side: ($) => choice($.pattern, $.pattern_list),

    pattern_list: ($) =>
      seq(
        $.pattern,
        choice(",", seq(repeat1(seq(",", $.pattern)), optional(","))),
      ),

    _right_hand_side: ($) =>
      choice($.expression, $.expression_list, $.assignment, $.pattern_list),

    attribute: ($) =>
      prec(
        PREC.call,
        seq(
          field("object", $.primary_expression),
          ".",
          field("attribute", $.identifier),
        ),
      ),

    filter: ($) =>
      prec(
        PREC.call,
        seq(
          field("object", $.primary_expression),
          "|",
          field("filter", $.identifier),
        ),
      ),

    subscript: ($) =>
      prec(
        PREC.call,
        seq(
          field("value", $.primary_expression),
          "[",
          commaSep1(field("subscript", choice($.expression, $.slice))),
          optional(","),
          "]",
        ),
      ),

    slice: ($) =>
      seq(
        optional($.expression),
        ":",
        optional($.expression),
        optional(seq(":", optional($.expression))),
      ),

    call: ($) =>
      prec(
        PREC.call,
        seq(
          field("function", $.primary_expression),
          field("arguments", $.argument_list),
        ),
      ),

    argument_list: ($) =>
      seq(
        "(",
        optional(commaSep1(choice($.expression, $.keyword_argument))),
        optional(","),
        ")",
      ),

    expression_list: ($) =>
      prec.right(
        seq(
          $.expression,
          choice(",", seq(repeat1(seq(",", $.expression)), optional(","))),
        ),
      ),

    dotted_name: ($) => prec(1, sep1($.identifier, ".")),

    filter_name: ($) => prec(1, sep1($.identifier, "|")),

    // Match cases

    case_pattern: ($) =>
      prec(
        1,
        choice(
          alias($._as_pattern, $.as_pattern),
          $.keyword_pattern,
          $._simple_pattern,
        ),
      ),

    _simple_pattern: ($) =>
      prec(
        1,
        choice(
          alias($._list_pattern, $.list_pattern),
          alias($._tuple_pattern, $.tuple_pattern),
          $.dict_pattern,
          $.string,
          $.concatenated_string,
          $.true,
          $.false,
          $.none,
          seq(optional("-"), choice($.integer, $.float)),
          $.dotted_name,
          $.filter_name,
          $.complex_pattern,
          "_",
        ),
      ),

    _as_pattern: ($) => seq($.case_pattern, "as", $.identifier),

    _list_pattern: ($) =>
      seq("[", optional(seq(commaSep1($.case_pattern), optional(","))), "]"),

    _tuple_pattern: ($) =>
      seq("(", optional(seq(commaSep1($.case_pattern), optional(","))), ")"),

    dict_pattern: ($) =>
      seq(
        "{",
        optional(seq(commaSep1($._key_value_pattern), optional(","))),
        "}",
      ),

    _key_value_pattern: ($) =>
      seq(field("key", $.string), ":", field("value", $.case_pattern)),

    keyword_pattern: ($) => seq($.identifier, "=", $._simple_pattern),

    class_pattern: ($) =>
      seq(
        $.dotted_name,
        "(",
        optional(seq(commaSep1($.case_pattern), optional(","))),
        ")",
      ),

    complex_pattern: ($) =>
      prec(
        1,
        seq(
          optional("-"),
          choice($.integer, $.float),
          choice("+", "-"),
          choice($.integer, $.float),
        ),
      ),

    // Patterns

    _parameters: ($) => seq(commaSep1($.parameter), optional(",")),

    _patterns: ($) => seq(commaSep1($.pattern), optional(",")),

    parameter: ($) =>
      choice(
        $.identifier,
        $.default_parameter,
        $.tuple_pattern,
        $.keyword_separator,
        $.positional_separtor,
      ),

    pattern: ($) => choice($.identifier, $.tuple_pattern, $.list_pattern),

    tuple_pattern: ($) => seq("(", optional($._patterns), ")"),

    list_pattern: ($) => seq("[", optional($._patterns), "]"),

    default_parameter: ($) =>
      seq(
        field("name", choice($.identifier, $.tuple_pattern)),
        "=",
        field("value", $.expression),
      ),

    integer: (_) => token(/\d+/),

    float: (_) => token(seq(/\d+/, ".", optional(/\d+/))),

    keyword_argument: ($) =>
      seq(field("name", $.identifier), "=", field("value", $.expression)),

    // Literals

    list: ($) => seq("[", optional($._collection_elements), "]"),

    tuple: ($) => seq("(", optional($._collection_elements), ")"),

    dictionary: ($) =>
      seq("{", optional(commaSep1($.pair)), optional(","), "}"),

    pair: ($) =>
      seq(field("key", $.expression), ":", field("value", $.expression)),

    _collection_elements: ($) => seq(commaSep1($.expression), optional(",")),

    conditional_expression: ($) =>
      prec.right(
        PREC.conditional,
        seq($.expression, "if", $.expression, "else", $.expression),
      ),

    concatenated_string: ($) => seq($.string, repeat1($.string)),

    string: ($) =>
      seq(
        $.string_start,
        repeat(choice($.interpolation, $.string_content)),
        $.string_end,
      ),

    string_content: ($) =>
      prec.right(
        repeat1(
          choice($.escape_sequence, $._not_escape_sequence, $._string_content),
        ),
      ),

    interpolation: ($) =>
      seq(
        "{",
        optional(field("type_conversion", $.type_conversion)),
        optional(field("format_specifier", $.format_specifier)),
        "}",
      ),

    escape_sequence: (_) =>
      token.immediate(
        prec(
          1,
          seq(
            "\\",
            choice(
              /u[a-fA-F\d]{4}/,
              /U[a-fA-F\d]{8}/,
              /x[a-fA-F\d]{2}/,
              /\d{3}/,
              /\r?\n/,
              /['"abfrntv\\]/,
              /N\{[^}]+\}/,
            ),
          ),
        ),
      ),

    _not_escape_sequence: (_) => token.immediate("\\"),

    format_specifier: ($) =>
      seq(
        ":",
        repeat(
          choice(
            token(prec(1, /[^{}\n]+/)),
            alias($.interpolation, $.format_expression),
          ),
        ),
      ),

    type_conversion: (_) => /![a-z]/,

    identifier: ($) => /\w+/,

    true: (_) => "true",
    false: (_) => "false",
    none: (_) => "none",

    positional_separtor: (_) => "/",
    keyword_separator: (_) => "*",

    _text: (_) => prec.right(repeat1(/[^{]+|\{/)),
  },
});

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {SeqRule}
 *
 */
function commaSep1(rule) {
  return sep1(rule, ",");
}

/**
 * Creates a rule to match one or more occurrences of `rule` separated by `sep`
 *
 * @param {RuleOrLiteral} rule
 *
 * @param {RuleOrLiteral} separator
 *
 * @return {SeqRule}
 *
 */
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
