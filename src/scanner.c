#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "tree_sitter/array.h"
#include "tree_sitter/parser.h"

enum TokenType {
  STRING_START,
  STRING_CONTENT,
  STRING_END,
  CONTENT,
  RAW_CONTENT,
};

typedef enum {
  SingleQuote = 1 << 0,
  DoubleQuote = 1 << 1,
  Triple = 1 << 3,
} Flags;

typedef struct {
  char flags;
} Delimiter;

static bool match(TSLexer *lexer, const char *p) {
  while (*p) {
    if (lexer->lookahead != *p)
      return false;
    lexer->advance(lexer, false);
    ++p;
  }
  return true;
}

static inline Delimiter new_delimiter() { return (Delimiter){0}; }

static inline bool is_triple(Delimiter *delimiter) {
  return delimiter->flags & Triple;
}

static inline int32_t end_character(Delimiter *delimiter) {
  if (delimiter->flags & SingleQuote) {
    return '\'';
  }
  if (delimiter->flags & DoubleQuote) {
    return '"';
  }
  return 0;
}

static inline void set_triple(Delimiter *delimiter) {
  delimiter->flags |= Triple;
}

static inline void set_end_character(Delimiter *delimiter, int32_t character) {
  switch (character) {
  case '\'':
    delimiter->flags |= SingleQuote;
    break;
  case '"':
    delimiter->flags |= DoubleQuote;
    break;
  default:
    assert(false);
  }
}

typedef struct {
  Array(Delimiter) delimiters;
} Scanner;

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

bool tree_sitter_jinja2_external_scanner_scan(void *payload, TSLexer *lexer,
                                              const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;

  bool advanced_once = false;
  if (valid_symbols[STRING_CONTENT] && scanner->delimiters.size > 0) {
    Delimiter *delimiter = array_back(&scanner->delimiters);
    int32_t end_char = end_character(delimiter);
    bool has_content = advanced_once;
    while (lexer->lookahead) {
      if (lexer->lookahead == '\\') {
        lexer->mark_end(lexer);
        lexer->result_symbol = STRING_CONTENT;
        return has_content;
      } else if (lexer->lookahead == end_char) {
        if (is_triple(delimiter)) {
          lexer->mark_end(lexer);
          advance(lexer);
          if (lexer->lookahead == end_char) {
            advance(lexer);
            if (lexer->lookahead == end_char) {
              if (has_content) {
                lexer->result_symbol = STRING_CONTENT;
              } else {
                advance(lexer);
                lexer->mark_end(lexer);
                (void)array_pop(&scanner->delimiters);
                lexer->result_symbol = STRING_END;
              }
              return true;
            }
            lexer->mark_end(lexer);
            lexer->result_symbol = STRING_CONTENT;
            return true;
          }
          lexer->mark_end(lexer);
          lexer->result_symbol = STRING_CONTENT;
          return true;
        }
        if (has_content) {
          lexer->result_symbol = STRING_CONTENT;
        } else {
          advance(lexer);
          (void)array_pop(&scanner->delimiters);
          lexer->result_symbol = STRING_END;
        }
        lexer->mark_end(lexer);
        return true;

      } else if (lexer->lookahead == '\n' && has_content &&
                 !is_triple(delimiter)) {
        return false;
      }
      advance(lexer);
      has_content = true;
    }
  }

  lexer->mark_end(lexer);

  if (valid_symbols[CONTENT]) {
    bool consumed = false;

    lexer->mark_end(lexer);
    while (!lexer->eof(lexer)) {
      if (lexer->lookahead == '{') {
        lexer->advance(lexer, false);

        if (lexer->lookahead == '%' || lexer->lookahead == '{' ||
            lexer->lookahead == '#') {
          break;
        }
      } else {
        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
      }

      consumed = true;
    }

    if (consumed) {
      lexer->result_symbol = CONTENT;
      return true;
    }
  }

  for (;;) {
    if (lexer->lookahead == '\n') {
      skip(lexer);
    } else if (lexer->lookahead == ' ') {
      skip(lexer);
    } else if (lexer->lookahead == '\r' || lexer->lookahead == '\f') {
      skip(lexer);
    } else if (lexer->lookahead == '\t') {
      skip(lexer);
    } else if (lexer->lookahead == '\\') {
      skip(lexer);
      if (lexer->lookahead == '\r') {
        skip(lexer);
      }
      if (lexer->lookahead == '\n' || lexer->eof(lexer)) {
        skip(lexer);
      } else {
        return false;
      }
    } else if (lexer->eof(lexer)) {
      break;
    } else {
      break;
    }
  }

  if (valid_symbols[STRING_START]) {
    Delimiter delimiter = new_delimiter();

    if (lexer->lookahead == '\'') {
      set_end_character(&delimiter, '\'');
      advance(lexer);
      lexer->mark_end(lexer);
      if (lexer->lookahead == '\'') {
        advance(lexer);
        if (lexer->lookahead == '\'') {
          advance(lexer);
          lexer->mark_end(lexer);
          set_triple(&delimiter);
        }
      }
    } else if (lexer->lookahead == '"') {
      set_end_character(&delimiter, '"');
      advance(lexer);
      lexer->mark_end(lexer);
      if (lexer->lookahead == '"') {
        advance(lexer);
        if (lexer->lookahead == '"') {
          advance(lexer);
          lexer->mark_end(lexer);
          set_triple(&delimiter);
        }
      }
    }

    if (end_character(&delimiter)) {
      array_push(&scanner->delimiters, delimiter);
      lexer->result_symbol = STRING_START;
      return true;
    }
  }

  if (valid_symbols[RAW_CONTENT]) {
    lexer->mark_end(lexer);
    while (!lexer->eof(lexer)) {
      if (lexer->lookahead == '{') {
        if (match(lexer, "{%")) {
          if (lexer->lookahead == '-') {
            lexer->advance(lexer, false);
          }

          while (lexer->lookahead == ' ') {
            lexer->advance(lexer, true);
          }

          if (match(lexer, "endraw")) {
            while (lexer->lookahead == ' ') {
              lexer->advance(lexer, true);
            }

            if (lexer->lookahead == '-') {
              lexer->advance(lexer, false);
            }

            if (match(lexer, "%}")) {
              lexer->result_symbol = RAW_CONTENT;
              return true;
            }
          }
        }
      } else {
        lexer->advance(lexer, false);
      }

      lexer->mark_end(lexer);
    }
  }

  return false;
}

unsigned tree_sitter_jinja2_external_scanner_serialize(void *payload,
                                                       char *buffer) {
  Scanner *scanner = (Scanner *)payload;

  size_t size = 0;

  size_t delimiter_count = scanner->delimiters.size;
  if (delimiter_count > UINT8_MAX) {
    delimiter_count = UINT8_MAX;
  }
  buffer[size++] = (char)delimiter_count;

  if (delimiter_count > 0) {
    memcpy(&buffer[size], scanner->delimiters.contents, delimiter_count);
  }
  size += delimiter_count;

  return size;
}

void tree_sitter_jinja2_external_scanner_deserialize(void *payload,
                                                     const char *buffer,
                                                     unsigned length) {
  Scanner *scanner = (Scanner *)payload;

  array_delete(&scanner->delimiters);

  if (length > 0) {
    size_t size = 0;

    size_t delimiter_count = (uint8_t)buffer[size++];
    if (delimiter_count > 0) {
      array_reserve(&scanner->delimiters, delimiter_count);
      scanner->delimiters.size = delimiter_count;
      memcpy(scanner->delimiters.contents, &buffer[size], delimiter_count);
      size += delimiter_count;
    }
  }
}

void *tree_sitter_jinja2_external_scanner_create() {
#if defined(__STDC_VERSION__) && (__STDC_VERSION__ >= 201112L)
  _Static_assert(sizeof(Delimiter) == sizeof(char), "");
#else
  assert(sizeof(Delimiter) == sizeof(char));
#endif
  Scanner *scanner = calloc(1, sizeof(Scanner));
  array_init(&scanner->delimiters);
  tree_sitter_jinja2_external_scanner_deserialize(scanner, NULL, 0);
  return scanner;
}

void tree_sitter_jinja2_external_scanner_destroy(void *payload) {
  Scanner *scanner = (Scanner *)payload;
  array_delete(&scanner->delimiters);
  free(scanner);
}
