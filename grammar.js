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
    [$.else_clause],
    [$.elif_clause],
    [$.tuple, $.parameters],
    [$.primary_expression, $.parameter],
    [$.tuple, $.tuple_pattern],
    [$.primary_expression, $.pattern],
    [$.list, $.list_pattern],
  ],

  supertypes: ($) => [$.primary_expression, $.pattern, $.parameter],

  externals: ($) => [$.string_start, $._string_content, $.string_end],

  word: ($) => $.identifier,

  rules: {
    template: ($) => repeat($._block),

    _block: ($) => choice($._statement, $.expression, $.comment, $.content),

    content: (_) => token(repeat(/[^{]+|\{[^{%#]/)),

    comment: (_) => seq("{#", repeat(/./), "#}", optional("\n")),

    _statement: ($) =>
      seq(
        choice(
          $.if_statement,
          $.for_statement,
          $.macro_statement,
          $.call_statement,
          $.filter_statement,
          $.set_statement,
          $.block_statement,
          //$.raw_statement,
          $.extends_statement,
          $.include_statement,
          $.import_statement,
          $.import_from_statement,
        ),
        optional("\n"),
      ),

    expression: ($) =>
      seq(
        choice("{{", "{{-"),
        optional($._expression),
        choice("}}", "-}}"),
        optional("\n"),
      ),

    // Statements

    if_statement: ($) =>
      seq(
        tag("if", field("condition", $._expression)),
        repeat($._block),
        repeat($.elif_clause),
        optional($.else_clause),
        prec.right(tag("endif")),
      ),

    elif_clause: ($) =>
      prec.dynamic(
        1,
        seq(tag("elif", field("condition", $._expression)), repeat($._block)),
      ),

    else_clause: ($) => prec.dynamic(2, seq(tag("else"), repeat($._block))),

    for_statement: ($) =>
      seq(
        tag(
          "for",
          field("left", $._left_hand_side),
          "in",
          field("right", $._expressions),
          optional(seq("if", field("condition", $._expression))),
          optional("recursive"),
        ),
        repeat($._block),
        tag("endfor"),
      ),

    macro_statement: ($) =>
      seq(
        tag(
          "macro",
          field("name", $.identifier),
          field("parameters", $.parameters),
        ),
        repeat($._block),
        tag("endmacro"),
      ),

    call_statement: ($) =>
      seq(
        tag(
          "call",
          optional(field("parameters", $.parameters)),
          field("callable", $.call),
        ),
        repeat($._block),
        tag("endcall"),
      ),

    filter_statement: ($) =>
      seq(
        tag("filter", field("filter", $._expression)),
        repeat($._block),
        tag("endfilter"),
      ),

    set_statement: ($) =>
      choice(
        tag(
          "set",
          field("left", $._left_hand_side),
          "=",
          field("right", $._right_hand_side),
        ),
        seq(
          tag("set", field("variable", choice($.identifier, $.filter))),
          repeat($._block),
          tag("endset"),
        ),
      ),

    block_statement: ($) =>
      seq(
        tag("block", field("name", $.identifier), optional("scoped")),
        repeat($._block),
        tag("endblock", optional($.identifier)),
      ),

    //raw_statement: ($) =>
    //  seq(tag("raw"), alias($._raw, $.content), tag("endraw")),

    extends_statement: ($) => tag("extends", $._expression),

    include_statement: ($) =>
      tag(
        "include",
        $._expression,
        optional("ignore missing"),
        optional(choice("without context", "with context")),
      ),

    import_statement: ($) =>
      tag(
        "import",
        $._import_list,
        optional(choice("with context", "without context")),
      ),

    import_from_statement: ($) =>
      tag(
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

    parameters: ($) => seq("(", optional($._parameters), ")"),

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
      choice($._expression, $.expression_list, $.assignment, $.pattern_list),

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
        field("value", $._expression),
      ),

    keyword_separator: (_) => "*",
    positional_separtor: (_) => "/",

    // Expression details

    _expressions: ($) => choice($._expression, $.expression_list),

    expression_list: ($) =>
      prec.right(
        seq(
          $._expression,
          choice(",", seq(repeat1(seq(",", $._expression)), optional(","))),
        ),
      ),

    _expression: ($) =>
      choice(
        $.comparison_operator,
        $.not_operator,
        $.boolean_operator,
        $.primary_expression,
        $.conditional_expression,
        $.as_pattern,
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

    not_operator: ($) =>
      prec(PREC.not, seq("not", field("argument", $._expression))),

    boolean_operator: ($) =>
      choice(
        prec.left(
          PREC.and,
          seq(
            field("left", $._expression),
            field("operator", "and"),
            field("right", $._expression),
          ),
        ),
        prec.left(
          PREC.or,
          seq(
            field("left", $._expression),
            field("operator", "or"),
            field("right", $._expression),
          ),
        ),
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

    binary_operator: ($) => {
      /**
       * @type {Array<[(value: number, rule: RuleOrLiteral) => PrecLeftRule | PrecRightRule, string, number]>}
       */
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

    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    string: ($) => seq($.string_start, repeat($.string_content), $.string_end),

    string_content: ($) =>
      prec.right(repeat1(choice($.escape_sequence, $._string_content))),

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

    concatenated_string: ($) => seq($.string, repeat1($.string)),

    integer: (_) => /[0-9]+/,

    float: (_) => /[0-9]+\.[0-9]+/,

    true: (_) => "true",

    false: (_) => "false",

    none: (_) => "none",

    unary_operator: ($) =>
      prec(
        PREC.unary,
        seq(
          field("operator", choice("+", "-")),
          field("argument", $.primary_expression),
        ),
      ),

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
          commaSep1(field("subscript", choice($._expression, $.slice))),
          optional(","),
          "]",
        ),
      ),

    slice: ($) =>
      seq(
        optional($._expression),
        ":",
        optional($._expression),
        optional(seq(":", optional($._expression))),
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
        optional(commaSep1(choice($._expression, $.keyword_argument))),
        optional(","),
        ")",
      ),

    keyword_argument: ($) =>
      seq(field("name", $.identifier), "=", field("value", $._expression)),

    list: ($) => seq("[", optional($._collection_elements), "]"),

    dictionary: ($) =>
      seq("{", optional(commaSep1($.pair)), optional(","), "}"),

    tuple: ($) => seq("(", optional($._collection_elements), ")"),

    pair: ($) =>
      seq(field("key", $._expression), ":", field("value", $._expression)),

    _collection_elements: ($) => seq(commaSep1($._expression), optional(",")),

    conditional_expression: ($) =>
      prec.right(
        PREC.conditional,
        seq($._expression, "if", $._expression, "else", $._expression),
      ),

    as_pattern: ($) =>
      prec.left(
        seq(
          $._expression,
          "as",
          field("alias", alias($._expression, $.as_pattern_target)),
        ),
      ),
  },
});

/**
 * Creates a rule to match one or more of the rules separated by a comma
 * @param {RuleOrLiteral} rule
 * @return {SeqRule}
 */
function commaSep1(rule) {
  return sep1(rule, ",");
}

/**
 * Creates a rule to match one or more occurrences of `rule` separated by `sep`
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 * @return {SeqRule}
 */
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

/**
 * Tags a statement for jinja
 * @param {RuleOrLiteral[]} rules
 * @return {SeqRule}
 */
function tag(...rules) {
  return seq(choice("{%", "{%-"), ...rules, choice("%}", "-%}"));
}
