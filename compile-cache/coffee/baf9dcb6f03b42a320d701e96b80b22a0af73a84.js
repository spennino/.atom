(function() {
  var AFTERPROPS, AutoIndent, BRACE_CLOSE, BRACE_OPEN, CompositeDisposable, DidInsertText, File, JSXBRACE_CLOSE, JSXBRACE_OPEN, JSXTAG_CLOSE, JSXTAG_CLOSE_ATTRS, JSXTAG_OPEN, JSXTAG_SELFCLOSE_END, JSXTAG_SELFCLOSE_START, JS_ELSE, JS_IF, JS_RETURN, LINEALIGNED, NO_TOKEN, PAREN_CLOSE, PAREN_OPEN, PROPSALIGNED, Point, Range, SWITCH_BRACE_CLOSE, SWITCH_BRACE_OPEN, SWITCH_CASE, SWITCH_DEFAULT, TAGALIGNED, TEMPLATE_END, TEMPLATE_START, TERNARY_ELSE, TERNARY_IF, autoCompleteJSX, path, ref, stripJsonComments,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  ref = require('atom'), CompositeDisposable = ref.CompositeDisposable, File = ref.File, Range = ref.Range, Point = ref.Point;

  path = require('path');

  autoCompleteJSX = require('./auto-complete-jsx');

  DidInsertText = require('./did-insert-text');

  stripJsonComments = require('strip-json-comments');

  NO_TOKEN = 0;

  JSXTAG_SELFCLOSE_START = 1;

  JSXTAG_SELFCLOSE_END = 2;

  JSXTAG_OPEN = 3;

  JSXTAG_CLOSE_ATTRS = 4;

  JSXTAG_CLOSE = 5;

  JSXBRACE_OPEN = 6;

  JSXBRACE_CLOSE = 7;

  BRACE_OPEN = 8;

  BRACE_CLOSE = 9;

  TERNARY_IF = 10;

  TERNARY_ELSE = 11;

  JS_IF = 12;

  JS_ELSE = 13;

  SWITCH_BRACE_OPEN = 14;

  SWITCH_BRACE_CLOSE = 15;

  SWITCH_CASE = 16;

  SWITCH_DEFAULT = 17;

  JS_RETURN = 18;

  PAREN_OPEN = 19;

  PAREN_CLOSE = 20;

  TEMPLATE_START = 21;

  TEMPLATE_END = 22;

  TAGALIGNED = 'tag-aligned';

  LINEALIGNED = 'line-aligned';

  AFTERPROPS = 'after-props';

  PROPSALIGNED = 'props-aligned';

  module.exports = AutoIndent = (function() {
    function AutoIndent(editor) {
      this.editor = editor;
      this.onMouseUp = bind(this.onMouseUp, this);
      this.onMouseDown = bind(this.onMouseDown, this);
      this.handleOnDidStopChanging = bind(this.handleOnDidStopChanging, this);
      this.changedCursorPosition = bind(this.changedCursorPosition, this);
      this.DidInsertText = new DidInsertText(this.editor);
      this.autoJsx = atom.config.get('language-babel').autoIndentJSX;
      this.JSXREGEXP = /(<)([$_A-Za-z](?:[$_.:\-A-Za-z0-9])*)|(\/>)|(<\/)([$_A-Za-z](?:[$._:\-A-Za-z0-9])*)(>)|(>)|({)|(})|(\?)|(:)|(if)|(else)|(case)|(default)|(return)|(\()|(\))|(`)|(?:(<)\s*(>))|(<\/)(>)/g;
      this.mouseUp = true;
      this.multipleCursorTrigger = 1;
      this.disposables = new CompositeDisposable();
      this.eslintIndentOptions = this.getIndentOptions();
      this.templateDepth = 0;
      this.disposables.add(atom.config.observe('language-babel.autoIndentJSX', (function(_this) {
        return function(value) {
          return _this.autoJsx = value;
        };
      })(this)));
      this.disposables.add(atom.commands.add('atom-text-editor', {
        'language-babel:auto-indent-jsx-on': (function(_this) {
          return function(event) {
            _this.autoJsx = true;
            return _this.eslintIndentOptions = _this.getIndentOptions();
          };
        })(this)
      }));
      this.disposables.add(atom.commands.add('atom-text-editor', {
        'language-babel:auto-indent-jsx-off': (function(_this) {
          return function(event) {
            return _this.autoJsx = false;
          };
        })(this)
      }));
      this.disposables.add(atom.commands.add('atom-text-editor', {
        'language-babel:toggle-auto-indent-jsx': (function(_this) {
          return function(event) {
            _this.autoJsx = !_this.autoJsx;
            if (_this.autoJsx) {
              return _this.eslintIndentOptions = _this.getIndentOptions();
            }
          };
        })(this)
      }));
      document.addEventListener('mousedown', this.onMouseDown);
      document.addEventListener('mouseup', this.onMouseUp);
      this.disposables.add(this.editor.onDidChangeCursorPosition((function(_this) {
        return function(event) {
          return _this.changedCursorPosition(event);
        };
      })(this)));
      this.handleOnDidStopChanging();
    }

    AutoIndent.prototype.destroy = function() {
      this.disposables.dispose();
      this.onDidStopChangingHandler.dispose();
      document.removeEventListener('mousedown', this.onMouseDown);
      return document.removeEventListener('mouseup', this.onMouseUp);
    };

    AutoIndent.prototype.changedCursorPosition = function(event) {
      var blankLineEndPos, bufferRow, columnToMoveTo, cursorPosition, cursorPositions, endPointOfJsx, j, len, previousRow, ref1, ref2, startPointOfJsx;
      if (!this.autoJsx) {
        return;
      }
      if (!this.mouseUp) {
        return;
      }
      if (event.oldBufferPosition.row === event.newBufferPosition.row) {
        return;
      }
      bufferRow = event.newBufferPosition.row;
      if (this.editor.hasMultipleCursors()) {
        cursorPositions = this.editor.getCursorBufferPositions();
        if (cursorPositions.length === this.multipleCursorTrigger) {
          this.multipleCursorTrigger = 1;
          bufferRow = 0;
          for (j = 0, len = cursorPositions.length; j < len; j++) {
            cursorPosition = cursorPositions[j];
            if (cursorPosition.row > bufferRow) {
              bufferRow = cursorPosition.row;
            }
          }
        } else {
          this.multipleCursorTrigger++;
          return;
        }
      } else {
        cursorPosition = event.newBufferPosition;
      }
      previousRow = event.oldBufferPosition.row;
      if (this.jsxInScope(previousRow)) {
        blankLineEndPos = (ref1 = /^\s*$/.exec(this.editor.lineTextForBufferRow(previousRow))) != null ? ref1[0].length : void 0;
        if (blankLineEndPos != null) {
          this.indentRow({
            row: previousRow,
            blockIndent: 0
          });
        }
      }
      if (!this.jsxInScope(bufferRow)) {
        return;
      }
      endPointOfJsx = new Point(bufferRow, 0);
      startPointOfJsx = autoCompleteJSX.getStartOfJSX(this.editor, cursorPosition);
      this.indentJSX(new Range(startPointOfJsx, endPointOfJsx));
      columnToMoveTo = (ref2 = /^\s*$/.exec(this.editor.lineTextForBufferRow(bufferRow))) != null ? ref2[0].length : void 0;
      if (columnToMoveTo != null) {
        return this.editor.setCursorBufferPosition([bufferRow, columnToMoveTo]);
      }
    };

    AutoIndent.prototype.didStopChanging = function() {
      var endPointOfJsx, highestRow, lowestRow, selectedRange, startPointOfJsx;
      if (!this.autoJsx) {
        return;
      }
      if (!this.mouseUp) {
        return;
      }
      selectedRange = this.editor.getSelectedBufferRange();
      if (selectedRange.start.row === selectedRange.end.row && selectedRange.start.column === selectedRange.end.column) {
        if (indexOf.call(this.editor.scopeDescriptorForBufferPosition([selectedRange.start.row, selectedRange.start.column]).getScopesArray(), 'JSXStartTagEnd') >= 0) {
          return;
        }
        if (indexOf.call(this.editor.scopeDescriptorForBufferPosition([selectedRange.start.row, selectedRange.start.column]).getScopesArray(), 'JSXEndTagStart') >= 0) {
          return;
        }
      }
      highestRow = Math.max(selectedRange.start.row, selectedRange.end.row);
      lowestRow = Math.min(selectedRange.start.row, selectedRange.end.row);
      this.onDidStopChangingHandler.dispose();
      while (highestRow >= lowestRow) {
        if (this.jsxInScope(highestRow)) {
          endPointOfJsx = new Point(highestRow, 0);
          startPointOfJsx = autoCompleteJSX.getStartOfJSX(this.editor, endPointOfJsx);
          this.indentJSX(new Range(startPointOfJsx, endPointOfJsx));
          highestRow = startPointOfJsx.row - 1;
        } else {
          highestRow = highestRow - 1;
        }
      }
      setTimeout(this.handleOnDidStopChanging, 300);
    };

    AutoIndent.prototype.handleOnDidStopChanging = function() {
      return this.onDidStopChangingHandler = this.editor.onDidStopChanging((function(_this) {
        return function() {
          return _this.didStopChanging();
        };
      })(this));
    };

    AutoIndent.prototype.jsxInScope = function(bufferRow) {
      var scopes;
      scopes = this.editor.scopeDescriptorForBufferPosition([bufferRow, 0]).getScopesArray();
      return indexOf.call(scopes, 'meta.tag.jsx') >= 0;
    };

    AutoIndent.prototype.indentJSX = function(range) {
      var blankLineEndPos, firstCharIndentation, firstTagInLineIndentation, idxOfToken, indent, indentRecalc, isFirstTagOfBlock, isFirstTokenOfLine, j, line, match, matchColumn, matchPointEnd, matchPointStart, matchRange, parentTokenIdx, ref1, ref2, ref3, results, row, stackOfTokensStillOpen, token, tokenIndentation, tokenOnThisLine, tokenStack;
      tokenStack = [];
      idxOfToken = 0;
      stackOfTokensStillOpen = [];
      indent = 0;
      isFirstTagOfBlock = true;
      this.JSXREGEXP.lastIndex = 0;
      this.templateDepth = 0;
      results = [];
      for (row = j = ref1 = range.start.row, ref2 = range.end.row; ref1 <= ref2 ? j <= ref2 : j >= ref2; row = ref1 <= ref2 ? ++j : --j) {
        isFirstTokenOfLine = true;
        tokenOnThisLine = false;
        indentRecalc = false;
        firstTagInLineIndentation = 0;
        line = this.editor.lineTextForBufferRow(row);
        while ((match = this.JSXREGEXP.exec(line)) !== null) {
          matchColumn = match.index;
          matchPointStart = new Point(row, matchColumn);
          matchPointEnd = new Point(row, matchColumn + match[0].length - 1);
          matchRange = new Range(matchPointStart, matchPointEnd);
          if (row === range.start.row && matchColumn < range.start.column) {
            continue;
          }
          if (!(token = this.getToken(row, match))) {
            continue;
          }
          firstCharIndentation = this.editor.indentationForBufferRow(row);
          if (this.editor.getSoftTabs()) {
            tokenIndentation = matchColumn / this.editor.getTabLength();
          } else {
            tokenIndentation = (function(editor) {
              var charsFound, hardTabsFound, i, k, ref3;
              this.editor = editor;
              hardTabsFound = charsFound = 0;
              for (i = k = 0, ref3 = matchColumn; 0 <= ref3 ? k < ref3 : k > ref3; i = 0 <= ref3 ? ++k : --k) {
                if ((line.substr(i, 1)) === '\t') {
                  hardTabsFound++;
                } else {
                  charsFound++;
                }
              }
              return hardTabsFound + (charsFound / this.editor.getTabLength());
            })(this.editor);
          }
          switch (token) {
            case JSXTAG_OPEN:
              tokenOnThisLine = true;
              if (isFirstTokenOfLine) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                if (isFirstTagOfBlock && (parentTokenIdx != null) && (tokenStack[parentTokenIdx].type === BRACE_OPEN || tokenStack[parentTokenIdx].type === JSXBRACE_OPEN)) {
                  firstTagInLineIndentation = tokenIndentation;
                  firstCharIndentation = this.eslintIndentOptions.jsxIndent[1] + tokenStack[parentTokenIdx].firstCharIndentation;
                  indentRecalc = this.indentRow({
                    row: row,
                    blockIndent: firstCharIndentation
                  });
                } else if (isFirstTagOfBlock && (parentTokenIdx != null)) {
                  indentRecalc = this.indentRow({
                    row: row,
                    blockIndent: this.getIndentOfPreviousRow(row),
                    jsxIndent: 1
                  });
                } else if ((parentTokenIdx != null) && this.ternaryTerminatesPreviousLine(row)) {
                  firstTagInLineIndentation = tokenIndentation;
                  firstCharIndentation = this.getIndentOfPreviousRow(row);
                  indentRecalc = this.indentRow({
                    row: row,
                    blockIndent: firstCharIndentation
                  });
                } else if (parentTokenIdx != null) {
                  indentRecalc = this.indentRow({
                    row: row,
                    blockIndent: tokenStack[parentTokenIdx].firstCharIndentation,
                    jsxIndent: 1
                  });
                }
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTokenOfLine = false;
              isFirstTagOfBlock = false;
              stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
              tokenStack.push({
                type: JSXTAG_OPEN,
                name: match[2],
                row: row,
                firstTagInLineIndentation: firstTagInLineIndentation,
                tokenIndentation: tokenIndentation,
                firstCharIndentation: firstCharIndentation,
                parentTokenIdx: parentTokenIdx,
                termsThisTagsAttributesIdx: null,
                termsThisTagIdx: null
              });
              stackOfTokensStillOpen.push(idxOfToken);
              idxOfToken++;
              break;
            case JSXTAG_CLOSE:
              tokenOnThisLine = true;
              if (isFirstTokenOfLine) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                indentRecalc = this.indentRow({
                  row: row,
                  blockIndent: tokenStack[parentTokenIdx].firstCharIndentation
                });
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTokenOfLine = false;
              isFirstTagOfBlock = false;
              parentTokenIdx = stackOfTokensStillOpen.pop();
              tokenStack.push({
                type: JSXTAG_CLOSE,
                name: match[5],
                row: row,
                parentTokenIdx: parentTokenIdx
              });
              if (parentTokenIdx >= 0) {
                tokenStack[parentTokenIdx].termsThisTagIdx = idxOfToken;
              }
              idxOfToken++;
              break;
            case JSXTAG_SELFCLOSE_END:
              tokenOnThisLine = true;
              if (isFirstTokenOfLine) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                indentRecalc = this.indentForClosingBracket(row, tokenStack[parentTokenIdx], this.eslintIndentOptions.jsxClosingBracketLocation[1].selfClosing);
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTagOfBlock = false;
              isFirstTokenOfLine = false;
              parentTokenIdx = stackOfTokensStillOpen.pop();
              tokenStack.push({
                type: JSXTAG_SELFCLOSE_END,
                name: tokenStack[parentTokenIdx].name,
                row: row,
                parentTokenIdx: parentTokenIdx
              });
              if (parentTokenIdx >= 0) {
                tokenStack[parentTokenIdx].termsThisTagsAttributesIdx = idxOfToken;
                tokenStack[parentTokenIdx].type = JSXTAG_SELFCLOSE_START;
                tokenStack[parentTokenIdx].termsThisTagIdx = idxOfToken;
              }
              idxOfToken++;
              break;
            case JSXTAG_CLOSE_ATTRS:
              tokenOnThisLine = true;
              if (isFirstTokenOfLine) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                indentRecalc = this.indentForClosingBracket(row, tokenStack[parentTokenIdx], this.eslintIndentOptions.jsxClosingBracketLocation[1].nonEmpty);
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTagOfBlock = false;
              isFirstTokenOfLine = false;
              stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
              tokenStack.push({
                type: JSXTAG_CLOSE_ATTRS,
                name: tokenStack[parentTokenIdx].name,
                row: row,
                parentTokenIdx: parentTokenIdx
              });
              if (parentTokenIdx >= 0) {
                tokenStack[parentTokenIdx].termsThisTagsAttributesIdx = idxOfToken;
              }
              idxOfToken++;
              break;
            case JSXBRACE_OPEN:
              tokenOnThisLine = true;
              if (isFirstTokenOfLine) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                if (parentTokenIdx != null) {
                  if (tokenStack[parentTokenIdx].type === JSXTAG_OPEN && tokenStack[parentTokenIdx].termsThisTagsAttributesIdx === null) {
                    indentRecalc = this.indentRow({
                      row: row,
                      blockIndent: tokenStack[parentTokenIdx].firstCharIndentation,
                      jsxIndentProps: 1
                    });
                  } else {
                    indentRecalc = this.indentRow({
                      row: row,
                      blockIndent: tokenStack[parentTokenIdx].firstCharIndentation,
                      jsxIndent: 1
                    });
                  }
                }
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTagOfBlock = true;
              isFirstTokenOfLine = false;
              stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
              tokenStack.push({
                type: token,
                name: '',
                row: row,
                firstTagInLineIndentation: firstTagInLineIndentation,
                tokenIndentation: tokenIndentation,
                firstCharIndentation: firstCharIndentation,
                parentTokenIdx: parentTokenIdx,
                termsThisTagsAttributesIdx: null,
                termsThisTagIdx: null
              });
              stackOfTokensStillOpen.push(idxOfToken);
              idxOfToken++;
              break;
            case TERNARY_IF:
              tokenOnThisLine = true;
              if (isFirstTokenOfLine) {
                if (firstCharIndentation === tokenIndentation) {
                  indentRecalc = this.indentRow({
                    row: row,
                    blockIndent: this.getIndentOfPreviousRow(row),
                    jsxIndent: 1
                  });
                } else {
                  stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                  if (parentTokenIdx != null) {
                    if (tokenStack[parentTokenIdx].type === JSXTAG_OPEN && tokenStack[parentTokenIdx].termsThisTagsAttributesIdx === null) {
                      indentRecalc = this.indentRow({
                        row: row,
                        blockIndent: tokenStack[parentTokenIdx].firstCharIndentation,
                        jsxIndentProps: 1
                      });
                    } else {
                      indentRecalc = this.indentRow({
                        row: row,
                        blockIndent: tokenStack[parentTokenIdx].firstCharIndentation,
                        jsxIndent: 1
                      });
                    }
                  }
                }
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTagOfBlock = true;
              isFirstTokenOfLine = false;
              stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
              tokenStack.push({
                type: token,
                name: '',
                row: row,
                firstTagInLineIndentation: firstTagInLineIndentation,
                tokenIndentation: tokenIndentation,
                firstCharIndentation: firstCharIndentation,
                parentTokenIdx: parentTokenIdx,
                termsThisTagsAttributesIdx: null,
                termsThisTagIdx: null
              });
              stackOfTokensStillOpen.push(idxOfToken);
              idxOfToken++;
              break;
            case JSXBRACE_CLOSE:
            case TERNARY_ELSE:
              tokenOnThisLine = true;
              if (isFirstTokenOfLine) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                indentRecalc = this.indentRow({
                  row: row,
                  blockIndent: tokenStack[parentTokenIdx].firstCharIndentation
                });
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTagOfBlock = false;
              isFirstTokenOfLine = false;
              parentTokenIdx = stackOfTokensStillOpen.pop();
              tokenStack.push({
                type: token,
                name: '',
                row: row,
                parentTokenIdx: parentTokenIdx
              });
              if (parentTokenIdx >= 0) {
                tokenStack[parentTokenIdx].termsThisTagIdx = idxOfToken;
              }
              idxOfToken++;
              break;
            case BRACE_OPEN:
            case SWITCH_BRACE_OPEN:
            case PAREN_OPEN:
            case TEMPLATE_START:
              tokenOnThisLine = true;
              if (token === TEMPLATE_START) {
                this.templateDepth++;
              }
              if (isFirstTokenOfLine) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                if (isFirstTagOfBlock && (parentTokenIdx != null) && tokenStack[parentTokenIdx].type === token && tokenStack[parentTokenIdx].row === (row - 1)) {
                  tokenIndentation = firstCharIndentation = this.eslintIndentOptions.jsxIndent[1] + this.getIndentOfPreviousRow(row);
                  indentRecalc = this.indentRow({
                    row: row,
                    blockIndent: firstCharIndentation
                  });
                } else if ((parentTokenIdx != null) && this.ternaryTerminatesPreviousLine(row)) {
                  firstTagInLineIndentation = tokenIndentation;
                  firstCharIndentation = this.getIndentOfPreviousRow(row);
                  indentRecalc = this.indentRow({
                    row: row,
                    blockIndent: firstCharIndentation
                  });
                } else if (parentTokenIdx != null) {
                  indentRecalc = this.indentRow({
                    row: row,
                    blockIndent: tokenStack[parentTokenIdx].firstCharIndentation,
                    jsxIndent: 1
                  });
                }
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTokenOfLine = false;
              stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
              tokenStack.push({
                type: token,
                name: '',
                row: row,
                firstTagInLineIndentation: firstTagInLineIndentation,
                tokenIndentation: tokenIndentation,
                firstCharIndentation: firstCharIndentation,
                parentTokenIdx: parentTokenIdx,
                termsThisTagsAttributesIdx: null,
                termsThisTagIdx: null
              });
              stackOfTokensStillOpen.push(idxOfToken);
              idxOfToken++;
              break;
            case BRACE_CLOSE:
            case SWITCH_BRACE_CLOSE:
            case PAREN_CLOSE:
            case TEMPLATE_END:
              if (token === SWITCH_BRACE_CLOSE) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                if (tokenStack[parentTokenIdx].type === SWITCH_CASE || tokenStack[parentTokenIdx].type === SWITCH_DEFAULT) {
                  stackOfTokensStillOpen.pop();
                }
              }
              tokenOnThisLine = true;
              if (isFirstTokenOfLine) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                if (parentTokenIdx != null) {
                  indentRecalc = this.indentRow({
                    row: row,
                    blockIndent: tokenStack[parentTokenIdx].firstCharIndentation
                  });
                }
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTokenOfLine = false;
              parentTokenIdx = stackOfTokensStillOpen.pop();
              if (parentTokenIdx != null) {
                tokenStack.push({
                  type: token,
                  name: '',
                  row: row,
                  parentTokenIdx: parentTokenIdx
                });
                if (parentTokenIdx >= 0) {
                  tokenStack[parentTokenIdx].termsThisTagIdx = idxOfToken;
                }
                idxOfToken++;
              }
              if (token === TEMPLATE_END) {
                this.templateDepth--;
              }
              break;
            case SWITCH_CASE:
            case SWITCH_DEFAULT:
              tokenOnThisLine = true;
              isFirstTagOfBlock = true;
              if (isFirstTokenOfLine) {
                stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
                if (parentTokenIdx != null) {
                  if (tokenStack[parentTokenIdx].type === SWITCH_CASE || tokenStack[parentTokenIdx].type === SWITCH_DEFAULT) {
                    indentRecalc = this.indentRow({
                      row: row,
                      blockIndent: tokenStack[parentTokenIdx].firstCharIndentation
                    });
                    stackOfTokensStillOpen.pop();
                  } else if (tokenStack[parentTokenIdx].type === SWITCH_BRACE_OPEN) {
                    indentRecalc = this.indentRow({
                      row: row,
                      blockIndent: tokenStack[parentTokenIdx].firstCharIndentation,
                      jsxIndent: 1
                    });
                  }
                }
              }
              if (indentRecalc) {
                line = this.editor.lineTextForBufferRow(row);
                this.JSXREGEXP.lastIndex = 0;
                continue;
              }
              isFirstTokenOfLine = false;
              stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
              tokenStack.push({
                type: token,
                name: '',
                row: row,
                firstTagInLineIndentation: firstTagInLineIndentation,
                tokenIndentation: tokenIndentation,
                firstCharIndentation: firstCharIndentation,
                parentTokenIdx: parentTokenIdx,
                termsThisTagsAttributesIdx: null,
                termsThisTagIdx: null
              });
              stackOfTokensStillOpen.push(idxOfToken);
              idxOfToken++;
              break;
            case JS_IF:
            case JS_ELSE:
            case JS_RETURN:
              isFirstTagOfBlock = true;
          }
        }
        if (idxOfToken && !tokenOnThisLine) {
          if (row !== range.end.row) {
            blankLineEndPos = (ref3 = /^\s*$/.exec(this.editor.lineTextForBufferRow(row))) != null ? ref3[0].length : void 0;
            if (blankLineEndPos != null) {
              results.push(this.indentRow({
                row: row,
                blockIndent: 0
              }));
            } else {
              results.push(this.indentUntokenisedLine(row, tokenStack, stackOfTokensStillOpen));
            }
          } else {
            results.push(this.indentUntokenisedLine(row, tokenStack, stackOfTokensStillOpen));
          }
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    AutoIndent.prototype.indentUntokenisedLine = function(row, tokenStack, stackOfTokensStillOpen) {
      var parentTokenIdx, token;
      stackOfTokensStillOpen.push(parentTokenIdx = stackOfTokensStillOpen.pop());
      if (parentTokenIdx == null) {
        return;
      }
      token = tokenStack[parentTokenIdx];
      switch (token.type) {
        case JSXTAG_OPEN:
        case JSXTAG_SELFCLOSE_START:
          if (token.termsThisTagsAttributesIdx === null) {
            return this.indentRow({
              row: row,
              blockIndent: token.firstCharIndentation,
              jsxIndentProps: 1
            });
          } else {
            return this.indentRow({
              row: row,
              blockIndent: token.firstCharIndentation,
              jsxIndent: 1
            });
          }
          break;
        case JSXBRACE_OPEN:
        case TERNARY_IF:
          return this.indentRow({
            row: row,
            blockIndent: token.firstCharIndentation,
            jsxIndent: 1,
            allowAdditionalIndents: true
          });
        case BRACE_OPEN:
        case SWITCH_BRACE_OPEN:
        case PAREN_OPEN:
          return this.indentRow({
            row: row,
            blockIndent: token.firstCharIndentation,
            jsxIndent: 1,
            allowAdditionalIndents: true
          });
        case JSXTAG_SELFCLOSE_END:
        case JSXBRACE_CLOSE:
        case JSXTAG_CLOSE_ATTRS:
        case TERNARY_ELSE:
          return this.indentRow({
            row: row,
            blockIndent: tokenStack[token.parentTokenIdx].firstCharIndentation,
            jsxIndentProps: 1
          });
        case BRACE_CLOSE:
        case SWITCH_BRACE_CLOSE:
        case PAREN_CLOSE:
          return this.indentRow({
            row: row,
            blockIndent: tokenStack[token.parentTokenIdx].firstCharIndentation,
            jsxIndent: 1,
            allowAdditionalIndents: true
          });
        case SWITCH_CASE:
        case SWITCH_DEFAULT:
          return this.indentRow({
            row: row,
            blockIndent: token.firstCharIndentation,
            jsxIndent: 1
          });
        case TEMPLATE_START:
        case TEMPLATE_END:
      }
    };

    AutoIndent.prototype.getToken = function(bufferRow, match) {
      var scope;
      scope = this.editor.scopeDescriptorForBufferPosition([bufferRow, match.index]).getScopesArray().pop();
      if ('punctuation.definition.tag.jsx' === scope) {
        if ((match[1] != null) || (match[20] != null)) {
          return JSXTAG_OPEN;
        } else if (match[3] != null) {
          return JSXTAG_SELFCLOSE_END;
        }
      } else if ('JSXEndTagStart' === scope) {
        if ((match[4] != null) || (match[22] != null)) {
          return JSXTAG_CLOSE;
        }
      } else if ('JSXStartTagEnd' === scope) {
        if ((match[7] != null) || (match[21] != null)) {
          return JSXTAG_CLOSE_ATTRS;
        }
      } else if (match[8] != null) {
        if ('punctuation.section.embedded.begin.jsx' === scope) {
          return JSXBRACE_OPEN;
        } else if ('meta.brace.curly.switchStart.js' === scope) {
          return SWITCH_BRACE_OPEN;
        } else if ('meta.brace.curly.js' === scope || 'meta.brace.curly.litobj.js' === scope) {
          return BRACE_OPEN;
        }
      } else if (match[9] != null) {
        if ('punctuation.section.embedded.end.jsx' === scope) {
          return JSXBRACE_CLOSE;
        } else if ('meta.brace.curly.switchEnd.js' === scope) {
          return SWITCH_BRACE_CLOSE;
        } else if ('meta.brace.curly.js' === scope || 'meta.brace.curly.litobj.js' === scope) {
          return BRACE_CLOSE;
        }
      } else if (match[10] != null) {
        if ('keyword.operator.ternary.js' === scope) {
          return TERNARY_IF;
        }
      } else if (match[11] != null) {
        if ('keyword.operator.ternary.js' === scope) {
          return TERNARY_ELSE;
        }
      } else if (match[12] != null) {
        if ('keyword.control.conditional.js' === scope) {
          return JS_IF;
        }
      } else if (match[13] != null) {
        if ('keyword.control.conditional.js' === scope) {
          return JS_ELSE;
        }
      } else if (match[14] != null) {
        if ('keyword.control.switch.js' === scope) {
          return SWITCH_CASE;
        }
      } else if (match[15] != null) {
        if ('keyword.control.switch.js' === scope) {
          return SWITCH_DEFAULT;
        }
      } else if (match[16] != null) {
        if ('keyword.control.flow.js' === scope) {
          return JS_RETURN;
        }
      } else if (match[17] != null) {
        if ('meta.brace.round.js' === scope || 'meta.brace.round.graphql' === scope || 'meta.brace.round.directive.graphql' === scope) {
          return PAREN_OPEN;
        }
      } else if (match[18] != null) {
        if ('meta.brace.round.js' === scope || 'meta.brace.round.graphql' === scope || 'meta.brace.round.directive.graphql' === scope) {
          return PAREN_CLOSE;
        }
      } else if (match[19] != null) {
        if ('punctuation.definition.quasi.begin.js' === scope) {
          return TEMPLATE_START;
        }
        if ('punctuation.definition.quasi.end.js' === scope) {
          return TEMPLATE_END;
        }
      }
      return NO_TOKEN;
    };

    AutoIndent.prototype.getIndentOfPreviousRow = function(row) {
      var j, line, ref1;
      if (!row) {
        return 0;
      }
      for (row = j = ref1 = row - 1; ref1 <= 0 ? j < 0 : j > 0; row = ref1 <= 0 ? ++j : --j) {
        line = this.editor.lineTextForBufferRow(row);
        if (/.*\S/.test(line)) {
          return this.editor.indentationForBufferRow(row);
        }
      }
      return 0;
    };

    AutoIndent.prototype.getIndentOptions = function() {
      var eslintrcFilename;
      if (!this.autoJsx) {
        return this.translateIndentOptions();
      }
      if (eslintrcFilename = this.getEslintrcFilename()) {
        eslintrcFilename = new File(eslintrcFilename);
        return this.translateIndentOptions(this.readEslintrcOptions(eslintrcFilename.getPath()));
      } else {
        return this.translateIndentOptions({});
      }
    };

    AutoIndent.prototype.getEslintrcFilename = function() {
      var projectContainingSource;
      projectContainingSource = atom.project.relativizePath(this.editor.getPath());
      if (projectContainingSource[0] != null) {
        return path.join(projectContainingSource[0], '.eslintrc');
      }
    };

    AutoIndent.prototype.onMouseDown = function() {
      return this.mouseUp = false;
    };

    AutoIndent.prototype.onMouseUp = function() {
      return this.mouseUp = true;
    };

    AutoIndent.prototype.readEslintrcOptions = function(eslintrcFile) {
      var YAML, err, eslintRules, fileContent, fs;
      fs = require('fs-plus');
      if (fs.isFileSync(eslintrcFile)) {
        fileContent = stripJsonComments(fs.readFileSync(eslintrcFile, 'utf8'));
        try {
          YAML = require('js-yaml');
          eslintRules = (YAML.safeLoad(fileContent)).rules;
          if (eslintRules) {
            return eslintRules;
          }
        } catch (error) {
          err = error;
          atom.notifications.addError("LB: Error reading .eslintrc at " + eslintrcFile, {
            dismissable: true,
            detail: "" + err.message
          });
        }
      }
      return {};
    };

    AutoIndent.prototype.translateIndentOptions = function(eslintRules) {
      var ES_DEFAULT_INDENT, defaultIndent, eslintIndentOptions, rule;
      eslintIndentOptions = {
        jsxIndent: [1, 1],
        jsxIndentProps: [1, 1],
        jsxClosingBracketLocation: [
          1, {
            selfClosing: TAGALIGNED,
            nonEmpty: TAGALIGNED
          }
        ]
      };
      if (typeof eslintRules !== "object") {
        return eslintIndentOptions;
      }
      ES_DEFAULT_INDENT = 4;
      rule = eslintRules['indent'];
      if (typeof rule === 'number' || typeof rule === 'string') {
        defaultIndent = ES_DEFAULT_INDENT / this.editor.getTabLength();
      } else if (typeof rule === 'object') {
        if (typeof rule[1] === 'number') {
          defaultIndent = rule[1] / this.editor.getTabLength();
        } else {
          defaultIndent = 1;
        }
      } else {
        defaultIndent = 1;
      }
      rule = eslintRules['react/jsx-indent'];
      if (typeof rule === 'number' || typeof rule === 'string') {
        eslintIndentOptions.jsxIndent[0] = rule;
        eslintIndentOptions.jsxIndent[1] = ES_DEFAULT_INDENT / this.editor.getTabLength();
      } else if (typeof rule === 'object') {
        eslintIndentOptions.jsxIndent[0] = rule[0];
        if (typeof rule[1] === 'number') {
          eslintIndentOptions.jsxIndent[1] = rule[1] / this.editor.getTabLength();
        } else {
          eslintIndentOptions.jsxIndent[1] = 1;
        }
      } else {
        eslintIndentOptions.jsxIndent[1] = defaultIndent;
      }
      rule = eslintRules['react/jsx-indent-props'];
      if (typeof rule === 'number' || typeof rule === 'string') {
        eslintIndentOptions.jsxIndentProps[0] = rule;
        eslintIndentOptions.jsxIndentProps[1] = ES_DEFAULT_INDENT / this.editor.getTabLength();
      } else if (typeof rule === 'object') {
        eslintIndentOptions.jsxIndentProps[0] = rule[0];
        if (typeof rule[1] === 'number') {
          eslintIndentOptions.jsxIndentProps[1] = rule[1] / this.editor.getTabLength();
        } else {
          eslintIndentOptions.jsxIndentProps[1] = 1;
        }
      } else {
        eslintIndentOptions.jsxIndentProps[1] = defaultIndent;
      }
      rule = eslintRules['react/jsx-closing-bracket-location'];
      if (typeof rule === 'number' || typeof rule === 'string') {
        eslintIndentOptions.jsxClosingBracketLocation[0] = rule;
      } else if (typeof rule === 'object') {
        eslintIndentOptions.jsxClosingBracketLocation[0] = rule[0];
        if (typeof rule[1] === 'string') {
          eslintIndentOptions.jsxClosingBracketLocation[1].selfClosing = eslintIndentOptions.jsxClosingBracketLocation[1].nonEmpty = rule[1];
        } else {
          if (rule[1].selfClosing != null) {
            eslintIndentOptions.jsxClosingBracketLocation[1].selfClosing = rule[1].selfClosing;
          }
          if (rule[1].nonEmpty != null) {
            eslintIndentOptions.jsxClosingBracketLocation[1].nonEmpty = rule[1].nonEmpty;
          }
        }
      }
      return eslintIndentOptions;
    };

    AutoIndent.prototype.ternaryTerminatesPreviousLine = function(row) {
      var line, match, scope;
      row--;
      if (!(row >= 0)) {
        return false;
      }
      line = this.editor.lineTextForBufferRow(row);
      match = /:\s*$/.exec(line);
      if (match === null) {
        return false;
      }
      scope = this.editor.scopeDescriptorForBufferPosition([row, match.index]).getScopesArray().pop();
      if (scope !== 'keyword.operator.ternary.js') {
        return false;
      }
      return true;
    };

    AutoIndent.prototype.indentForClosingBracket = function(row, parentTag, closingBracketRule) {
      if (this.eslintIndentOptions.jsxClosingBracketLocation[0]) {
        if (closingBracketRule === TAGALIGNED) {
          return this.indentRow({
            row: row,
            blockIndent: parentTag.tokenIndentation
          });
        } else if (closingBracketRule === LINEALIGNED) {
          return this.indentRow({
            row: row,
            blockIndent: parentTag.firstCharIndentation
          });
        } else if (closingBracketRule === AFTERPROPS) {
          if (this.eslintIndentOptions.jsxIndentProps[0]) {
            return this.indentRow({
              row: row,
              blockIndent: parentTag.firstCharIndentation,
              jsxIndentProps: 1
            });
          } else {
            return this.indentRow({
              row: row,
              blockIndent: parentTag.firstCharIndentation
            });
          }
        } else if (closingBracketRule === PROPSALIGNED) {
          if (this.eslintIndentOptions.jsxIndentProps[0]) {
            return this.indentRow({
              row: row,
              blockIndent: parentTag.tokenIndentation,
              jsxIndentProps: 1
            });
          } else {
            return this.indentRow({
              row: row,
              blockIndent: parentTag.tokenIndentation
            });
          }
        }
      }
    };

    AutoIndent.prototype.indentRow = function(options) {
      var allowAdditionalIndents, blockIndent, jsxIndent, jsxIndentProps, row;
      row = options.row, allowAdditionalIndents = options.allowAdditionalIndents, blockIndent = options.blockIndent, jsxIndent = options.jsxIndent, jsxIndentProps = options.jsxIndentProps;
      if (this.templateDepth > 0) {
        return false;
      }
      if (jsxIndent) {
        if (this.eslintIndentOptions.jsxIndent[0]) {
          if (this.eslintIndentOptions.jsxIndent[1]) {
            blockIndent += jsxIndent * this.eslintIndentOptions.jsxIndent[1];
          }
        }
      }
      if (jsxIndentProps) {
        if (this.eslintIndentOptions.jsxIndentProps[0]) {
          if (this.eslintIndentOptions.jsxIndentProps[1]) {
            blockIndent += jsxIndentProps * this.eslintIndentOptions.jsxIndentProps[1];
          }
        }
      }
      if (allowAdditionalIndents) {
        if (this.editor.indentationForBufferRow(row) < blockIndent || this.editor.indentationForBufferRow(row) > blockIndent + allowAdditionalIndents) {
          this.editor.setIndentationForBufferRow(row, blockIndent, {
            preserveLeadingWhitespace: false
          });
          return true;
        }
      } else {
        if (this.editor.indentationForBufferRow(row) !== blockIndent) {
          this.editor.setIndentationForBufferRow(row, blockIndent, {
            preserveLeadingWhitespace: false
          });
          return true;
        }
      }
      return false;
    };

    return AutoIndent;

  })();

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvbGFuZ3VhZ2UtYmFiZWwvbGliL2F1dG8taW5kZW50LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLE1BQUEsbWZBQUE7SUFBQTs7O0VBQUEsTUFBNEMsT0FBQSxDQUFRLE1BQVIsQ0FBNUMsRUFBQyw2Q0FBRCxFQUFzQixlQUF0QixFQUE0QixpQkFBNUIsRUFBbUM7O0VBQ25DLElBQUEsR0FBTyxPQUFBLENBQVEsTUFBUjs7RUFDUCxlQUFBLEdBQWtCLE9BQUEsQ0FBUSxxQkFBUjs7RUFDbEIsYUFBQSxHQUFnQixPQUFBLENBQVEsbUJBQVI7O0VBQ2hCLGlCQUFBLEdBQW9CLE9BQUEsQ0FBUSxxQkFBUjs7RUFHcEIsUUFBQSxHQUEwQjs7RUFDMUIsc0JBQUEsR0FBMEI7O0VBQzFCLG9CQUFBLEdBQTBCOztFQUMxQixXQUFBLEdBQTBCOztFQUMxQixrQkFBQSxHQUEwQjs7RUFDMUIsWUFBQSxHQUEwQjs7RUFDMUIsYUFBQSxHQUEwQjs7RUFDMUIsY0FBQSxHQUEwQjs7RUFDMUIsVUFBQSxHQUEwQjs7RUFDMUIsV0FBQSxHQUEwQjs7RUFDMUIsVUFBQSxHQUEwQjs7RUFDMUIsWUFBQSxHQUEwQjs7RUFDMUIsS0FBQSxHQUEwQjs7RUFDMUIsT0FBQSxHQUEwQjs7RUFDMUIsaUJBQUEsR0FBMEI7O0VBQzFCLGtCQUFBLEdBQTBCOztFQUMxQixXQUFBLEdBQTBCOztFQUMxQixjQUFBLEdBQTBCOztFQUMxQixTQUFBLEdBQTBCOztFQUMxQixVQUFBLEdBQTBCOztFQUMxQixXQUFBLEdBQTBCOztFQUMxQixjQUFBLEdBQTBCOztFQUMxQixZQUFBLEdBQTBCOztFQUcxQixVQUFBLEdBQWdCOztFQUNoQixXQUFBLEdBQWdCOztFQUNoQixVQUFBLEdBQWdCOztFQUNoQixZQUFBLEdBQWdCOztFQUVoQixNQUFNLENBQUMsT0FBUCxHQUNNO0lB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Q0FBQyx1QkFBUixDQUFnQyxHQUFoQyxDQUFBLEtBQTBDLFdBQTdDO1VBQ0UsSUFBQyxDQUFBLE1BQU0sQ0FBQywwQkFBUixDQUFtQyxHQUFuQyxFQUF3QyxXQUF4QyxFQUFxRDtZQUFFLHlCQUFBLEVBQTJCLEtBQTdCO1dBQXJEO0FBQ0EsaUJBQU8sS0FGVDtTQU5GOztBQVNBLGFBQU87SUF4QkU7Ozs7O0FBcjBCYiIsInNvdXJjZXNDb250ZW50IjpbIntDb21wb3NpdGVEaXNwb3NhYmxlLCBGaWxlLCBSYW5nZSwgUG9pbnR9ID0gcmVxdWlyZSAnYXRvbSdcbnBhdGggPSByZXF1aXJlICdwYXRoJ1xuYXV0b0NvbXBsZXRlSlNYID0gcmVxdWlyZSAnLi9hdXRvLWNvbXBsZXRlLWpzeCdcbkRpZEluc2VydFRleHQgPSByZXF1aXJlICcuL2RpZC1pbnNlcnQtdGV4dCdcbnN0cmlwSnNvbkNvbW1lbnRzID0gcmVxdWlyZSAnc3RyaXAtanNvbi1jb21tZW50cydcblxuXG5OT19UT0tFTiAgICAgICAgICAgICAgICA9IDBcbkpTWFRBR19TRUxGQ0xPU0VfU1RBUlQgID0gMSAgICAgICAjIHRoZSA8dGFnIGluIDx0YWcgLz5cbkpTWFRBR19TRUxGQ0xPU0VfRU5EICAgID0gMiAgICAgICAjIHRoZSAvPiBpbiA8dGFnIC8+XG5KU1hUQUdfT1BFTiAgICAgICAgICAgICA9IDMgICAgICAgIyB0aGUgPHRhZyBpbiA8dGFnPjwvdGFnPlxuSlNYVEFHX0NMT1NFX0FUVFJTICAgICAgPSA0ICAgICAgICMgdGhlIDFzdCA+IGluIDx0YWc+PC90YWc+XG5KU1hUQUdfQ0xPU0UgICAgICAgICAgICA9IDUgICAgICAgIyBhIDwvdGFnPlxuSlNYQlJBQ0VfT1BFTiAgICAgICAgICAgPSA2ICAgICAgICMgZW1iZWRkZWQgZXhwcmVzc2lvbiBicmFjZSBzdGFydCB7XG5KU1hCUkFDRV9DTE9TRSAgICAgICAgICA9IDcgICAgICAgIyBlbWJlZGRlZCBleHByZXNzaW9uIGJyYWNlIGVuZCB9XG5CUkFDRV9PUEVOICAgICAgICAgICAgICA9IDggICAgICAgIyBKYXZhc2NyaXB0IGJyYWNlXG5CUkFDRV9DTE9TRSAgICAgICAgICAgICA9IDkgICAgICAgIyBKYXZhc2NyaXB0IGJyYWNlXG5URVJOQVJZX0lGICAgICAgICAgICAgICA9IDEwICAgICAgIyBUZXJuYXJ5ID9cblRFUk5BUllfRUxTRSAgICAgICAgICAgID0gMTEgICAgICAjIFRlcm5hcnkgOlxuSlNfSUYgICAgICAgICAgICAgICAgICAgPSAxMiAgICAgICMgSlMgSUZcbkpTX0VMU0UgICAgICAgICAgICAgICAgID0gMTMgICAgICAjIEpTIEVMU0VcblNXSVRDSF9CUkFDRV9PUEVOICAgICAgID0gMTQgICAgICAjIG9wZW5pbmcgYnJhY2UgaW4gc3dpdGNoIHsgfVxuU1dJVENIX0JSQUNFX0NMT1NFICAgICAgPSAxNSAgICAgICMgY2xvc2luZyBicmFjZSBpbiBzd2l0Y2ggeyB9XG5TV0lUQ0hfQ0FTRSAgICAgICAgICAgICA9IDE2ICAgICAgIyBzd2l0Y2ggY2FzZSBzdGF0ZW1lbnRcblNXSVRDSF9ERUZBVUxUICAgICAgICAgID0gMTcgICAgICAjIHN3aXRjaCBkZWZhdWx0IHN0YXRlbWVudFxuSlNfUkVUVVJOICAgICAgICAgICAgICAgPSAxOCAgICAgICMgSlMgcmV0dXJuXG5QQVJFTl9PUEVOICAgICAgICAgICAgICA9IDE5ICAgICAgIyBwYXJlbiBvcGVuIChcblBBUkVOX0NMT1NFICAgICAgICAgICAgID0gMjAgICAgICAjIHBhcmVuIGNsb3NlIClcblRFTVBMQVRFX1NUQVJUICAgICAgICAgID0gMjEgICAgICAjIGAgYmFjay10aWNrIHN0YXJ0XG5URU1QTEFURV9FTkQgICAgICAgICAgICA9IDIyICAgICAgIyBgIGJhY2stdGljayBlbmRcblxuIyBlc2xpbnQgcHJvcGVydHkgdmFsdWVzXG5UQUdBTElHTkVEICAgID0gJ3RhZy1hbGlnbmVkJ1xuTElORUFMSUdORUQgICA9ICdsaW5lLWFsaWduZWQnXG5BRlRFUlBST1BTICAgID0gJ2FmdGVyLXByb3BzJ1xuUFJPUFNBTElHTkVEICA9ICdwcm9wcy1hbGlnbmVkJ1xuXG5tb2R1bGUuZXhwb3J0cyA9XG5jbGFzcyBBdXRvSW5kZW50XG4gIGNvbnN0cnVjdG9yOiAoQGVkaXRvcikgLT5cbiAgICBARGlkSW5zZXJ0VGV4dCA9IG5ldyBEaWRJbnNlcnRUZXh0KEBlZGl0b3IpXG4gICAgQGF1dG9Kc3ggPSBhdG9tLmNvbmZpZy5nZXQoJ2xhbmd1YWdlLWJhYmVsJykuYXV0b0luZGVudEpTWFxuICAgICMgcmVnZXggdG8gc2VhcmNoIGZvciB0YWcgb3Blbi9jbG9zZSB0YWcgYW5kIGNsb3NlIHRhZ1xuICAgIEBKU1hSRUdFWFAgPSAvKDwpKFskX0EtWmEtel0oPzpbJF8uOlxcLUEtWmEtejAtOV0pKil8KFxcLz4pfCg8XFwvKShbJF9BLVphLXpdKD86WyQuXzpcXC1BLVphLXowLTldKSopKD4pfCg+KXwoeyl8KH0pfChcXD8pfCg6KXwoaWYpfChlbHNlKXwoY2FzZSl8KGRlZmF1bHQpfChyZXR1cm4pfChcXCgpfChcXCkpfChgKXwoPzooPClcXHMqKD4pKXwoPFxcLykoPikvZ1xuICAgIEBtb3VzZVVwID0gdHJ1ZVxuICAgIEBtdWx0aXBsZUN1cnNvclRyaWdnZXIgPSAxXG4gICAgQGRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuICAgIEBlc2xpbnRJbmRlbnRPcHRpb25zID0gQGdldEluZGVudE9wdGlvbnMoKVxuICAgIEB0ZW1wbGF0ZURlcHRoID0gMCAjIHRyYWNrIGRlcHRoIG9mIGFueSBlbWJlZGRlZCBiYWNrLXRpY2sgdGVtcGxhdGVzXG5cbiAgICAjIE9ic2VydmUgYXV0b0luZGVudEpTWCBmb3IgZXhpc3RpbmcgZWRpdG9yc1xuICAgIEBkaXNwb3NhYmxlcy5hZGQgYXRvbS5jb25maWcub2JzZXJ2ZSAnbGFuZ3VhZ2UtYmFiZWwuYXV0b0luZGVudEpTWCcsXG4gICAgICAodmFsdWUpID0+IEBhdXRvSnN4ID0gdmFsdWVcblxuICAgIEBkaXNwb3NhYmxlcy5hZGQgYXRvbS5jb21tYW5kcy5hZGQgJ2F0b20tdGV4dC1lZGl0b3InLFxuICAgICAgJ2xhbmd1YWdlLWJhYmVsOmF1dG8taW5kZW50LWpzeC1vbic6IChldmVudCkgPT5cbiAgICAgICAgQGF1dG9Kc3ggPSB0cnVlXG4gICAgICAgIEBlc2xpbnRJbmRlbnRPcHRpb25zID0gQGdldEluZGVudE9wdGlvbnMoKVxuXG4gICAgQGRpc3Bvc2FibGVzLmFkZCBhdG9tLmNvbW1hbmRzLmFkZCAnYXRvbS10ZXh0LWVkaXRvcicsXG4gICAgICAnbGFuZ3VhZ2UtYmFiZWw6YXV0by1pbmRlbnQtanN4LW9mZic6IChldmVudCkgPT4gIEBhdXRvSnN4ID0gZmFsc2VcblxuICAgIEBkaXNwb3NhYmxlcy5hZGQgYXRvbS5jb21tYW5kcy5hZGQgJ2F0b20tdGV4dC1lZGl0b3InLFxuICAgICAgJ2xhbmd1YWdlLWJhYmVsOnRvZ2dsZS1hdXRvLWluZGVudC1qc3gnOiAoZXZlbnQpID0+XG4gICAgICAgIEBhdXRvSnN4ID0gbm90IEBhdXRvSnN4XG4gICAgICAgIGlmIEBhdXRvSnN4IHRoZW4gQGVzbGludEluZGVudE9wdGlvbnMgPSBAZ2V0SW5kZW50T3B0aW9ucygpXG5cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyICdtb3VzZWRvd24nLCBAb25Nb3VzZURvd25cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyICdtb3VzZXVwJywgQG9uTW91c2VVcFxuXG4gICAgQGRpc3Bvc2FibGVzLmFkZCBAZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24gKGV2ZW50KSA9PiBAY2hhbmdlZEN1cnNvclBvc2l0aW9uKGV2ZW50KVxuICAgIEBoYW5kbGVPbkRpZFN0b3BDaGFuZ2luZygpXG5cbiAgZGVzdHJveTogKCkgLT5cbiAgICBAZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG4gICAgQG9uRGlkU3RvcENoYW5naW5nSGFuZGxlci5kaXNwb3NlKClcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyICdtb3VzZWRvd24nLCBAb25Nb3VzZURvd25cbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyICdtb3VzZXVwJywgQG9uTW91c2VVcFxuXG4gICMgY2hhbmdlZCBjdXJzb3IgcG9zaXRpb25cbiAgY2hhbmdlZEN1cnNvclBvc2l0aW9uOiAoZXZlbnQpID0+XG4gICAgcmV0dXJuIHVubGVzcyBAYXV0b0pzeFxuICAgIHJldHVybiB1bmxlc3MgQG1vdXNlVXBcbiAgICByZXR1cm4gdW5sZXNzIGV2ZW50Lm9sZEJ1ZmZlclBvc2l0aW9uLnJvdyBpc250IGV2ZW50Lm5ld0J1ZmZlclBvc2l0aW9uLnJvd1xuICAgIGJ1ZmZlclJvdyA9IGV2ZW50Lm5ld0J1ZmZlclBvc2l0aW9uLnJvd1xuICAgICMgaGFuZGxlIG11bHRpcGxlIGN1cnNvcnMuIG9ubHkgdHJpZ2dlciBpbmRlbnQgb24gb25lIGNoYW5nZSBldmVudFxuICAgICMgYW5kIHRoZW4gb25seSBhdCB0aGUgaGlnaGVzdCByb3dcbiAgICBpZiBAZWRpdG9yLmhhc011bHRpcGxlQ3Vyc29ycygpXG4gICAgICBjdXJzb3JQb3NpdGlvbnMgPSBAZWRpdG9yLmdldEN1cnNvckJ1ZmZlclBvc2l0aW9ucygpXG4gICAgICBpZiBjdXJzb3JQb3NpdGlvbnMubGVuZ3RoIGlzIEBtdWx0aXBsZUN1cnNvclRyaWdnZXJcbiAgICAgICAgQG11bHRpcGxlQ3Vyc29yVHJpZ2dlciA9IDFcbiAgICAgICAgYnVmZmVyUm93ID0gMFxuICAgICAgICBmb3IgY3Vyc29yUG9zaXRpb24gaW4gY3Vyc29yUG9zaXRpb25zXG4gICAgICAgICAgaWYgY3Vyc29yUG9zaXRpb24ucm93ID4gYnVmZmVyUm93IHRoZW4gYnVmZmVyUm93ID0gY3Vyc29yUG9zaXRpb24ucm93XG4gICAgICBlbHNlXG4gICAgICAgIEBtdWx0aXBsZUN1cnNvclRyaWdnZXIrK1xuICAgICAgICByZXR1cm5cbiAgICBlbHNlIGN1cnNvclBvc2l0aW9uID0gZXZlbnQubmV3QnVmZmVyUG9zaXRpb25cblxuICAgICMgcmVtb3ZlIGFueSBibGFuayBsaW5lcyBmcm9tIHdoZXJlIGN1cnNvciB3YXMgcHJldmlvdXNseVxuICAgIHByZXZpb3VzUm93ID0gZXZlbnQub2xkQnVmZmVyUG9zaXRpb24ucm93XG4gICAgaWYgQGpzeEluU2NvcGUocHJldmlvdXNSb3cpXG4gICAgICBibGFua0xpbmVFbmRQb3MgPSAvXlxccyokLy5leGVjKEBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cocHJldmlvdXNSb3cpKT9bMF0ubGVuZ3RoXG4gICAgICBpZiBibGFua0xpbmVFbmRQb3M/XG4gICAgICAgIEBpbmRlbnRSb3coe3JvdzogcHJldmlvdXNSb3cgLCBibG9ja0luZGVudDogMCB9KVxuXG4gICAgcmV0dXJuIGlmIG5vdCBAanN4SW5TY29wZSBidWZmZXJSb3dcblxuICAgIGVuZFBvaW50T2ZKc3ggPSBuZXcgUG9pbnQgYnVmZmVyUm93LDAgIyBuZXh0IHJvdyBzdGFydFxuICAgIHN0YXJ0UG9pbnRPZkpzeCA9ICBhdXRvQ29tcGxldGVKU1guZ2V0U3RhcnRPZkpTWCBAZWRpdG9yLCBjdXJzb3JQb3NpdGlvblxuICAgIEBpbmRlbnRKU1ggbmV3IFJhbmdlKHN0YXJ0UG9pbnRPZkpzeCwgZW5kUG9pbnRPZkpzeClcbiAgICBjb2x1bW5Ub01vdmVUbyA9IC9eXFxzKiQvLmV4ZWMoQGVkaXRvci5saW5lVGV4dEZvckJ1ZmZlclJvdyhidWZmZXJSb3cpKT9bMF0ubGVuZ3RoXG4gICAgaWYgY29sdW1uVG9Nb3ZlVG8/IHRoZW4gQGVkaXRvci5zZXRDdXJzb3JCdWZmZXJQb3NpdGlvbiBbYnVmZmVyUm93LCBjb2x1bW5Ub01vdmVUb11cblxuXG4gICMgQnVmZmVyIGhhcyBzdG9wcGVkIGNoYW5naW5nLiBJbmRlbnQgYXMgcmVxdWlyZWRcbiAgZGlkU3RvcENoYW5naW5nOiAoKSAtPlxuICAgIHJldHVybiB1bmxlc3MgQGF1dG9Kc3hcbiAgICByZXR1cm4gdW5sZXNzIEBtb3VzZVVwXG4gICAgc2VsZWN0ZWRSYW5nZSA9IEBlZGl0b3IuZ2V0U2VsZWN0ZWRCdWZmZXJSYW5nZSgpXG4gICAgIyBpZiB0aGlzIGlzIGEgdGFnIHN0YXJ0J3MgZW5kID4gb3IgPC8gdGhlbiBkb24ndCBhdXRvIGluZGVudFxuICAgICMgdGhpcyBpYSBmaXggdG8gYWxsb3cgZm9yIHRoZSBhdXRvIGNvbXBsZXRlIHRhZyB0aW1lIHRvIHBvcCB1cFxuICAgIGlmIHNlbGVjdGVkUmFuZ2Uuc3RhcnQucm93IGlzIHNlbGVjdGVkUmFuZ2UuZW5kLnJvdyBhbmRcbiAgICAgIHNlbGVjdGVkUmFuZ2Uuc3RhcnQuY29sdW1uIGlzIHNlbGVjdGVkUmFuZ2UuZW5kLmNvbHVtblxuICAgICAgICByZXR1cm4gaWYgJ0pTWFN0YXJ0VGFnRW5kJyBpbiBAZWRpdG9yLnNjb3BlRGVzY3JpcHRvckZvckJ1ZmZlclBvc2l0aW9uKFtzZWxlY3RlZFJhbmdlLnN0YXJ0LnJvdywgc2VsZWN0ZWRSYW5nZS5zdGFydC5jb2x1bW5dKS5nZXRTY29wZXNBcnJheSgpXG4gICAgICAgIHJldHVybiBpZiAnSlNYRW5kVGFnU3RhcnQnIGluIEBlZGl0b3Iuc2NvcGVEZXNjcmlwdG9yRm9yQnVmZmVyUG9zaXRpb24oW3NlbGVjdGVkUmFuZ2Uuc3RhcnQucm93LCBzZWxlY3RlZFJhbmdlLnN0YXJ0LmNvbHVtbl0pLmdldFNjb3Blc0FycmF5KClcblxuICAgIGhpZ2hlc3RSb3cgPSBNYXRoLm1heCBzZWxlY3RlZFJhbmdlLnN0YXJ0LnJvdywgc2VsZWN0ZWRSYW5nZS5lbmQucm93XG4gICAgbG93ZXN0Um93ID0gTWF0aC5taW4gc2VsZWN0ZWRSYW5nZS5zdGFydC5yb3csIHNlbGVjdGVkUmFuZ2UuZW5kLnJvd1xuXG4gICAgIyByZW1vdmUgdGhlIGhhbmRsZXIgZm9yIGRpZFN0b3BDaGFuZ2luZyB0byBhdm9pZCB0aGlzIGNoYW5nZSBjYXVzaW5nIGEgbmV3IGV2ZW50XG4gICAgQG9uRGlkU3RvcENoYW5naW5nSGFuZGxlci5kaXNwb3NlKClcblxuICAgICMgd29yayBiYWNrd2FyZHMgdGhyb3VnaCBidWZmZXIgcm93cyBpbmRlbnRpbmcgSlNYIGFzIG5lZWRlZFxuICAgIHdoaWxlICggaGlnaGVzdFJvdyA+PSBsb3dlc3RSb3cgKVxuICAgICAgaWYgQGpzeEluU2NvcGUoaGlnaGVzdFJvdylcbiAgICAgICAgZW5kUG9pbnRPZkpzeCA9IG5ldyBQb2ludCBoaWdoZXN0Um93LDBcbiAgICAgICAgc3RhcnRQb2ludE9mSnN4ID0gIGF1dG9Db21wbGV0ZUpTWC5nZXRTdGFydE9mSlNYIEBlZGl0b3IsIGVuZFBvaW50T2ZKc3hcbiAgICAgICAgQGluZGVudEpTWCBuZXcgUmFuZ2Uoc3RhcnRQb2ludE9mSnN4LCBlbmRQb2ludE9mSnN4KVxuICAgICAgICBoaWdoZXN0Um93ID0gc3RhcnRQb2ludE9mSnN4LnJvdyAtIDFcbiAgICAgIGVsc2UgaGlnaGVzdFJvdyA9IGhpZ2hlc3RSb3cgLSAxXG5cbiAgICAjIHJlbmFibGUgdGhpcyBldmVudCBoYW5kbGVyIGFmdGVyIDMwMG1zIGFzIHBlciB0aGUgZGVmYXVsdCB0aW1lb3V0IGZvciBjaGFuZ2UgZXZlbnRzXG4gICAgIyB0byBhdm9pZCB0aGlzIG1ldGhvZCBiZWluZyByZWNhbGxlZCFcbiAgICBzZXRUaW1lb3V0KEBoYW5kbGVPbkRpZFN0b3BDaGFuZ2luZywgMzAwKVxuICAgIHJldHVyblxuXG4gIGhhbmRsZU9uRGlkU3RvcENoYW5naW5nOiA9PlxuICAgIEBvbkRpZFN0b3BDaGFuZ2luZ0hhbmRsZXIgPSBAZWRpdG9yLm9uRGlkU3RvcENoYW5naW5nICgpID0+IEBkaWRTdG9wQ2hhbmdpbmcoKVxuXG4gICMgaXMgdGhlIGpzeCBvbiB0aGlzIGxpbmUgaW4gc2NvcGVcbiAganN4SW5TY29wZTogKGJ1ZmZlclJvdykgLT5cbiAgICBzY29wZXMgPSBAZWRpdG9yLnNjb3BlRGVzY3JpcHRvckZvckJ1ZmZlclBvc2l0aW9uKFtidWZmZXJSb3csIDBdKS5nZXRTY29wZXNBcnJheSgpXG4gICAgcmV0dXJuICdtZXRhLnRhZy5qc3gnIGluIHNjb3Blc1xuXG4gICMgaW5kZW50IHRoZSBKU1ggaW4gdGhlICdyYW5nZScgb2Ygcm93c1xuICAjIFRoaXMgaXMgZGVzaWduZWQgdG8gYmUgYSBzaW5nbGUgcGFyc2UgaW5kZW50ZXIgdG8gcmVkdWNlIHRoZSBpbXBhY3Qgb24gdGhlIGVkaXRvci5cbiAgIyBJdCBhc3N1bWVzIHRoZSBncmFtbWFyIGhhcyBkb25lIGl0cyBqb2IgYWRkaW5nIHNjb3BlcyB0byBpbnRlcmVzdGluZyB0b2tlbnMuXG4gICMgVGhvc2UgYXJlIEpTWCA8dGFnLCA+LCA8L3RhZywgLz4sIGVtZWRkZWQgZXhwcmVzc2lvbnNcbiAgIyBvdXRzaWRlIHRoZSB0YWcgc3RhcnRpbmcgeyBhbmQgZW5kaW5nIH0gYW5kIGphdmFzY3JpcHQgYnJhY2VzIG91dHNpZGUgYSB0YWcgeyAmIH1cbiAgIyBpdCB1c2VzIGFuIGFycmF5IHRvIGhvbGQgdG9rZW5zIGFuZCBhIHB1c2gvcG9wIHN0YWNrIHRvIGhvbGQgdG9rZW5zIG5vdCBjbG9zZWRcbiAgIyB0aGUgdmVyeSBmaXJzdCBqc3ggdGFnIG11c3QgYmUgY29ycmV0bHkgaW5kZXRlZCBieSB0aGUgdXNlciBhcyB3ZSBkb24ndCBoYXZlXG4gICMga25vd2xlZGdlIG9mIHByZWNlZWRpbmcgSmF2YXNjcmlwdC5cbiAgaW5kZW50SlNYOiAocmFuZ2UpIC0+XG4gICAgdG9rZW5TdGFjayA9IFtdXG4gICAgaWR4T2ZUb2tlbiA9IDBcbiAgICBzdGFja09mVG9rZW5zU3RpbGxPcGVuID0gW10gIyBsZW5ndGggZXF1aXZhbGVudCB0byB0b2tlbiBkZXB0aFxuICAgIGluZGVudCA9ICAwXG4gICAgaXNGaXJzdFRhZ09mQmxvY2sgPSB0cnVlXG4gICAgQEpTWFJFR0VYUC5sYXN0SW5kZXggPSAwXG4gICAgQHRlbXBsYXRlRGVwdGggPSAwXG5cbiAgICBmb3Igcm93IGluIFtyYW5nZS5zdGFydC5yb3cuLnJhbmdlLmVuZC5yb3ddXG4gICAgICBpc0ZpcnN0VG9rZW5PZkxpbmUgPSB0cnVlXG4gICAgICB0b2tlbk9uVGhpc0xpbmUgPSBmYWxzZVxuICAgICAgaW5kZW50UmVjYWxjID0gZmFsc2VcbiAgICAgIGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb24gPSAgMFxuICAgICAgbGluZSA9IEBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cgcm93XG5cbiAgICAgICMgbG9vayBmb3IgdG9rZW5zIGluIGEgYnVmZmVyIGxpbmVcbiAgICAgIHdoaWxlICgoIG1hdGNoID0gQEpTWFJFR0VYUC5leGVjKGxpbmUpKSBpc250IG51bGwgKVxuICAgICAgICBtYXRjaENvbHVtbiA9IG1hdGNoLmluZGV4XG4gICAgICAgIG1hdGNoUG9pbnRTdGFydCA9IG5ldyBQb2ludChyb3csIG1hdGNoQ29sdW1uKVxuICAgICAgICBtYXRjaFBvaW50RW5kID0gbmV3IFBvaW50KHJvdywgbWF0Y2hDb2x1bW4gKyBtYXRjaFswXS5sZW5ndGggLSAxKVxuICAgICAgICBtYXRjaFJhbmdlID0gbmV3IFJhbmdlKG1hdGNoUG9pbnRTdGFydCwgbWF0Y2hQb2ludEVuZClcblxuICAgICAgICBpZiByb3cgaXMgcmFuZ2Uuc3RhcnQucm93IGFuZCBtYXRjaENvbHVtbiA8IHJhbmdlLnN0YXJ0LmNvbHVtbiB0aGVuIGNvbnRpbnVlXG4gICAgICAgIGlmIG5vdCB0b2tlbiA9ICBAZ2V0VG9rZW4ocm93LCBtYXRjaCkgdGhlbiBjb250aW51ZVxuXG4gICAgICAgIGZpcnN0Q2hhckluZGVudGF0aW9uID0gKEBlZGl0b3IuaW5kZW50YXRpb25Gb3JCdWZmZXJSb3cgcm93KVxuICAgICAgICAjIGNvbnZlcnQgdGhlIG1hdGNoZWQgY29sdW1uIHBvc2l0aW9uIGludG8gdGFiIGluZGVudHNcbiAgICAgICAgaWYgQGVkaXRvci5nZXRTb2Z0VGFicygpXG4gICAgICAgICAgdG9rZW5JbmRlbnRhdGlvbiA9IChtYXRjaENvbHVtbiAvIEBlZGl0b3IuZ2V0VGFiTGVuZ3RoKCkpXG4gICAgICAgIGVsc2UgdG9rZW5JbmRlbnRhdGlvbiA9XG4gICAgICAgICAgZG8gKEBlZGl0b3IpIC0+XG4gICAgICAgICAgICBoYXJkVGFic0ZvdW5kID0gY2hhcnNGb3VuZCA9IDBcbiAgICAgICAgICAgIGZvciBpIGluIFswLi4ubWF0Y2hDb2x1bW5dXG4gICAgICAgICAgICAgIGlmICgobGluZS5zdWJzdHIgaSwgMSkgaXMgJ1xcdCcpXG4gICAgICAgICAgICAgICAgaGFyZFRhYnNGb3VuZCsrXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBjaGFyc0ZvdW5kKytcbiAgICAgICAgICAgIHJldHVybiBoYXJkVGFic0ZvdW5kICsgKCBjaGFyc0ZvdW5kIC8gQGVkaXRvci5nZXRUYWJMZW5ndGgoKSApXG5cbiAgICAgICAgIyBiaWcgc3dpdGNoIHN0YXRlbWVudCBmb2xsb3dzIGZvciBlYWNoIHRva2VuLiBJZiB0aGUgbGluZSBpcyByZWZvcm1hdGVkXG4gICAgICAgICMgdGhlbiB3ZSByZWNhbGN1bGF0ZSB0aGUgbmV3IHBvc2l0aW9uLlxuICAgICAgICAjIGJpdCBob3JyaWQgYnV0IGhvcGVmdWxseSBmYXN0LlxuICAgICAgICBzd2l0Y2ggKHRva2VuKVxuICAgICAgICAgICMgdGFncyBzdGFydGluZyA8dGFnXG4gICAgICAgICAgd2hlbiBKU1hUQUdfT1BFTlxuICAgICAgICAgICAgdG9rZW5PblRoaXNMaW5lID0gdHJ1ZVxuICAgICAgICAgICAgIyBpbmRlbnQgb25seSBvbiBmaXJzdCB0b2tlbiBvZiBhIGxpbmVcbiAgICAgICAgICAgIGlmIGlzRmlyc3RUb2tlbk9mTGluZVxuICAgICAgICAgICAgICBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnB1c2ggcGFyZW50VG9rZW5JZHggPSBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnBvcCgpXG4gICAgICAgICAgICAgICMgaXNGaXJzdFRhZ09mQmxvY2sgaXMgdXNlZCB0byBtYXJrIHRoZSB0YWcgdGhhdCBzdGFydHMgdGhlIEpTWCBidXRcbiAgICAgICAgICAgICAgIyBhbHNvIHRoZSBmaXJzdCB0YWcgb2YgYmxvY2tzIGluc2lkZSAgZW1iZWRkZWQgZXhwcmVzc2lvbnMuIGUuZy5cbiAgICAgICAgICAgICAgIyA8dGJvZHk+LCA8cENvbXA+IGFuZCA8b2JqZWN0Um93PiBhcmUgZmlyc3QgdGFnc1xuICAgICAgICAgICAgICAjIHJldHVybiAoXG4gICAgICAgICAgICAgICMgICAgICAgPHRib2R5IGNvbXA9ezxwQ29tcCBwcm9wZXJ0eSAvPn0+XG4gICAgICAgICAgICAgICMgICAgICAgICB7b2JqZWN0cy5tYXAoZnVuY3Rpb24ob2JqZWN0LCBpKXtcbiAgICAgICAgICAgICAgIyAgICAgICAgICAgcmV0dXJuIDxPYmplY3RSb3cgb2JqPXtvYmplY3R9IGtleT17aX0gLz47XG4gICAgICAgICAgICAgICMgICAgICAgICB9KX1cbiAgICAgICAgICAgICAgIyAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgICAjICAgICApXG4gICAgICAgICAgICAgICMgYnV0IHdlIGRvbid0IHBvc2l0aW9uIHRoZSA8dGJvZHk+IGFzIHdlIGhhdmUgbm8ga25vd2xlZGdlIG9mIHRoZSBwcmVjZWVkaW5nXG4gICAgICAgICAgICAgICMganMgc3ludGF4XG4gICAgICAgICAgICAgIGlmIGlzRmlyc3RUYWdPZkJsb2NrIGFuZFxuICAgICAgICAgICAgICAgICAgcGFyZW50VG9rZW5JZHg/IGFuZFxuICAgICAgICAgICAgICAgICAgKCB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS50eXBlIGlzIEJSQUNFX09QRU4gb3JcbiAgICAgICAgICAgICAgICAgIHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLnR5cGUgaXMgSlNYQlJBQ0VfT1BFTiApXG4gICAgICAgICAgICAgICAgICAgIGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb24gPSAgdG9rZW5JbmRlbnRhdGlvblxuICAgICAgICAgICAgICAgICAgICBmaXJzdENoYXJJbmRlbnRhdGlvbiA9XG4gICAgICAgICAgICAgICAgICAgICAgQGVzbGludEluZGVudE9wdGlvbnMuanN4SW5kZW50WzFdICsgdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0uZmlyc3RDaGFySW5kZW50YXRpb25cbiAgICAgICAgICAgICAgICAgICAgaW5kZW50UmVjYWxjID0gQGluZGVudFJvdyh7cm93OiByb3cgLCBibG9ja0luZGVudDogZmlyc3RDaGFySW5kZW50YXRpb24gfSlcbiAgICAgICAgICAgICAgZWxzZSBpZiBpc0ZpcnN0VGFnT2ZCbG9jayBhbmQgcGFyZW50VG9rZW5JZHg/XG4gICAgICAgICAgICAgICAgaW5kZW50UmVjYWxjID0gQGluZGVudFJvdyh7cm93OiByb3cgLCBibG9ja0luZGVudDogQGdldEluZGVudE9mUHJldmlvdXNSb3cocm93KSwganN4SW5kZW50OiAxfSlcbiAgICAgICAgICAgICAgZWxzZSBpZiBwYXJlbnRUb2tlbklkeD8gYW5kIEB0ZXJuYXJ5VGVybWluYXRlc1ByZXZpb3VzTGluZShyb3cpXG4gICAgICAgICAgICAgICAgZmlyc3RUYWdJbkxpbmVJbmRlbnRhdGlvbiA9ICB0b2tlbkluZGVudGF0aW9uXG4gICAgICAgICAgICAgICAgZmlyc3RDaGFySW5kZW50YXRpb24gPSBAZ2V0SW5kZW50T2ZQcmV2aW91c1Jvdyhyb3cpXG4gICAgICAgICAgICAgICAgaW5kZW50UmVjYWxjID0gQGluZGVudFJvdyh7cm93OiByb3cgLCBibG9ja0luZGVudDogZmlyc3RDaGFySW5kZW50YXRpb24gfSlcbiAgICAgICAgICAgICAgZWxzZSBpZiBwYXJlbnRUb2tlbklkeD9cbiAgICAgICAgICAgICAgICBpbmRlbnRSZWNhbGMgPSBAaW5kZW50Um93KHtyb3c6IHJvdyAsIGJsb2NrSW5kZW50OiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS5maXJzdENoYXJJbmRlbnRhdGlvbiwganN4SW5kZW50OiAxfSlcblxuICAgICAgICAgICAgIyByZS1wYXJzZSBsaW5lIGlmIGluZGVudCBkaWQgc29tZXRoaW5nIHRvIGl0XG4gICAgICAgICAgICBpZiBpbmRlbnRSZWNhbGNcbiAgICAgICAgICAgICAgbGluZSA9IEBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cgcm93XG4gICAgICAgICAgICAgIEBKU1hSRUdFWFAubGFzdEluZGV4ID0gMCAjZm9yY2UgcmVnZXggdG8gc3RhcnQgYWdhaW5cbiAgICAgICAgICAgICAgY29udGludWVcblxuICAgICAgICAgICAgaXNGaXJzdFRva2VuT2ZMaW5lID0gZmFsc2VcbiAgICAgICAgICAgIGlzRmlyc3RUYWdPZkJsb2NrID0gZmFsc2VcblxuICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wdXNoIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgdG9rZW5TdGFjay5wdXNoXG4gICAgICAgICAgICAgIHR5cGU6IEpTWFRBR19PUEVOXG4gICAgICAgICAgICAgIG5hbWU6IG1hdGNoWzJdXG4gICAgICAgICAgICAgIHJvdzogcm93XG4gICAgICAgICAgICAgIGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb246IGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb25cbiAgICAgICAgICAgICAgdG9rZW5JbmRlbnRhdGlvbjogdG9rZW5JbmRlbnRhdGlvblxuICAgICAgICAgICAgICBmaXJzdENoYXJJbmRlbnRhdGlvbjogZmlyc3RDaGFySW5kZW50YXRpb25cbiAgICAgICAgICAgICAgcGFyZW50VG9rZW5JZHg6IHBhcmVudFRva2VuSWR4XG4gICAgICAgICAgICAgIHRlcm1zVGhpc1RhZ3NBdHRyaWJ1dGVzSWR4OiBudWxsICAjIHB0ciB0byA+IHRhZ1xuICAgICAgICAgICAgICB0ZXJtc1RoaXNUYWdJZHg6IG51bGwgICAgICAgICAgICAgIyBwdHIgdG8gPC90YWc+XG5cbiAgICAgICAgICAgIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucHVzaCBpZHhPZlRva2VuXG4gICAgICAgICAgICBpZHhPZlRva2VuKytcblxuICAgICAgICAgICMgdGFncyBlbmRpbmcgPC90YWc+XG4gICAgICAgICAgd2hlbiBKU1hUQUdfQ0xPU0VcbiAgICAgICAgICAgIHRva2VuT25UaGlzTGluZSA9IHRydWVcbiAgICAgICAgICAgIGlmIGlzRmlyc3RUb2tlbk9mTGluZVxuICAgICAgICAgICAgICBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnB1c2ggcGFyZW50VG9rZW5JZHggPSBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnBvcCgpXG4gICAgICAgICAgICAgIGluZGVudFJlY2FsYyA9IEBpbmRlbnRSb3coe3Jvdzogcm93LCBibG9ja0luZGVudDogdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0uZmlyc3RDaGFySW5kZW50YXRpb24gfSApXG5cbiAgICAgICAgICAgICMgcmUtcGFyc2UgbGluZSBpZiBpbmRlbnQgZGlkIHNvbWV0aGluZyB0byBpdFxuICAgICAgICAgICAgaWYgaW5kZW50UmVjYWxjXG4gICAgICAgICAgICAgIGxpbmUgPSBAZWRpdG9yLmxpbmVUZXh0Rm9yQnVmZmVyUm93IHJvd1xuICAgICAgICAgICAgICBASlNYUkVHRVhQLmxhc3RJbmRleCA9IDAgI2ZvcmNlIHJlZ2V4IHRvIHN0YXJ0IGFnYWluXG4gICAgICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgICAgIGlzRmlyc3RUb2tlbk9mTGluZSA9IGZhbHNlXG4gICAgICAgICAgICBpc0ZpcnN0VGFnT2ZCbG9jayA9IGZhbHNlXG5cbiAgICAgICAgICAgIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgdG9rZW5TdGFjay5wdXNoXG4gICAgICAgICAgICAgIHR5cGU6IEpTWFRBR19DTE9TRVxuICAgICAgICAgICAgICBuYW1lOiBtYXRjaFs1XVxuICAgICAgICAgICAgICByb3c6IHJvd1xuICAgICAgICAgICAgICBwYXJlbnRUb2tlbklkeDogcGFyZW50VG9rZW5JZHggICAgICAgICAjIHB0ciB0byA8dGFnXG4gICAgICAgICAgICBpZiBwYXJlbnRUb2tlbklkeCA+PTAgdGhlbiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS50ZXJtc1RoaXNUYWdJZHggPSBpZHhPZlRva2VuXG4gICAgICAgICAgICBpZHhPZlRva2VuKytcblxuICAgICAgICAgICMgdGFncyBlbmRpbmcgLz5cbiAgICAgICAgICB3aGVuIEpTWFRBR19TRUxGQ0xPU0VfRU5EXG4gICAgICAgICAgICB0b2tlbk9uVGhpc0xpbmUgPSB0cnVlXG4gICAgICAgICAgICBpZiBpc0ZpcnN0VG9rZW5PZkxpbmVcbiAgICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wdXNoIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgICAjaWYgZmlyc3RUYWdJbkxpbmVJbmRlbnRhdGlvbiBpcyBmaXJzdENoYXJJbmRlbnRhdGlvblxuICAgICAgICAgICAgICBpbmRlbnRSZWNhbGMgPSBAaW5kZW50Rm9yQ2xvc2luZ0JyYWNrZXQgIHJvdyxcbiAgICAgICAgICAgICAgICB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XSxcbiAgICAgICAgICAgICAgICBAZXNsaW50SW5kZW50T3B0aW9ucy5qc3hDbG9zaW5nQnJhY2tldExvY2F0aW9uWzFdLnNlbGZDbG9zaW5nXG5cbiAgICAgICAgICAgICMgcmUtcGFyc2UgbGluZSBpZiBpbmRlbnQgZGlkIHNvbWV0aGluZyB0byBpdFxuICAgICAgICAgICAgaWYgaW5kZW50UmVjYWxjXG4gICAgICAgICAgICAgIGxpbmUgPSBAZWRpdG9yLmxpbmVUZXh0Rm9yQnVmZmVyUm93IHJvd1xuICAgICAgICAgICAgICBASlNYUkVHRVhQLmxhc3RJbmRleCA9IDAgI2ZvcmNlIHJlZ2V4IHRvIHN0YXJ0IGFnYWluXG4gICAgICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgICAgIGlzRmlyc3RUYWdPZkJsb2NrID0gZmFsc2VcbiAgICAgICAgICAgIGlzRmlyc3RUb2tlbk9mTGluZSA9IGZhbHNlXG5cbiAgICAgICAgICAgIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgdG9rZW5TdGFjay5wdXNoXG4gICAgICAgICAgICAgIHR5cGU6IEpTWFRBR19TRUxGQ0xPU0VfRU5EXG4gICAgICAgICAgICAgIG5hbWU6IHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLm5hbWVcbiAgICAgICAgICAgICAgcm93OiByb3dcbiAgICAgICAgICAgICAgcGFyZW50VG9rZW5JZHg6IHBhcmVudFRva2VuSWR4ICAgICAgICMgcHRyIHRvIDx0YWdcbiAgICAgICAgICAgIGlmIHBhcmVudFRva2VuSWR4ID49IDBcbiAgICAgICAgICAgICAgdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0udGVybXNUaGlzVGFnc0F0dHJpYnV0ZXNJZHggPSBpZHhPZlRva2VuXG4gICAgICAgICAgICAgIHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLnR5cGUgPSBKU1hUQUdfU0VMRkNMT1NFX1NUQVJUXG4gICAgICAgICAgICAgIHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLnRlcm1zVGhpc1RhZ0lkeCA9IGlkeE9mVG9rZW5cbiAgICAgICAgICAgIGlkeE9mVG9rZW4rK1xuXG4gICAgICAgICAgIyB0YWdzIGVuZGluZyA+XG4gICAgICAgICAgd2hlbiBKU1hUQUdfQ0xPU0VfQVRUUlNcbiAgICAgICAgICAgIHRva2VuT25UaGlzTGluZSA9IHRydWVcbiAgICAgICAgICAgIGlmIGlzRmlyc3RUb2tlbk9mTGluZVxuICAgICAgICAgICAgICBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnB1c2ggcGFyZW50VG9rZW5JZHggPSBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnBvcCgpXG4gICAgICAgICAgICAgICNpZiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS5maXJzdFRhZ0luTGluZUluZGVudGF0aW9uIGlzIGZpcnN0Q2hhckluZGVudGF0aW9uXG4gICAgICAgICAgICAgIGluZGVudFJlY2FsYyA9IEBpbmRlbnRGb3JDbG9zaW5nQnJhY2tldCAgcm93LFxuICAgICAgICAgICAgICAgIHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLFxuICAgICAgICAgICAgICAgIEBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeENsb3NpbmdCcmFja2V0TG9jYXRpb25bMV0ubm9uRW1wdHlcblxuICAgICAgICAgICAgIyByZS1wYXJzZSBsaW5lIGlmIGluZGVudCBkaWQgc29tZXRoaW5nIHRvIGl0XG4gICAgICAgICAgICBpZiBpbmRlbnRSZWNhbGNcbiAgICAgICAgICAgICAgbGluZSA9IEBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cgcm93XG4gICAgICAgICAgICAgIEBKU1hSRUdFWFAubGFzdEluZGV4ID0gMCAjZm9yY2UgcmVnZXggdG8gc3RhcnQgYWdhaW5cbiAgICAgICAgICAgICAgY29udGludWVcblxuICAgICAgICAgICAgaXNGaXJzdFRhZ09mQmxvY2sgPSBmYWxzZVxuICAgICAgICAgICAgaXNGaXJzdFRva2VuT2ZMaW5lID0gZmFsc2VcblxuICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wdXNoIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgdG9rZW5TdGFjay5wdXNoXG4gICAgICAgICAgICAgIHR5cGU6IEpTWFRBR19DTE9TRV9BVFRSU1xuICAgICAgICAgICAgICBuYW1lOiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS5uYW1lXG4gICAgICAgICAgICAgIHJvdzogcm93XG4gICAgICAgICAgICAgIHBhcmVudFRva2VuSWR4OiBwYXJlbnRUb2tlbklkeCAgICAgICAgICAgICMgcHRyIHRvIDx0YWdcbiAgICAgICAgICAgIGlmIHBhcmVudFRva2VuSWR4ID49IDAgdGhlbiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS50ZXJtc1RoaXNUYWdzQXR0cmlidXRlc0lkeCA9IGlkeE9mVG9rZW5cbiAgICAgICAgICAgIGlkeE9mVG9rZW4rK1xuXG4gICAgICAgICAgIyBlbWJlZGVkIGV4cHJlc3Npb24gc3RhcnQge1xuICAgICAgICAgIHdoZW4gSlNYQlJBQ0VfT1BFTlxuICAgICAgICAgICAgdG9rZW5PblRoaXNMaW5lID0gdHJ1ZVxuICAgICAgICAgICAgaWYgaXNGaXJzdFRva2VuT2ZMaW5lXG4gICAgICAgICAgICAgIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucHVzaCBwYXJlbnRUb2tlbklkeCA9IHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucG9wKClcbiAgICAgICAgICAgICAgaWYgcGFyZW50VG9rZW5JZHg/XG4gICAgICAgICAgICAgICAgaWYgdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0udHlwZSBpcyBKU1hUQUdfT1BFTiBhbmQgdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0udGVybXNUaGlzVGFnc0F0dHJpYnV0ZXNJZHggaXMgbnVsbFxuICAgICAgICAgICAgICAgICAgaW5kZW50UmVjYWxjID0gQGluZGVudFJvdyh7cm93OiByb3csIGJsb2NrSW5kZW50OiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS5maXJzdENoYXJJbmRlbnRhdGlvbiwganN4SW5kZW50UHJvcHM6IDF9KVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgIGluZGVudFJlY2FsYyA9IEBpbmRlbnRSb3coe3Jvdzogcm93LCBibG9ja0luZGVudDogdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0uZmlyc3RDaGFySW5kZW50YXRpb24sIGpzeEluZGVudDogMX0gKVxuXG4gICAgICAgICAgICAjIHJlLXBhcnNlIGxpbmUgaWYgaW5kZW50IGRpZCBzb21ldGhpbmcgdG8gaXRcbiAgICAgICAgICAgIGlmIGluZGVudFJlY2FsY1xuICAgICAgICAgICAgICBsaW5lID0gQGVkaXRvci5saW5lVGV4dEZvckJ1ZmZlclJvdyByb3dcbiAgICAgICAgICAgICAgQEpTWFJFR0VYUC5sYXN0SW5kZXggPSAwICNmb3JjZSByZWdleCB0byBzdGFydCBhZ2FpblxuICAgICAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgICAgICBpc0ZpcnN0VGFnT2ZCbG9jayA9IHRydWUgICMgdGhpcyBtYXkgYmUgdGhlIHN0YXJ0IG9mIGEgbmV3IEpTWCBibG9ja1xuICAgICAgICAgICAgaXNGaXJzdFRva2VuT2ZMaW5lID0gZmFsc2VcblxuICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wdXNoIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgdG9rZW5TdGFjay5wdXNoXG4gICAgICAgICAgICAgIHR5cGU6IHRva2VuXG4gICAgICAgICAgICAgIG5hbWU6ICcnXG4gICAgICAgICAgICAgIHJvdzogcm93XG4gICAgICAgICAgICAgIGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb246IGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb25cbiAgICAgICAgICAgICAgdG9rZW5JbmRlbnRhdGlvbjogdG9rZW5JbmRlbnRhdGlvblxuICAgICAgICAgICAgICBmaXJzdENoYXJJbmRlbnRhdGlvbjogZmlyc3RDaGFySW5kZW50YXRpb25cbiAgICAgICAgICAgICAgcGFyZW50VG9rZW5JZHg6IHBhcmVudFRva2VuSWR4XG4gICAgICAgICAgICAgIHRlcm1zVGhpc1RhZ3NBdHRyaWJ1dGVzSWR4OiBudWxsICAjIHB0ciB0byA+IHRhZ1xuICAgICAgICAgICAgICB0ZXJtc1RoaXNUYWdJZHg6IG51bGwgICAgICAgICAgICAgIyBwdHIgdG8gPC90YWc+XG5cbiAgICAgICAgICAgIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucHVzaCBpZHhPZlRva2VuXG4gICAgICAgICAgICBpZHhPZlRva2VuKytcblxuICAgICAgICAgICMgdGVybmFyeSBzdGFydFxuICAgICAgICAgIHdoZW4gVEVSTkFSWV9JRlxuICAgICAgICAgICAgdG9rZW5PblRoaXNMaW5lID0gdHJ1ZVxuICAgICAgICAgICAgaWYgaXNGaXJzdFRva2VuT2ZMaW5lXG4gICAgICAgICAgICAgICMgaXMgdGhpcyB0ZXJuYXJ5IHN0YXJ0aW5nIGEgbmV3IGxpbmVcbiAgICAgICAgICAgICAgaWYgZmlyc3RDaGFySW5kZW50YXRpb24gaXMgdG9rZW5JbmRlbnRhdGlvblxuICAgICAgICAgICAgICAgIGluZGVudFJlY2FsYyA9IEBpbmRlbnRSb3coe3Jvdzogcm93LCBibG9ja0luZGVudDogQGdldEluZGVudE9mUHJldmlvdXNSb3cocm93KSwganN4SW5kZW50OiAxfSlcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucHVzaCBwYXJlbnRUb2tlbklkeCA9IHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucG9wKClcbiAgICAgICAgICAgICAgICBpZiBwYXJlbnRUb2tlbklkeD9cbiAgICAgICAgICAgICAgICAgIGlmIHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLnR5cGUgaXMgSlNYVEFHX09QRU4gYW5kIHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLnRlcm1zVGhpc1RhZ3NBdHRyaWJ1dGVzSWR4IGlzIG51bGxcbiAgICAgICAgICAgICAgICAgICAgaW5kZW50UmVjYWxjID0gQGluZGVudFJvdyh7cm93OiByb3csIGJsb2NrSW5kZW50OiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS5maXJzdENoYXJJbmRlbnRhdGlvbiwganN4SW5kZW50UHJvcHM6IDF9KVxuICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBpbmRlbnRSZWNhbGMgPSBAaW5kZW50Um93KHtyb3c6IHJvdywgYmxvY2tJbmRlbnQ6IHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLmZpcnN0Q2hhckluZGVudGF0aW9uLCBqc3hJbmRlbnQ6IDF9IClcblxuXG4gICAgICAgICAgICAjIHJlLXBhcnNlIGxpbmUgaWYgaW5kZW50IGRpZCBzb21ldGhpbmcgdG8gaXRcbiAgICAgICAgICAgIGlmIGluZGVudFJlY2FsY1xuICAgICAgICAgICAgICBsaW5lID0gQGVkaXRvci5saW5lVGV4dEZvckJ1ZmZlclJvdyByb3dcbiAgICAgICAgICAgICAgQEpTWFJFR0VYUC5sYXN0SW5kZXggPSAwICNmb3JjZSByZWdleCB0byBzdGFydCBhZ2FpblxuICAgICAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgICAgICBpc0ZpcnN0VGFnT2ZCbG9jayA9IHRydWUgICMgdGhpcyBtYXkgYmUgdGhlIHN0YXJ0IG9mIGEgbmV3IEpTWCBibG9ja1xuICAgICAgICAgICAgaXNGaXJzdFRva2VuT2ZMaW5lID0gZmFsc2VcblxuICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wdXNoIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgdG9rZW5TdGFjay5wdXNoXG4gICAgICAgICAgICAgIHR5cGU6IHRva2VuXG4gICAgICAgICAgICAgIG5hbWU6ICcnXG4gICAgICAgICAgICAgIHJvdzogcm93XG4gICAgICAgICAgICAgIGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb246IGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb25cbiAgICAgICAgICAgICAgdG9rZW5JbmRlbnRhdGlvbjogdG9rZW5JbmRlbnRhdGlvblxuICAgICAgICAgICAgICBmaXJzdENoYXJJbmRlbnRhdGlvbjogZmlyc3RDaGFySW5kZW50YXRpb25cbiAgICAgICAgICAgICAgcGFyZW50VG9rZW5JZHg6IHBhcmVudFRva2VuSWR4XG4gICAgICAgICAgICAgIHRlcm1zVGhpc1RhZ3NBdHRyaWJ1dGVzSWR4OiBudWxsICAjIHB0ciB0byA+IHRhZ1xuICAgICAgICAgICAgICB0ZXJtc1RoaXNUYWdJZHg6IG51bGwgICAgICAgICAgICAgIyBwdHIgdG8gPC90YWc+XG5cbiAgICAgICAgICAgIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucHVzaCBpZHhPZlRva2VuXG4gICAgICAgICAgICBpZHhPZlRva2VuKytcblxuICAgICAgICAgICMgZW1iZWRlZCBleHByZXNzaW9uIGVuZCB9XG4gICAgICAgICAgd2hlbiBKU1hCUkFDRV9DTE9TRSwgVEVSTkFSWV9FTFNFXG4gICAgICAgICAgICB0b2tlbk9uVGhpc0xpbmUgPSB0cnVlXG5cbiAgICAgICAgICAgIGlmIGlzRmlyc3RUb2tlbk9mTGluZVxuICAgICAgICAgICAgICBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnB1c2ggcGFyZW50VG9rZW5JZHggPSBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnBvcCgpXG4gICAgICAgICAgICAgIGluZGVudFJlY2FsYyA9IEBpbmRlbnRSb3coe3Jvdzogcm93LCBibG9ja0luZGVudDogdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0uZmlyc3RDaGFySW5kZW50YXRpb24gfSlcblxuICAgICAgICAgICAgaWYgaW5kZW50UmVjYWxjXG4gICAgICAgICAgICAgIGxpbmUgPSBAZWRpdG9yLmxpbmVUZXh0Rm9yQnVmZmVyUm93IHJvd1xuICAgICAgICAgICAgICBASlNYUkVHRVhQLmxhc3RJbmRleCA9IDAgI2ZvcmNlIHJlZ2V4IHRvIHN0YXJ0IGFnYWluXG4gICAgICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgICAgIGlzRmlyc3RUYWdPZkJsb2NrID0gZmFsc2VcbiAgICAgICAgICAgIGlzRmlyc3RUb2tlbk9mTGluZSA9IGZhbHNlXG5cbiAgICAgICAgICAgIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgdG9rZW5TdGFjay5wdXNoXG4gICAgICAgICAgICAgIHR5cGU6IHRva2VuXG4gICAgICAgICAgICAgIG5hbWU6ICcnXG4gICAgICAgICAgICAgIHJvdzogcm93XG4gICAgICAgICAgICAgIHBhcmVudFRva2VuSWR4OiBwYXJlbnRUb2tlbklkeCAgICAgICAgICMgcHRyIHRvIG9wZW5pbmcgdG9rZW5cblxuICAgICAgICAgICAgaWYgcGFyZW50VG9rZW5JZHggPj0wIHRoZW4gdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0udGVybXNUaGlzVGFnSWR4ID0gaWR4T2ZUb2tlblxuICAgICAgICAgICAgaWR4T2ZUb2tlbisrXG5cbiAgICAgICAgICAjIEphdmFzY3JpcHQgYnJhY2UgU3RhcnQgeyBvciBzd2l0Y2ggYnJhY2Ugc3RhcnQgeyBvciBwYXJlbiAoIG9yIGJhY2stdGljayBgc3RhcnRcbiAgICAgICAgICB3aGVuIEJSQUNFX09QRU4sIFNXSVRDSF9CUkFDRV9PUEVOLCBQQVJFTl9PUEVOLCBURU1QTEFURV9TVEFSVFxuICAgICAgICAgICAgdG9rZW5PblRoaXNMaW5lID0gdHJ1ZVxuICAgICAgICAgICAgaWYgdG9rZW4gaXMgVEVNUExBVEVfU1RBUlQgdGhlbiBAdGVtcGxhdGVEZXB0aCsrXG4gICAgICAgICAgICBpZiBpc0ZpcnN0VG9rZW5PZkxpbmVcbiAgICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wdXNoIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgICBpZiBpc0ZpcnN0VGFnT2ZCbG9jayBhbmRcbiAgICAgICAgICAgICAgICAgIHBhcmVudFRva2VuSWR4PyBhbmRcbiAgICAgICAgICAgICAgICAgIHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLnR5cGUgaXMgdG9rZW4gYW5kXG4gICAgICAgICAgICAgICAgICB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS5yb3cgaXMgKCByb3cgLSAxKVxuICAgICAgICAgICAgICAgICAgICB0b2tlbkluZGVudGF0aW9uID0gZmlyc3RDaGFySW5kZW50YXRpb24gPVxuICAgICAgICAgICAgICAgICAgICAgIEBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeEluZGVudFsxXSArIEBnZXRJbmRlbnRPZlByZXZpb3VzUm93IHJvd1xuICAgICAgICAgICAgICAgICAgICBpbmRlbnRSZWNhbGMgPSBAaW5kZW50Um93KHtyb3c6IHJvdywgYmxvY2tJbmRlbnQ6IGZpcnN0Q2hhckluZGVudGF0aW9ufSlcbiAgICAgICAgICAgICAgZWxzZSBpZiBwYXJlbnRUb2tlbklkeD8gYW5kIEB0ZXJuYXJ5VGVybWluYXRlc1ByZXZpb3VzTGluZShyb3cpXG4gICAgICAgICAgICAgICAgZmlyc3RUYWdJbkxpbmVJbmRlbnRhdGlvbiA9ICB0b2tlbkluZGVudGF0aW9uXG4gICAgICAgICAgICAgICAgZmlyc3RDaGFySW5kZW50YXRpb24gPSBAZ2V0SW5kZW50T2ZQcmV2aW91c1Jvdyhyb3cpXG4gICAgICAgICAgICAgICAgaW5kZW50UmVjYWxjID0gQGluZGVudFJvdyh7cm93OiByb3cgLCBibG9ja0luZGVudDogZmlyc3RDaGFySW5kZW50YXRpb24gfSlcbiAgICAgICAgICAgICAgZWxzZSBpZiBwYXJlbnRUb2tlbklkeD9cbiAgICAgICAgICAgICAgICBpbmRlbnRSZWNhbGMgPSBAaW5kZW50Um93KHtyb3c6IHJvdywgYmxvY2tJbmRlbnQ6IHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLmZpcnN0Q2hhckluZGVudGF0aW9uLCBqc3hJbmRlbnQ6IDEgfSApXG5cbiAgICAgICAgICAgICMgcmUtcGFyc2UgbGluZSBpZiBpbmRlbnQgZGlkIHNvbWV0aGluZyB0byBpdFxuICAgICAgICAgICAgaWYgaW5kZW50UmVjYWxjXG4gICAgICAgICAgICAgIGxpbmUgPSBAZWRpdG9yLmxpbmVUZXh0Rm9yQnVmZmVyUm93IHJvd1xuICAgICAgICAgICAgICBASlNYUkVHRVhQLmxhc3RJbmRleCA9IDAgI2ZvcmNlIHJlZ2V4IHRvIHN0YXJ0IGFnYWluXG4gICAgICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgICAgIGlzRmlyc3RUb2tlbk9mTGluZSA9IGZhbHNlXG5cbiAgICAgICAgICAgIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucHVzaCBwYXJlbnRUb2tlbklkeCA9IHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucG9wKClcbiAgICAgICAgICAgIHRva2VuU3RhY2sucHVzaFxuICAgICAgICAgICAgICB0eXBlOiB0b2tlblxuICAgICAgICAgICAgICBuYW1lOiAnJ1xuICAgICAgICAgICAgICByb3c6IHJvd1xuICAgICAgICAgICAgICBmaXJzdFRhZ0luTGluZUluZGVudGF0aW9uOiBmaXJzdFRhZ0luTGluZUluZGVudGF0aW9uXG4gICAgICAgICAgICAgIHRva2VuSW5kZW50YXRpb246IHRva2VuSW5kZW50YXRpb25cbiAgICAgICAgICAgICAgZmlyc3RDaGFySW5kZW50YXRpb246IGZpcnN0Q2hhckluZGVudGF0aW9uXG4gICAgICAgICAgICAgIHBhcmVudFRva2VuSWR4OiBwYXJlbnRUb2tlbklkeFxuICAgICAgICAgICAgICB0ZXJtc1RoaXNUYWdzQXR0cmlidXRlc0lkeDogbnVsbCAgIyBwdHIgdG8gPiB0YWdcbiAgICAgICAgICAgICAgdGVybXNUaGlzVGFnSWR4OiBudWxsICAgICAgICAgICAgICMgcHRyIHRvIDwvdGFnPlxuXG4gICAgICAgICAgICBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnB1c2ggaWR4T2ZUb2tlblxuICAgICAgICAgICAgaWR4T2ZUb2tlbisrXG5cbiAgICAgICAgICAjIEphdmFzY3JpcHQgYnJhY2UgRW5kIH0gb3Igc3dpdGNoIGJyYWNlIGVuZCB9IG9yIHBhcmVuIGNsb3NlICkgb3IgYmFjay10aWNrIGAgZW5kXG4gICAgICAgICAgd2hlbiBCUkFDRV9DTE9TRSwgU1dJVENIX0JSQUNFX0NMT1NFLCBQQVJFTl9DTE9TRSwgVEVNUExBVEVfRU5EXG5cbiAgICAgICAgICAgIGlmIHRva2VuIGlzIFNXSVRDSF9CUkFDRV9DTE9TRVxuICAgICAgICAgICAgICBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnB1c2ggcGFyZW50VG9rZW5JZHggPSBzdGFja09mVG9rZW5zU3RpbGxPcGVuLnBvcCgpXG4gICAgICAgICAgICAgIGlmIHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLnR5cGUgaXMgU1dJVENIX0NBU0Ugb3IgdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0udHlwZSBpcyBTV0lUQ0hfREVGQVVMVFxuICAgICAgICAgICAgICAgICMgd2Ugb25seSBhbGxvdyBhIHNpbmdsZSBjYXNlL2RlZmF1bHQgc3RhY2sgZWxlbWVudCBwZXIgc3dpdGNoIGluc3RhbmNlXG4gICAgICAgICAgICAgICAgIyBzbyBub3cgd2UgYXJlIGF0IHRoZSBzd2l0Y2gncyBjbG9zZSBicmFjZSB3ZSBwb3Agb2ZmIGFueSBjYXNlL2RlZmF1bHQgdG9rZW5zXG4gICAgICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuXG4gICAgICAgICAgICB0b2tlbk9uVGhpc0xpbmUgPSB0cnVlXG4gICAgICAgICAgICBpZiBpc0ZpcnN0VG9rZW5PZkxpbmVcbiAgICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wdXNoIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgICBpZiBwYXJlbnRUb2tlbklkeD9cbiAgICAgICAgICAgICAgICBpbmRlbnRSZWNhbGMgPSBAaW5kZW50Um93KHtyb3c6IHJvdywgYmxvY2tJbmRlbnQ6IHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLmZpcnN0Q2hhckluZGVudGF0aW9uIH0pXG5cbiAgICAgICAgICAgICMgcmUtcGFyc2UgbGluZSBpZiBpbmRlbnQgZGlkIHNvbWV0aGluZyB0byBpdFxuICAgICAgICAgICAgaWYgaW5kZW50UmVjYWxjXG4gICAgICAgICAgICAgIGxpbmUgPSBAZWRpdG9yLmxpbmVUZXh0Rm9yQnVmZmVyUm93IHJvd1xuICAgICAgICAgICAgICBASlNYUkVHRVhQLmxhc3RJbmRleCA9IDAgI2ZvcmNlIHJlZ2V4IHRvIHN0YXJ0IGFnYWluXG4gICAgICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgICAgIGlzRmlyc3RUb2tlbk9mTGluZSA9IGZhbHNlXG5cbiAgICAgICAgICAgIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgaWYgcGFyZW50VG9rZW5JZHg/XG4gICAgICAgICAgICAgIHRva2VuU3RhY2sucHVzaFxuICAgICAgICAgICAgICAgIHR5cGU6IHRva2VuXG4gICAgICAgICAgICAgICAgbmFtZTogJydcbiAgICAgICAgICAgICAgICByb3c6IHJvd1xuICAgICAgICAgICAgICAgIHBhcmVudFRva2VuSWR4OiBwYXJlbnRUb2tlbklkeCAgICAgICAgICMgcHRyIHRvIDx0YWdcbiAgICAgICAgICAgICAgaWYgcGFyZW50VG9rZW5JZHggPj0wIHRoZW4gdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0udGVybXNUaGlzVGFnSWR4ID0gaWR4T2ZUb2tlblxuICAgICAgICAgICAgICBpZHhPZlRva2VuKytcblxuICAgICAgICAgICAgaWYgdG9rZW4gaXMgVEVNUExBVEVfRU5EIHRoZW4gQHRlbXBsYXRlRGVwdGgtLVxuXG4gICAgICAgICAgIyBjYXNlLCBkZWZhdWx0IHN0YXRlbWVudCBvZiBzd2l0Y2hcbiAgICAgICAgICB3aGVuIFNXSVRDSF9DQVNFLCBTV0lUQ0hfREVGQVVMVFxuICAgICAgICAgICAgdG9rZW5PblRoaXNMaW5lID0gdHJ1ZVxuICAgICAgICAgICAgaXNGaXJzdFRhZ09mQmxvY2sgPSB0cnVlXG4gICAgICAgICAgICBpZiBpc0ZpcnN0VG9rZW5PZkxpbmVcbiAgICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wdXNoIHBhcmVudFRva2VuSWR4ID0gc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgICBpZiBwYXJlbnRUb2tlbklkeD9cbiAgICAgICAgICAgICAgICBpZiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS50eXBlIGlzIFNXSVRDSF9DQVNFIG9yIHRva2VuU3RhY2tbcGFyZW50VG9rZW5JZHhdLnR5cGUgaXMgU1dJVENIX0RFRkFVTFRcbiAgICAgICAgICAgICAgICAgICMgd2Ugb25seSBhbGxvdyBhIHNpbmdsZSBjYXNlL2RlZmF1bHQgc3RhY2sgZWxlbWVudCBwZXIgc3dpdGNoIGluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAjIHNvIHBvc2l0aW9uIG5ldyBjYXNlL2RlZmF1bHQgdG8gdGhlIGxhc3Qgb25lcyBwb3NpdGlvbiBhbmQgdGhlbiBwb3AgdGhlIGxhc3Qnc1xuICAgICAgICAgICAgICAgICAgIyBvZmYgdGhlIHN0YWNrLlxuICAgICAgICAgICAgICAgICAgaW5kZW50UmVjYWxjID0gQGluZGVudFJvdyh7cm93OiByb3csIGJsb2NrSW5kZW50OiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS5maXJzdENoYXJJbmRlbnRhdGlvbiB9KVxuICAgICAgICAgICAgICAgICAgc3RhY2tPZlRva2Vuc1N0aWxsT3Blbi5wb3AoKVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF0udHlwZSBpcyBTV0lUQ0hfQlJBQ0VfT1BFTlxuICAgICAgICAgICAgICAgICAgaW5kZW50UmVjYWxjID0gQGluZGVudFJvdyh7cm93OiByb3csIGJsb2NrSW5kZW50OiB0b2tlblN0YWNrW3BhcmVudFRva2VuSWR4XS5maXJzdENoYXJJbmRlbnRhdGlvbiwganN4SW5kZW50OiAxIH0pXG5cbiAgICAgICAgICAgICMgcmUtcGFyc2UgbGluZSBpZiBpbmRlbnQgZGlkIHNvbWV0aGluZyB0byBpdFxuICAgICAgICAgICAgaWYgaW5kZW50UmVjYWxjXG4gICAgICAgICAgICAgIGxpbmUgPSBAZWRpdG9yLmxpbmVUZXh0Rm9yQnVmZmVyUm93IHJvd1xuICAgICAgICAgICAgICBASlNYUkVHRVhQLmxhc3RJbmRleCA9IDAgI2ZvcmNlIHJlZ2V4IHRvIHN0YXJ0IGFnYWluXG4gICAgICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgICAgIGlzRmlyc3RUb2tlbk9mTGluZSA9IGZhbHNlXG5cbiAgICAgICAgICAgIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucHVzaCBwYXJlbnRUb2tlbklkeCA9IHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucG9wKClcblxuICAgICAgICAgICAgdG9rZW5TdGFjay5wdXNoXG4gICAgICAgICAgICAgIHR5cGU6IHRva2VuXG4gICAgICAgICAgICAgIG5hbWU6ICcnXG4gICAgICAgICAgICAgIHJvdzogcm93XG4gICAgICAgICAgICAgIGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb246IGZpcnN0VGFnSW5MaW5lSW5kZW50YXRpb25cbiAgICAgICAgICAgICAgdG9rZW5JbmRlbnRhdGlvbjogdG9rZW5JbmRlbnRhdGlvblxuICAgICAgICAgICAgICBmaXJzdENoYXJJbmRlbnRhdGlvbjogZmlyc3RDaGFySW5kZW50YXRpb25cbiAgICAgICAgICAgICAgcGFyZW50VG9rZW5JZHg6IHBhcmVudFRva2VuSWR4XG4gICAgICAgICAgICAgIHRlcm1zVGhpc1RhZ3NBdHRyaWJ1dGVzSWR4OiBudWxsICAjIHB0ciB0byA+IHRhZ1xuICAgICAgICAgICAgICB0ZXJtc1RoaXNUYWdJZHg6IG51bGwgICAgICAgICAgICAgIyBwdHIgdG8gPC90YWc+XG5cbiAgICAgICAgICAgIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucHVzaCBpZHhPZlRva2VuXG4gICAgICAgICAgICBpZHhPZlRva2VuKytcblxuICAgICAgICAgICMgVGVybmFyeSBhbmQgY29uZGl0aW9uYWwgaWYvZWxzZSBvcGVyYXRvcnNcbiAgICAgICAgICB3aGVuIEpTX0lGLCBKU19FTFNFLCBKU19SRVRVUk5cbiAgICAgICAgICAgIGlzRmlyc3RUYWdPZkJsb2NrID0gdHJ1ZVxuXG4gICAgICAjIGhhbmRsZSBsaW5lcyB3aXRoIG5vIHRva2VuIG9uIHRoZW1cbiAgICAgIGlmIGlkeE9mVG9rZW4gYW5kIG5vdCB0b2tlbk9uVGhpc0xpbmVcbiAgICAgICAgIyBpbmRlbnQgbGluZXMgYnV0IHJlbW92ZSBhbnkgYmxhbmsgbGluZXMgd2l0aCB3aGl0ZSBzcGFjZSBleGNlcHQgdGhlIGxhc3Qgcm93XG4gICAgICAgIGlmIHJvdyBpc250IHJhbmdlLmVuZC5yb3dcbiAgICAgICAgICBibGFua0xpbmVFbmRQb3MgPSAvXlxccyokLy5leGVjKEBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cocm93KSk/WzBdLmxlbmd0aFxuICAgICAgICAgIGlmIGJsYW5rTGluZUVuZFBvcz9cbiAgICAgICAgICAgIEBpbmRlbnRSb3coe3Jvdzogcm93ICwgYmxvY2tJbmRlbnQ6IDAgfSlcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBAaW5kZW50VW50b2tlbmlzZWRMaW5lIHJvdywgdG9rZW5TdGFjaywgc3RhY2tPZlRva2Vuc1N0aWxsT3BlblxuICAgICAgICBlbHNlXG4gICAgICAgICAgQGluZGVudFVudG9rZW5pc2VkTGluZSByb3csIHRva2VuU3RhY2ssIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW5cblxuXG4gICMgaW5kZW50IGFueSBsaW5lcyB0aGF0IGhhdmVuJ3QgYW55IGludGVyZXN0aW5nIHRva2Vuc1xuICBpbmRlbnRVbnRva2VuaXNlZExpbmU6IChyb3csIHRva2VuU3RhY2ssIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4gKSAtPlxuICAgIHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucHVzaCBwYXJlbnRUb2tlbklkeCA9IHN0YWNrT2ZUb2tlbnNTdGlsbE9wZW4ucG9wKClcbiAgICByZXR1cm4gaWYgbm90IHBhcmVudFRva2VuSWR4P1xuICAgIHRva2VuID0gdG9rZW5TdGFja1twYXJlbnRUb2tlbklkeF1cbiAgICBzd2l0Y2ggdG9rZW4udHlwZVxuICAgICAgd2hlbiBKU1hUQUdfT1BFTiwgSlNYVEFHX1NFTEZDTE9TRV9TVEFSVFxuICAgICAgICBpZiAgdG9rZW4udGVybXNUaGlzVGFnc0F0dHJpYnV0ZXNJZHggaXMgbnVsbFxuICAgICAgICAgIEBpbmRlbnRSb3coe3Jvdzogcm93LCBibG9ja0luZGVudDogdG9rZW4uZmlyc3RDaGFySW5kZW50YXRpb24sIGpzeEluZGVudFByb3BzOiAxIH0pXG4gICAgICAgIGVsc2UgQGluZGVudFJvdyh7cm93OiByb3csIGJsb2NrSW5kZW50OiB0b2tlbi5maXJzdENoYXJJbmRlbnRhdGlvbiwganN4SW5kZW50OiAxIH0pXG4gICAgICB3aGVuIEpTWEJSQUNFX09QRU4sIFRFUk5BUllfSUZcbiAgICAgICAgQGluZGVudFJvdyh7cm93OiByb3csIGJsb2NrSW5kZW50OiB0b2tlbi5maXJzdENoYXJJbmRlbnRhdGlvbiwganN4SW5kZW50OiAxLCBhbGxvd0FkZGl0aW9uYWxJbmRlbnRzOiB0cnVlfSlcbiAgICAgIHdoZW4gQlJBQ0VfT1BFTiwgU1dJVENIX0JSQUNFX09QRU4sIFBBUkVOX09QRU5cbiAgICAgICAgQGluZGVudFJvdyh7cm93OiByb3csIGJsb2NrSW5kZW50OiB0b2tlbi5maXJzdENoYXJJbmRlbnRhdGlvbiwganN4SW5kZW50OiAxLCBhbGxvd0FkZGl0aW9uYWxJbmRlbnRzOiB0cnVlfSlcbiAgICAgIHdoZW4gSlNYVEFHX1NFTEZDTE9TRV9FTkQsIEpTWEJSQUNFX0NMT1NFLCBKU1hUQUdfQ0xPU0VfQVRUUlMsIFRFUk5BUllfRUxTRVxuICAgICAgICBAaW5kZW50Um93KHtyb3c6IHJvdywgYmxvY2tJbmRlbnQ6IHRva2VuU3RhY2tbdG9rZW4ucGFyZW50VG9rZW5JZHhdLmZpcnN0Q2hhckluZGVudGF0aW9uLCBqc3hJbmRlbnRQcm9wczogMX0pXG4gICAgICB3aGVuIEJSQUNFX0NMT1NFLCBTV0lUQ0hfQlJBQ0VfQ0xPU0UsIFBBUkVOX0NMT1NFXG4gICAgICAgIEBpbmRlbnRSb3coe3Jvdzogcm93LCBibG9ja0luZGVudDogdG9rZW5TdGFja1t0b2tlbi5wYXJlbnRUb2tlbklkeF0uZmlyc3RDaGFySW5kZW50YXRpb24sIGpzeEluZGVudDogMSwgYWxsb3dBZGRpdGlvbmFsSW5kZW50czogdHJ1ZX0pXG4gICAgICB3aGVuIFNXSVRDSF9DQVNFLCBTV0lUQ0hfREVGQVVMVFxuICAgICAgICBAaW5kZW50Um93KHtyb3c6IHJvdywgYmxvY2tJbmRlbnQ6IHRva2VuLmZpcnN0Q2hhckluZGVudGF0aW9uLCBqc3hJbmRlbnQ6IDEgfSlcbiAgICAgIHdoZW4gVEVNUExBVEVfU1RBUlQsIFRFTVBMQVRFX0VORFxuICAgICAgICByZXR1cm47ICMgZG9uJ3QgdG91Y2ggdGVtcGxhdGVzXG5cbiAgIyBnZXQgdGhlIHRva2VuIGF0IHRoZSBnaXZlbiBtYXRjaCBwb3NpdGlvbiBvciByZXR1cm4gdHJ1dGh5IGZhbHNlXG4gIGdldFRva2VuOiAoYnVmZmVyUm93LCBtYXRjaCkgLT5cbiAgICBzY29wZSA9IEBlZGl0b3Iuc2NvcGVEZXNjcmlwdG9yRm9yQnVmZmVyUG9zaXRpb24oW2J1ZmZlclJvdywgbWF0Y2guaW5kZXhdKS5nZXRTY29wZXNBcnJheSgpLnBvcCgpXG4gICAgaWYgJ3B1bmN0dWF0aW9uLmRlZmluaXRpb24udGFnLmpzeCcgaXMgc2NvcGVcbiAgICAgIGlmICAgICAgbWF0Y2hbMV0/IG9yIG1hdGNoWzIwXT8gdGhlbiByZXR1cm4gSlNYVEFHX09QRU5cbiAgICAgIGVsc2UgaWYgbWF0Y2hbM10/IHRoZW4gcmV0dXJuIEpTWFRBR19TRUxGQ0xPU0VfRU5EXG4gICAgZWxzZSBpZiAnSlNYRW5kVGFnU3RhcnQnIGlzIHNjb3BlXG4gICAgICBpZiBtYXRjaFs0XT8gb3IgbWF0Y2hbMjJdPyB0aGVuIHJldHVybiBKU1hUQUdfQ0xPU0VcbiAgICBlbHNlIGlmICdKU1hTdGFydFRhZ0VuZCcgaXMgc2NvcGVcbiAgICAgIGlmIG1hdGNoWzddPyBvciBtYXRjaFsyMV0/IHRoZW4gcmV0dXJuIEpTWFRBR19DTE9TRV9BVFRSU1xuICAgIGVsc2UgaWYgbWF0Y2hbOF0/XG4gICAgICBpZiAncHVuY3R1YXRpb24uc2VjdGlvbi5lbWJlZGRlZC5iZWdpbi5qc3gnIGlzIHNjb3BlXG4gICAgICAgIHJldHVybiBKU1hCUkFDRV9PUEVOXG4gICAgICBlbHNlIGlmICdtZXRhLmJyYWNlLmN1cmx5LnN3aXRjaFN0YXJ0LmpzJyBpcyBzY29wZVxuICAgICAgICByZXR1cm4gU1dJVENIX0JSQUNFX09QRU5cbiAgICAgIGVsc2UgaWYgJ21ldGEuYnJhY2UuY3VybHkuanMnIGlzIHNjb3BlIG9yXG4gICAgICAgICdtZXRhLmJyYWNlLmN1cmx5LmxpdG9iai5qcycgaXMgc2NvcGVcbiAgICAgICAgICByZXR1cm4gQlJBQ0VfT1BFTlxuICAgIGVsc2UgaWYgbWF0Y2hbOV0/XG4gICAgICBpZiAncHVuY3R1YXRpb24uc2VjdGlvbi5lbWJlZGRlZC5lbmQuanN4JyBpcyBzY29wZVxuICAgICAgICByZXR1cm4gSlNYQlJBQ0VfQ0xPU0VcbiAgICAgIGVsc2UgaWYgJ21ldGEuYnJhY2UuY3VybHkuc3dpdGNoRW5kLmpzJyBpcyBzY29wZVxuICAgICAgICByZXR1cm4gU1dJVENIX0JSQUNFX0NMT1NFXG4gICAgICBlbHNlIGlmICdtZXRhLmJyYWNlLmN1cmx5LmpzJyBpcyBzY29wZSBvclxuICAgICAgICAnbWV0YS5icmFjZS5jdXJseS5saXRvYmouanMnIGlzIHNjb3BlXG4gICAgICAgICAgcmV0dXJuIEJSQUNFX0NMT1NFXG4gICAgZWxzZSBpZiBtYXRjaFsxMF0/XG4gICAgICBpZiAna2V5d29yZC5vcGVyYXRvci50ZXJuYXJ5LmpzJyBpcyBzY29wZVxuICAgICAgICByZXR1cm4gVEVSTkFSWV9JRlxuICAgIGVsc2UgaWYgbWF0Y2hbMTFdP1xuICAgICAgaWYgJ2tleXdvcmQub3BlcmF0b3IudGVybmFyeS5qcycgaXMgc2NvcGVcbiAgICAgICAgcmV0dXJuIFRFUk5BUllfRUxTRVxuICAgIGVsc2UgaWYgbWF0Y2hbMTJdP1xuICAgICAgaWYgJ2tleXdvcmQuY29udHJvbC5jb25kaXRpb25hbC5qcycgaXMgc2NvcGVcbiAgICAgICAgcmV0dXJuIEpTX0lGXG4gICAgZWxzZSBpZiBtYXRjaFsxM10/XG4gICAgICBpZiAna2V5d29yZC5jb250cm9sLmNvbmRpdGlvbmFsLmpzJyBpcyBzY29wZVxuICAgICAgICByZXR1cm4gSlNfRUxTRVxuICAgIGVsc2UgaWYgbWF0Y2hbMTRdP1xuICAgICAgaWYgJ2tleXdvcmQuY29udHJvbC5zd2l0Y2guanMnIGlzIHNjb3BlXG4gICAgICAgIHJldHVybiBTV0lUQ0hfQ0FTRVxuICAgIGVsc2UgaWYgbWF0Y2hbMTVdP1xuICAgICAgaWYgJ2tleXdvcmQuY29udHJvbC5zd2l0Y2guanMnIGlzIHNjb3BlXG4gICAgICAgIHJldHVybiBTV0lUQ0hfREVGQVVMVFxuICAgIGVsc2UgaWYgbWF0Y2hbMTZdP1xuICAgICAgaWYgJ2tleXdvcmQuY29udHJvbC5mbG93LmpzJyBpcyBzY29wZVxuICAgICAgICByZXR1cm4gSlNfUkVUVVJOXG4gICAgZWxzZSBpZiBtYXRjaFsxN10/XG4gICAgICBpZiAnbWV0YS5icmFjZS5yb3VuZC5qcycgaXMgc2NvcGUgb3JcbiAgICAgICAnbWV0YS5icmFjZS5yb3VuZC5ncmFwaHFsJyBpcyBzY29wZSBvclxuICAgICAgICdtZXRhLmJyYWNlLnJvdW5kLmRpcmVjdGl2ZS5ncmFwaHFsJyBpcyBzY29wZVxuICAgICAgICAgIHJldHVybiBQQVJFTl9PUEVOXG4gICAgZWxzZSBpZiBtYXRjaFsxOF0/XG4gICAgICBpZiAnbWV0YS5icmFjZS5yb3VuZC5qcycgaXMgc2NvcGUgb3JcbiAgICAgICAnbWV0YS5icmFjZS5yb3VuZC5ncmFwaHFsJyBpcyBzY29wZSBvclxuICAgICAgICdtZXRhLmJyYWNlLnJvdW5kLmRpcmVjdGl2ZS5ncmFwaHFsJyBpcyBzY29wZVxuICAgICAgICAgIHJldHVybiBQQVJFTl9DTE9TRVxuICAgIGVsc2UgaWYgbWF0Y2hbMTldP1xuICAgICAgaWYgJ3B1bmN0dWF0aW9uLmRlZmluaXRpb24ucXVhc2kuYmVnaW4uanMnIGlzIHNjb3BlXG4gICAgICAgIHJldHVybiBURU1QTEFURV9TVEFSVFxuICAgICAgaWYgJ3B1bmN0dWF0aW9uLmRlZmluaXRpb24ucXVhc2kuZW5kLmpzJyBpcyBzY29wZVxuICAgICAgICByZXR1cm4gVEVNUExBVEVfRU5EXG5cbiAgICByZXR1cm4gTk9fVE9LRU5cblxuXG4gICMgZ2V0IGluZGVudCBvZiB0aGUgcHJldmlvdXMgcm93IHdpdGggY2hhcnMgaW4gaXRcbiAgZ2V0SW5kZW50T2ZQcmV2aW91c1JvdzogKHJvdykgLT5cbiAgICByZXR1cm4gMCB1bmxlc3Mgcm93XG4gICAgZm9yIHJvdyBpbiBbcm93LTEuLi4wXVxuICAgICAgbGluZSA9IEBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cgcm93XG4gICAgICByZXR1cm4gQGVkaXRvci5pbmRlbnRhdGlvbkZvckJ1ZmZlclJvdyByb3cgaWYgIC8uKlxcUy8udGVzdCBsaW5lXG4gICAgcmV0dXJuIDBcblxuICAjIGdldCBlc2xpbnQgdHJhbnNsYXRlZCBpbmRlbnQgb3B0aW9uc1xuICBnZXRJbmRlbnRPcHRpb25zOiAoKSAtPlxuICAgIGlmIG5vdCBAYXV0b0pzeCB0aGVuIHJldHVybiBAdHJhbnNsYXRlSW5kZW50T3B0aW9ucygpXG4gICAgaWYgZXNsaW50cmNGaWxlbmFtZSA9IEBnZXRFc2xpbnRyY0ZpbGVuYW1lKClcbiAgICAgIGVzbGludHJjRmlsZW5hbWUgPSBuZXcgRmlsZShlc2xpbnRyY0ZpbGVuYW1lKVxuICAgICAgQHRyYW5zbGF0ZUluZGVudE9wdGlvbnMoQHJlYWRFc2xpbnRyY09wdGlvbnMoZXNsaW50cmNGaWxlbmFtZS5nZXRQYXRoKCkpKVxuICAgIGVsc2VcbiAgICAgIEB0cmFuc2xhdGVJbmRlbnRPcHRpb25zKHt9KSAjIGdldCBkZWZhdWx0c1xuXG4gICMgcmV0dXJuIHRleHQgc3RyaW5nIG9mIGEgcHJvamVjdCBiYXNlZCAuZXNsaW50cmMgZmlsZSBpZiBvbmUgZXhpc3RzXG4gIGdldEVzbGludHJjRmlsZW5hbWU6ICgpIC0+XG4gICAgcHJvamVjdENvbnRhaW5pbmdTb3VyY2UgPSBhdG9tLnByb2plY3QucmVsYXRpdml6ZVBhdGggQGVkaXRvci5nZXRQYXRoKClcbiAgICAjIElzIHRoZSBzb3VyY2VGaWxlIGxvY2F0ZWQgaW5zaWRlIGFuIEF0b20gcHJvamVjdCBmb2xkZXI/XG4gICAgaWYgcHJvamVjdENvbnRhaW5pbmdTb3VyY2VbMF0/XG4gICAgICBwYXRoLmpvaW4gcHJvamVjdENvbnRhaW5pbmdTb3VyY2VbMF0sICcuZXNsaW50cmMnXG5cbiAgIyBtb3VzZSBzdGF0ZVxuICBvbk1vdXNlRG93bjogKCkgPT5cbiAgICBAbW91c2VVcCA9IGZhbHNlXG5cbiAgIyBtb3VzZSBzdGF0ZVxuICBvbk1vdXNlVXA6ICgpID0+XG4gICAgQG1vdXNlVXAgPSB0cnVlXG5cbiAgIyB0byBjcmVhdGUgaW5kZW50cy4gV2UgY2FuIHJlYWQgYW5kIHJldHVybiB0aGUgcnVsZXMgcHJvcGVydGllcyBvciB1bmRlZmluZWRcbiAgcmVhZEVzbGludHJjT3B0aW9uczogKGVzbGludHJjRmlsZSkgLT5cbiAgICAjIEV4cGVuc2l2ZSBkZXBlbmRlbmN5OiB1c2UgYSBsYXp5IHJlcXVpcmUuXG4gICAgZnMgPSByZXF1aXJlICdmcy1wbHVzJ1xuICAgICMgZ2V0IGxvY2FsIHBhdGggb3ZlcmlkZXNcbiAgICBpZiBmcy5pc0ZpbGVTeW5jIGVzbGludHJjRmlsZVxuICAgICAgZmlsZUNvbnRlbnQgPSBzdHJpcEpzb25Db21tZW50cyhmcy5yZWFkRmlsZVN5bmMoZXNsaW50cmNGaWxlLCAndXRmOCcpKVxuICAgICAgdHJ5XG4gICAgICAgICMgRXhwZW5zaXZlIGRlcGVuZGVuY3k6IHVzZSBhIGxhenkgcmVxdWlyZS5cbiAgICAgICAgWUFNTCA9IHJlcXVpcmUgJ2pzLXlhbWwnXG4gICAgICAgIGVzbGludFJ1bGVzID0gKFlBTUwuc2FmZUxvYWQgZmlsZUNvbnRlbnQpLnJ1bGVzXG4gICAgICAgIGlmIGVzbGludFJ1bGVzIHRoZW4gcmV0dXJuIGVzbGludFJ1bGVzXG4gICAgICBjYXRjaCBlcnJcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEVycm9yIFwiTEI6IEVycm9yIHJlYWRpbmcgLmVzbGludHJjIGF0ICN7ZXNsaW50cmNGaWxlfVwiLFxuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlXG4gICAgICAgICAgZGV0YWlsOiBcIiN7ZXJyLm1lc3NhZ2V9XCJcbiAgICByZXR1cm4ge31cblxuICAjIHVzZSBlc2xpbnQgcmVhY3QgZm9ybWF0IGRlc2NyaWJlZCBhdCBodHRwOi8vdGlueXVybC5jb20vcDRtdGF0dlxuICAjIHR1cm4gc3BhY2VzIGludG8gdGFiIGRpbWVuc2lvbnMgd2hpY2ggY2FuIGJlIGRlY2ltYWxcbiAgIyBhIGVtcHR5IG9iamVjdCBhcmd1bWVudCBwYXJzZXMgYmFjayB0aGUgZGVmYXVsdCBzZXR0aW5nc1xuICB0cmFuc2xhdGVJbmRlbnRPcHRpb25zOiAoZXNsaW50UnVsZXMpIC0+XG4gICAgIyBFc2xpbnQgcnVsZXMgdG8gdXNlIGFzIGRlZmF1bHQgb3ZlcmlkZGVuIGJ5IC5lc2xpbnRyY1xuICAgICMgTi5CLiB0aGF0IHRoaXMgaXMgbm90IHRoZSBzYW1lIGFzIHRoZSBlc2xpbnQgcnVsZXMgaW4gdGhhdFxuICAgICMgdGhlIHRhYi1zcGFjZXMgYW5kICd0YWIncyBpbiBlc2xpbnRyYyBhcmUgY29udmVydGVkIHRvIHRhYnMgYmFzZWQgdXBvblxuICAgICMgdGhlIEF0b20gZWRpdG9yIHRhYiBzcGFjaW5nLlxuICAgICMgZS5nLiBlc2xpbnQgaW5kZW50IFsxLDRdIHdpdGggYW4gQXRvbSB0YWIgc3BhY2luZyBvZiAyIGJlY29tZXMgaW5kZW50IFsxLDJdXG4gICAgZXNsaW50SW5kZW50T3B0aW9ucyAgPVxuICAgICAganN4SW5kZW50OiBbMSwxXSAgICAgICAgICAgICMgMSA9IGVuYWJsZWQsIDE9I3RhYnNcbiAgICAgIGpzeEluZGVudFByb3BzOiBbMSwxXSAgICAgICAjIDEgPSBlbmFibGVkLCAxPSN0YWJzXG4gICAgICBqc3hDbG9zaW5nQnJhY2tldExvY2F0aW9uOiBbXG4gICAgICAgIDEsXG4gICAgICAgIHNlbGZDbG9zaW5nOiBUQUdBTElHTkVEXG4gICAgICAgIG5vbkVtcHR5OiBUQUdBTElHTkVEXG4gICAgICBdXG5cbiAgICByZXR1cm4gZXNsaW50SW5kZW50T3B0aW9ucyB1bmxlc3MgdHlwZW9mIGVzbGludFJ1bGVzIGlzIFwib2JqZWN0XCJcblxuICAgIEVTX0RFRkFVTFRfSU5ERU5UID0gNCAjIGRlZmF1bHQgZXNsaW50IGluZGVudCBhcyBzcGFjZXNcblxuICAgICMgcmVhZCBpbmRlbnQgaWYgaXQgZXhpc3RzIGFuZCB1c2UgaXQgYXMgdGhlIGRlZmF1bHQgaW5kZW50IGZvciBKU1hcbiAgICBydWxlID0gZXNsaW50UnVsZXNbJ2luZGVudCddXG4gICAgaWYgdHlwZW9mIHJ1bGUgaXMgJ251bWJlcicgb3IgdHlwZW9mIHJ1bGUgaXMgJ3N0cmluZydcbiAgICAgIGRlZmF1bHRJbmRlbnQgID0gRVNfREVGQVVMVF9JTkRFTlQgLyBAZWRpdG9yLmdldFRhYkxlbmd0aCgpXG4gICAgZWxzZSBpZiB0eXBlb2YgcnVsZSBpcyAnb2JqZWN0J1xuICAgICAgaWYgdHlwZW9mIHJ1bGVbMV0gaXMgJ251bWJlcidcbiAgICAgICAgZGVmYXVsdEluZGVudCAgPSBydWxlWzFdIC8gQGVkaXRvci5nZXRUYWJMZW5ndGgoKVxuICAgICAgZWxzZSBkZWZhdWx0SW5kZW50ICA9IDFcbiAgICBlbHNlIGRlZmF1bHRJbmRlbnQgID0gMVxuXG4gICAgcnVsZSA9IGVzbGludFJ1bGVzWydyZWFjdC9qc3gtaW5kZW50J11cbiAgICBpZiB0eXBlb2YgcnVsZSBpcyAnbnVtYmVyJyBvciB0eXBlb2YgcnVsZSBpcyAnc3RyaW5nJ1xuICAgICAgZXNsaW50SW5kZW50T3B0aW9ucy5qc3hJbmRlbnRbMF0gPSBydWxlXG4gICAgICBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeEluZGVudFsxXSA9IEVTX0RFRkFVTFRfSU5ERU5UIC8gQGVkaXRvci5nZXRUYWJMZW5ndGgoKVxuICAgIGVsc2UgaWYgdHlwZW9mIHJ1bGUgaXMgJ29iamVjdCdcbiAgICAgIGVzbGludEluZGVudE9wdGlvbnMuanN4SW5kZW50WzBdID0gcnVsZVswXVxuICAgICAgaWYgdHlwZW9mIHJ1bGVbMV0gaXMgJ251bWJlcidcbiAgICAgICAgZXNsaW50SW5kZW50T3B0aW9ucy5qc3hJbmRlbnRbMV0gPSBydWxlWzFdIC8gQGVkaXRvci5nZXRUYWJMZW5ndGgoKVxuICAgICAgZWxzZSBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeEluZGVudFsxXSA9IDFcbiAgICBlbHNlIGVzbGludEluZGVudE9wdGlvbnMuanN4SW5kZW50WzFdID0gZGVmYXVsdEluZGVudFxuXG4gICAgcnVsZSA9IGVzbGludFJ1bGVzWydyZWFjdC9qc3gtaW5kZW50LXByb3BzJ11cbiAgICBpZiB0eXBlb2YgcnVsZSBpcyAnbnVtYmVyJyBvciB0eXBlb2YgcnVsZSBpcyAnc3RyaW5nJ1xuICAgICAgZXNsaW50SW5kZW50T3B0aW9ucy5qc3hJbmRlbnRQcm9wc1swXSA9IHJ1bGVcbiAgICAgIGVzbGludEluZGVudE9wdGlvbnMuanN4SW5kZW50UHJvcHNbMV0gPSBFU19ERUZBVUxUX0lOREVOVCAvIEBlZGl0b3IuZ2V0VGFiTGVuZ3RoKClcbiAgICBlbHNlIGlmIHR5cGVvZiBydWxlIGlzICdvYmplY3QnXG4gICAgICBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeEluZGVudFByb3BzWzBdID0gcnVsZVswXVxuICAgICAgaWYgdHlwZW9mIHJ1bGVbMV0gaXMgJ251bWJlcidcbiAgICAgICAgZXNsaW50SW5kZW50T3B0aW9ucy5qc3hJbmRlbnRQcm9wc1sxXSA9IHJ1bGVbMV0gLyBAZWRpdG9yLmdldFRhYkxlbmd0aCgpXG4gICAgICBlbHNlIGVzbGludEluZGVudE9wdGlvbnMuanN4SW5kZW50UHJvcHNbMV0gPSAxXG4gICAgZWxzZSBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeEluZGVudFByb3BzWzFdID0gZGVmYXVsdEluZGVudFxuXG4gICAgcnVsZSA9IGVzbGludFJ1bGVzWydyZWFjdC9qc3gtY2xvc2luZy1icmFja2V0LWxvY2F0aW9uJ11cbiAgICBpZiB0eXBlb2YgcnVsZSBpcyAnbnVtYmVyJyBvciB0eXBlb2YgcnVsZSBpcyAnc3RyaW5nJ1xuICAgICAgZXNsaW50SW5kZW50T3B0aW9ucy5qc3hDbG9zaW5nQnJhY2tldExvY2F0aW9uWzBdID0gcnVsZVxuICAgIGVsc2UgaWYgdHlwZW9mIHJ1bGUgaXMgJ29iamVjdCcgIyBhcnJheVxuICAgICAgZXNsaW50SW5kZW50T3B0aW9ucy5qc3hDbG9zaW5nQnJhY2tldExvY2F0aW9uWzBdID0gcnVsZVswXVxuICAgICAgaWYgdHlwZW9mIHJ1bGVbMV0gaXMgJ3N0cmluZydcbiAgICAgICAgZXNsaW50SW5kZW50T3B0aW9ucy5qc3hDbG9zaW5nQnJhY2tldExvY2F0aW9uWzFdLnNlbGZDbG9zaW5nID1cbiAgICAgICAgICBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeENsb3NpbmdCcmFja2V0TG9jYXRpb25bMV0ubm9uRW1wdHkgPVxuICAgICAgICAgICAgcnVsZVsxXVxuICAgICAgZWxzZVxuICAgICAgICBpZiBydWxlWzFdLnNlbGZDbG9zaW5nP1xuICAgICAgICAgIGVzbGludEluZGVudE9wdGlvbnMuanN4Q2xvc2luZ0JyYWNrZXRMb2NhdGlvblsxXS5zZWxmQ2xvc2luZyA9IHJ1bGVbMV0uc2VsZkNsb3NpbmdcbiAgICAgICAgaWYgcnVsZVsxXS5ub25FbXB0eT9cbiAgICAgICAgICBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeENsb3NpbmdCcmFja2V0TG9jYXRpb25bMV0ubm9uRW1wdHkgPSBydWxlWzFdLm5vbkVtcHR5XG5cbiAgICByZXR1cm4gZXNsaW50SW5kZW50T3B0aW9uc1xuXG4gICMgZG9lcyB0aGUgcHJldmlvdXMgbGluZSB0ZXJtaW5hdGUgd2l0aCBhIHRlcm5hcnkgZWxzZSA6XG4gIHRlcm5hcnlUZXJtaW5hdGVzUHJldmlvdXNMaW5lOiAocm93KSAtPlxuICAgIHJvdy0tXG4gICAgcmV0dXJuIGZhbHNlIHVubGVzcyByb3cgPj0wXG4gICAgbGluZSA9IEBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cgcm93XG4gICAgbWF0Y2ggPSAvOlxccyokLy5leGVjKGxpbmUpXG4gICAgcmV0dXJuIGZhbHNlIGlmIG1hdGNoIGlzIG51bGxcbiAgICBzY29wZSA9IEBlZGl0b3Iuc2NvcGVEZXNjcmlwdG9yRm9yQnVmZmVyUG9zaXRpb24oW3JvdywgbWF0Y2guaW5kZXhdKS5nZXRTY29wZXNBcnJheSgpLnBvcCgpXG4gICAgcmV0dXJuIGZhbHNlIGlmIHNjb3BlIGlzbnQgJ2tleXdvcmQub3BlcmF0b3IudGVybmFyeS5qcydcbiAgICByZXR1cm4gdHJ1ZVxuXG4gICMgYWxsaWduIG5vbkVtcHR5IGFuZCBzZWxmQ2xvc2luZyB0YWdzIGJhc2VkIG9uIGVzbGludCBydWxlc1xuICAjIHJvdyB0byBiZSBpbmRlbnRlZCBiYXNlZCB1cG9uIGEgcGFyZW50VGFncyBwcm9wZXJ0aWVzIGFuZCBhIHJ1bGUgdHlwZVxuICAjIHJldHVybnMgaW5kZW50Um93J3MgcmV0dXJuIHZhbHVlXG4gIGluZGVudEZvckNsb3NpbmdCcmFja2V0OiAoIHJvdywgcGFyZW50VGFnLCBjbG9zaW5nQnJhY2tldFJ1bGUgKSAtPlxuICAgIGlmIEBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeENsb3NpbmdCcmFja2V0TG9jYXRpb25bMF1cbiAgICAgIGlmIGNsb3NpbmdCcmFja2V0UnVsZSBpcyBUQUdBTElHTkVEXG4gICAgICAgIEBpbmRlbnRSb3coe3Jvdzogcm93LCBibG9ja0luZGVudDogcGFyZW50VGFnLnRva2VuSW5kZW50YXRpb259KVxuICAgICAgZWxzZSBpZiBjbG9zaW5nQnJhY2tldFJ1bGUgaXMgTElORUFMSUdORURcbiAgICAgICAgQGluZGVudFJvdyh7cm93OiByb3csIGJsb2NrSW5kZW50OiBwYXJlbnRUYWcuZmlyc3RDaGFySW5kZW50YXRpb24gfSlcbiAgICAgIGVsc2UgaWYgY2xvc2luZ0JyYWNrZXRSdWxlIGlzIEFGVEVSUFJPUFNcbiAgICAgICAgIyB0aGlzIHJlYWxseSBpc24ndCB2YWxpZCBhcyB0aGlzIHRhZyBzaG91bGRuJ3QgYmUgb24gYSBsaW5lIGJ5IGl0c2VsZlxuICAgICAgICAjIGJ1dCBJIGRvbid0IHJlZm9ybWF0IGxpbmVzIGp1c3QgaW5kZW50IVxuICAgICAgICAjIGluZGVudCB0byBtYWtlIGl0IGxvb2sgT0sgYWx0aG91Z2ggaXQgd2lsbCBmYWlsIGVzbGludFxuICAgICAgICBpZiBAZXNsaW50SW5kZW50T3B0aW9ucy5qc3hJbmRlbnRQcm9wc1swXVxuICAgICAgICAgIEBpbmRlbnRSb3coe3Jvdzogcm93LCAgYmxvY2tJbmRlbnQ6IHBhcmVudFRhZy5maXJzdENoYXJJbmRlbnRhdGlvbiwganN4SW5kZW50UHJvcHM6IDEgfSlcbiAgICAgICAgZWxzZVxuICAgICAgICAgIEBpbmRlbnRSb3coe3Jvdzogcm93LCAgYmxvY2tJbmRlbnQ6IHBhcmVudFRhZy5maXJzdENoYXJJbmRlbnRhdGlvbn0pXG4gICAgICBlbHNlIGlmIGNsb3NpbmdCcmFja2V0UnVsZSBpcyBQUk9QU0FMSUdORURcbiAgICAgICAgaWYgQGVzbGludEluZGVudE9wdGlvbnMuanN4SW5kZW50UHJvcHNbMF1cbiAgICAgICAgICBAaW5kZW50Um93KHtyb3c6IHJvdywgIGJsb2NrSW5kZW50OiBwYXJlbnRUYWcudG9rZW5JbmRlbnRhdGlvbixqc3hJbmRlbnRQcm9wczogMX0pXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBAaW5kZW50Um93KHtyb3c6IHJvdywgIGJsb2NrSW5kZW50OiBwYXJlbnRUYWcudG9rZW5JbmRlbnRhdGlvbn0pXG5cbiAgIyBpbmRlbnQgYSByb3cgYnkgdGhlIGFkZGl0aW9uIG9mIG9uZSBvciBtb3JlIGluZGVudHMuXG4gICMgcmV0dXJucyBmYWxzZSBpZiBubyBpbmRlbnQgcmVxdWlyZWQgYXMgaXQgaXMgYWxyZWFkeSBjb3JyZWN0XG4gICMgcmV0dXJuIHRydWUgaWYgaW5kZW50IHdhcyByZXF1aXJlZFxuICAjIGJsb2NrSW5kZW50IGlzIHRoZSBpbmRlbnQgdG8gdGhlIHN0YXJ0IG9mIHRoaXMgbG9naWNhbCBqc3ggYmxvY2tcbiAgIyBvdGhlciBpbmRlbnRzIGFyZSB0aGUgcmVxdWlyZWQgaW5kZW50IGJhc2VkIG9uIGVzbGludCBjb25kaXRpb25zIGZvciBSZWFjdFxuICAjIG9wdGlvbiBjb250YWlucyByb3cgdG8gaW5kZW50IGFuZCBhbGxvd0FkZGl0aW9uYWxJbmRlbnRzIGZsYWdcbiAgaW5kZW50Um93OiAob3B0aW9ucykgLT5cbiAgICB7IHJvdywgYWxsb3dBZGRpdGlvbmFsSW5kZW50cywgYmxvY2tJbmRlbnQsIGpzeEluZGVudCwganN4SW5kZW50UHJvcHMgfSA9IG9wdGlvbnNcbiAgICBpZiBAdGVtcGxhdGVEZXB0aCA+IDAgdGhlbiByZXR1cm4gZmFsc2UgIyBkb24ndCBpbmRlbnQgaW5zaWRlIGEgdGVtcGxhdGVcbiAgICAjIGNhbGMgb3ZlcmFsbCBpbmRlbnRcbiAgICBpZiBqc3hJbmRlbnRcbiAgICAgIGlmIEBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeEluZGVudFswXVxuICAgICAgICBpZiBAZXNsaW50SW5kZW50T3B0aW9ucy5qc3hJbmRlbnRbMV1cbiAgICAgICAgICBibG9ja0luZGVudCArPSBqc3hJbmRlbnQgKiBAZXNsaW50SW5kZW50T3B0aW9ucy5qc3hJbmRlbnRbMV1cbiAgICBpZiBqc3hJbmRlbnRQcm9wc1xuICAgICAgaWYgQGVzbGludEluZGVudE9wdGlvbnMuanN4SW5kZW50UHJvcHNbMF1cbiAgICAgICAgaWYgQGVzbGludEluZGVudE9wdGlvbnMuanN4SW5kZW50UHJvcHNbMV1cbiAgICAgICAgICBibG9ja0luZGVudCArPSBqc3hJbmRlbnRQcm9wcyAqIEBlc2xpbnRJbmRlbnRPcHRpb25zLmpzeEluZGVudFByb3BzWzFdXG4gICAgIyBhbGxvd0FkZGl0aW9uYWxJbmRlbnRzIGFsbG93cyBpbmRlbnRzIHRvIGJlIGdyZWF0ZXIgdGhhbiB0aGUgbWluaW11bVxuICAgICMgdXNlZCB3aGVyZSBpdGVtcyBhcmUgYWxpZ25lZCBidXQgbm8gZXNsaW50IHJ1bGVzIGFyZSBhcHBsaWNhYmxlXG4gICAgIyBzbyB1c2VyIGhhcyBzb21lIGRpc2NyZXRpb24gaW4gYWRkaW5nIG1vcmUgaW5kZW50c1xuICAgIGlmIGFsbG93QWRkaXRpb25hbEluZGVudHNcbiAgICAgIGlmIEBlZGl0b3IuaW5kZW50YXRpb25Gb3JCdWZmZXJSb3cocm93KSA8IGJsb2NrSW5kZW50IG9yXG4gICAgICAgIEBlZGl0b3IuaW5kZW50YXRpb25Gb3JCdWZmZXJSb3cocm93KSA+IGJsb2NrSW5kZW50ICsgYWxsb3dBZGRpdGlvbmFsSW5kZW50c1xuICAgICAgICAgIEBlZGl0b3Iuc2V0SW5kZW50YXRpb25Gb3JCdWZmZXJSb3cgcm93LCBibG9ja0luZGVudCwgeyBwcmVzZXJ2ZUxlYWRpbmdXaGl0ZXNwYWNlOiBmYWxzZSB9XG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICBlbHNlXG4gICAgICBpZiBAZWRpdG9yLmluZGVudGF0aW9uRm9yQnVmZmVyUm93KHJvdykgaXNudCBibG9ja0luZGVudFxuICAgICAgICBAZWRpdG9yLnNldEluZGVudGF0aW9uRm9yQnVmZmVyUm93IHJvdywgYmxvY2tJbmRlbnQsIHsgcHJlc2VydmVMZWFkaW5nV2hpdGVzcGFjZTogZmFsc2UgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIHJldHVybiBmYWxzZVxuIl19
