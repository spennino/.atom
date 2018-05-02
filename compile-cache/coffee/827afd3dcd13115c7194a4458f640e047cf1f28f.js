(function() {
  var COMPLETIONS, JSXATTRIBUTE, JSXENDTAGSTART, JSXREGEXP, JSXSTARTTAGEND, JSXTAG, Point, REACTURL, Range, TAGREGEXP, filter, ref, ref1, score,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  ref = require("atom"), Range = ref.Range, Point = ref.Point;

  ref1 = require("fuzzaldrin"), filter = ref1.filter, score = ref1.score;

  JSXSTARTTAGEND = 0;

  JSXENDTAGSTART = 1;

  JSXTAG = 2;

  JSXATTRIBUTE = 3;

  JSXREGEXP = /(?:(<)|(<\/))([$_A-Za-z](?:[$._:\-a-zA-Z0-9])*)|(?:(\/>)|(>))|(<\s*>)/g;

  TAGREGEXP = /<([$_a-zA-Z][$._:\-a-zA-Z0-9]*)($|\s|\/>|>)/g;

  COMPLETIONS = require("./completions-jsx");

  REACTURL = "http://facebook.github.io/react/docs/tags-and-attributes.html";

  module.exports = {
    selector: ".meta.tag.jsx",
    inclusionPriority: 10000,
    excludeLowerPriority: false,
    getSuggestions: function(opts) {
      var attribute, attributes, bufferPosition, editor, elementObj, filteredAttributes, htmlElement, htmlElements, i, j, jsxRange, jsxTag, k, len, len1, len2, prefix, ref2, scopeDescriptor, startOfJSX, suggestions, tagName, tagNameStack;
      editor = opts.editor, bufferPosition = opts.bufferPosition, scopeDescriptor = opts.scopeDescriptor, prefix = opts.prefix;
      jsxTag = this.getTriggerTag(editor, bufferPosition);
      if (jsxTag == null) {
        return;
      }
      suggestions = [];
      if (jsxTag === JSXSTARTTAGEND) {
        startOfJSX = this.getStartOfJSX(editor, bufferPosition);
        jsxRange = new Range(startOfJSX, bufferPosition);
        tagNameStack = this.buildTagStack(editor, jsxRange);
        while ((tagName = tagNameStack.pop()) != null) {
          suggestions.push({
            snippet: "$1</" + tagName + ">",
            type: "tag",
            description: "language-babel tag closer"
          });
        }
      } else if (jsxTag === JSXENDTAGSTART) {
        startOfJSX = this.getStartOfJSX(editor, bufferPosition);
        jsxRange = new Range(startOfJSX, bufferPosition);
        tagNameStack = this.buildTagStack(editor, jsxRange);
        while ((tagName = tagNameStack.pop()) != null) {
          suggestions.push({
            snippet: tagName + ">",
            type: "tag",
            description: "language-babel tag closer"
          });
        }
      } else if (jsxTag === JSXTAG) {
        if (!/^[a-z]/g.exec(prefix)) {
          return;
        }
        htmlElements = filter(COMPLETIONS.htmlElements, prefix, {
          key: "name"
        });
        for (i = 0, len = htmlElements.length; i < len; i++) {
          htmlElement = htmlElements[i];
          if (score(htmlElement.name, prefix) < 0.07) {
            continue;
          }
          suggestions.push({
            snippet: htmlElement.name,
            type: "tag",
            description: "language-babel JSX supported elements",
            descriptionMoreURL: REACTURL
          });
        }
      } else if (jsxTag === JSXATTRIBUTE) {
        tagName = this.getThisTagName(editor, bufferPosition);
        if (tagName == null) {
          return;
        }
        ref2 = COMPLETIONS.htmlElements;
        for (j = 0, len1 = ref2.length; j < len1; j++) {
          elementObj = ref2[j];
          if (elementObj.name === tagName) {
            break;
          }
        }
        attributes = elementObj.attributes.concat(COMPLETIONS.globalAttributes);
        attributes = attributes.concat(COMPLETIONS.events);
        filteredAttributes = filter(attributes, prefix, {
          key: "name"
        });
        for (k = 0, len2 = filteredAttributes.length; k < len2; k++) {
          attribute = filteredAttributes[k];
          if (score(attribute.name, prefix) < 0.07) {
            continue;
          }
          suggestions.push({
            snippet: attribute.name,
            type: "attribute",
            rightLabel: "<" + tagName + ">",
            description: "language-babel JSXsupported attributes/events",
            descriptionMoreURL: REACTURL
          });
        }
      } else {
        return;
      }
      return suggestions;
    },
    getThisTagName: function(editor, bufferPosition) {
      var column, match, matches, row, rowText, scopes;
      row = bufferPosition.row;
      column = null;
      while (row >= 0) {
        rowText = editor.lineTextForBufferRow(row);
        if (column == null) {
          rowText = rowText.substr(0, column = bufferPosition.column);
        }
        matches = [];
        while ((match = TAGREGEXP.exec(rowText)) !== null) {
          scopes = editor.scopeDescriptorForBufferPosition([row, match.index + 1]).getScopesArray();
          if (indexOf.call(scopes, "entity.name.tag.open.jsx") >= 0) {
            matches.push(match[1]);
          }
        }
        if (matches.length) {
          return matches.pop();
        } else {
          row--;
        }
      }
    },
    getTriggerTag: function(editor, bufferPosition) {
      var column, scopes;
      column = bufferPosition.column - 1;
      if (column >= 0) {
        scopes = editor.scopeDescriptorForBufferPosition([bufferPosition.row, column]).getScopesArray();
        if (indexOf.call(scopes, "entity.other.attribute-name.jsx") >= 0) {
          return JSXATTRIBUTE;
        }
        if (indexOf.call(scopes, "entity.name.tag.open.jsx") >= 0) {
          return JSXTAG;
        }
        if (indexOf.call(scopes, "JSXStartTagEnd") >= 0) {
          return JSXSTARTTAGEND;
        }
        if (indexOf.call(scopes, "JSXEndTagStart") >= 0) {
          return JSXENDTAGSTART;
        }
      }
    },
    getStartOfJSX: function(editor, bufferPosition) {
      var column, columnLen, row;
      row = bufferPosition.row;
      while (row >= 0) {
        if (indexOf.call(editor.scopeDescriptorForBufferPosition([row, 0]).getScopesArray(), "meta.tag.jsx") < 0) {
          break;
        }
        row--;
      }
      if (row < 0) {
        row = 0;
      }
      columnLen = editor.lineTextForBufferRow(row).length;
      column = 0;
      while (column < columnLen) {
        if (indexOf.call(editor.scopeDescriptorForBufferPosition([row, column]).getScopesArray(), "meta.tag.jsx") >= 0) {
          break;
        }
        column++;
      }
      if (column === columnLen) {
        row++;
        column = 0;
      }
      return new Point(row, column);
    },
    buildTagStack: function(editor, range) {
      var closedtag, line, match, matchColumn, matchPointEnd, matchPointStart, matchRange, row, scopes, tagNameStack;
      tagNameStack = [];
      row = range.start.row;
      while (row <= range.end.row) {
        line = editor.lineTextForBufferRow(row);
        if (row === range.end.row) {
          line = line.substr(0, range.end.column);
        }
        while ((match = JSXREGEXP.exec(line)) !== null) {
          matchColumn = match.index;
          matchPointStart = new Point(row, matchColumn);
          matchPointEnd = new Point(row, matchColumn + match[0].length - 1);
          matchRange = new Range(matchPointStart, matchPointEnd);
          if (range.intersectsWith(matchRange)) {
            scopes = editor.scopeDescriptorForBufferPosition([row, match.index]).getScopesArray();
            if (indexOf.call(scopes, "punctuation.definition.tag.jsx") < 0) {
              continue;
            }
            if (match[1] != null) {
              tagNameStack.push(match[3]);
            } else if (match[2] != null) {
              closedtag = tagNameStack.pop();
              if (closedtag !== match[3]) {
                tagNameStack.push(closedtag);
              }
            } else if (match[4] != null) {
              tagNameStack.pop();
            } else if (match[6] != null) {
              tagNameStack.push("");
            }
          }
        }
        row++;
      }
      return tagNameStack;
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvbGFuZ3VhZ2UtYmFiZWwvbGliL2F1dG8tY29tcGxldGUtanN4LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLE1BQUEseUlBQUE7SUFBQTs7RUFBQSxNQUFpQixPQUFBLENBQVEsTUFBUixDQUFqQixFQUFDLGlCQUFELEVBQVE7O0VBQ1IsT0FBa0IsT0FBQSxDQUFRLFlBQVIsQ0FBbEIsRUFBQyxvQkFBRCxFQUFTOztFQUdULGNBQUEsR0FBaUI7O0VBQ2pCLGNBQUEsR0FBaUI7O0VBQ2pCLE1BQUEsR0FBUzs7RUFDVCxZQUFBLEdBQWU7O0VBRWYsU0FBQSxHQUFZOztFQUNaLFNBQUEsR0FBYTs7RUFDYixXQUFBLEdBQWMsT0FBQSxDQUFRLG1CQUFSOztFQUNkLFFBQUEsR0FBVzs7RUFFWCxNQUFNLENBQUMsT0FBUCxHQUNFO0lBQUEsUUFBQSxFQUFVLGVBQVY7SUFDQSxpQkFBQSxFQUFtQixLQURuQjtJQUVBLG9CQUFBLEVBQXNCLEtBRnRCO0lBS0EsY0FBQSxFQUFnQixTQUFDLElBQUQ7QUFDZCxVQUFBO01BQUMsb0JBQUQsRUFBUyxvQ0FBVCxFQUF5QixzQ0FBekIsRUFBMEM7TUFFMUMsTUFBQSxHQUFTLElBQUMsQ0FBQSxhQUFELENBQWUsTUFBZixFQUF1QixjQUF2QjtNQUNULElBQWMsY0FBZDtBQUFBLGVBQUE7O01BR0EsV0FBQSxHQUFjO01BRWQsSUFBRyxNQUFBLEtBQVUsY0FBYjtRQUNFLFVBQUEsR0FBYSxJQUFDLENBQUEsYUFBRCxDQUFlLE1BQWYsRUFBdUIsY0FBdkI7UUFDYixRQUFBLEdBQVcsSUFBSSxLQUFKLENBQVUsVUFBVixFQUFzQixjQUF0QjtRQUNYLFlBQUEsR0FBZSxJQUFDLENBQUEsYUFBRCxDQUFlLE1BQWYsRUFBdUIsUUFBdkI7QUFDZixlQUFNLHNDQUFOO1VBQ0UsV0FBVyxDQUFDLElBQVosQ0FD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LEdBQWMsS0FBSyxDQUFDO1VBQ3BCLGVBQUEsR0FBa0IsSUFBSSxLQUFKLENBQVUsR0FBVixFQUFlLFdBQWY7VUFDbEIsYUFBQSxHQUFnQixJQUFJLEtBQUosQ0FBVSxHQUFWLEVBQWUsV0FBQSxHQUFjLEtBQU0sQ0FBQSxDQUFBLENBQUUsQ0FBQyxNQUF2QixHQUFnQyxDQUEvQztVQUNoQixVQUFBLEdBQWEsSUFBSSxLQUFKLENBQVUsZUFBVixFQUEyQixhQUEzQjtVQUNiLElBQUcsS0FBSyxDQUFDLGNBQU4sQ0FBcUIsVUFBckIsQ0FBSDtZQUNFLE1BQUEsR0FBUyxNQUFNLENBQUMsZ0NBQVAsQ0FBd0MsQ0FBQyxHQUFELEVBQU0sS0FBSyxDQUFDLEtBQVosQ0FBeEMsQ0FBMkQsQ0FBQyxjQUE1RCxDQUFBO1lBQ1QsSUFBWSxhQUF3QyxNQUF4QyxFQUFBLGdDQUFBLEtBQVo7QUFBQSx1QkFBQTs7WUFFQSxJQUFHLGdCQUFIO2NBQ0UsWUFBWSxDQUFDLElBQWIsQ0FBa0IsS0FBTSxDQUFBLENBQUEsQ0FBeEIsRUFERjthQUFBLE1BRUssSUFBRyxnQkFBSDtjQUNILFNBQUEsR0FBWSxZQUFZLENBQUMsR0FBYixDQUFBO2NBQ1osSUFBRyxTQUFBLEtBQWUsS0FBTSxDQUFBLENBQUEsQ0FBeEI7Z0JBQ0UsWUFBWSxDQUFDLElBQWIsQ0FBa0IsU0FBbEIsRUFERjtlQUZHO2FBQUEsTUFJQSxJQUFHLGdCQUFIO2NBQ0gsWUFBWSxDQUFDLEdBQWIsQ0FBQSxFQURHO2FBQUEsTUFFQSxJQUFHLGdCQUFIO2NBQ0gsWUFBWSxDQUFDLElBQWIsQ0FBa0IsRUFBbEIsRUFERzthQVpQOztRQUxGO1FBb0JBLEdBQUE7TUF4QkY7YUF5QkE7SUE1QmEsQ0FySGY7O0FBZkYiLCJzb3VyY2VzQ29udGVudCI6WyJ7UmFuZ2UsIFBvaW50fSA9IHJlcXVpcmUgXCJhdG9tXCJcbntmaWx0ZXIsIHNjb3JlfSA9IHJlcXVpcmUgXCJmdXp6YWxkcmluXCJcblxuIyB0YWdzIHdlIGFyZSBpbnRlcmVzdGVkIGluIGFyZSBtYXJrZWQgYnkgdGhlIGdyYW1tYXJcbkpTWFNUQVJUVEFHRU5EID0gMFxuSlNYRU5EVEFHU1RBUlQgPSAxXG5KU1hUQUcgPSAyXG5KU1hBVFRSSUJVVEUgPSAzXG4jIHJlZ2V4IHRvIHNlYXJjaCBmb3IgdGFnIG9wZW4vY2xvc2UgdGFnIGFuZCBjbG9zZSB0YWdcbkpTWFJFR0VYUCA9IC8oPzooPCl8KDxcXC8pKShbJF9BLVphLXpdKD86WyQuXzpcXC1hLXpBLVowLTldKSopfCg/OihcXC8+KXwoPikpfCg8XFxzKj4pL2dcblRBR1JFR0VYUCA9ICAvPChbJF9hLXpBLVpdWyQuXzpcXC1hLXpBLVowLTldKikoJHxcXHN8XFwvPnw+KS9nXG5DT01QTEVUSU9OUyA9IHJlcXVpcmUgXCIuL2NvbXBsZXRpb25zLWpzeFwiXG5SRUFDVFVSTCA9IFwiaHR0cDovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RhZ3MtYW5kLWF0dHJpYnV0ZXMuaHRtbFwiXG5cbm1vZHVsZS5leHBvcnRzID1cbiAgc2VsZWN0b3I6IFwiLm1ldGEudGFnLmpzeFwiXG4gIGluY2x1c2lvblByaW9yaXR5OiAxMDAwMFxuICBleGNsdWRlTG93ZXJQcmlvcml0eTogZmFsc2VcblxuXG4gIGdldFN1Z2dlc3Rpb25zOiAob3B0cykgLT5cbiAgICB7ZWRpdG9yLCBidWZmZXJQb3NpdGlvbiwgc2NvcGVEZXNjcmlwdG9yLCBwcmVmaXh9ID0gb3B0c1xuXG4gICAganN4VGFnID0gQGdldFRyaWdnZXJUYWcgZWRpdG9yLCBidWZmZXJQb3NpdGlvblxuICAgIHJldHVybiBpZiBub3QganN4VGFnP1xuXG4gICAgIyBidWlsZCBhdXRvY29tcGxldGUgbGlzdFxuICAgIHN1Z2dlc3Rpb25zID0gW11cblxuICAgIGlmIGpzeFRhZyBpcyBKU1hTVEFSVFRBR0VORFxuICAgICAgc3RhcnRPZkpTWCA9IEBnZXRTdGFydE9mSlNYIGVkaXRvciwgYnVmZmVyUG9zaXRpb25cbiAgICAgIGpzeFJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0T2ZKU1gsIGJ1ZmZlclBvc2l0aW9uKVxuICAgICAgdGFnTmFtZVN0YWNrID0gQGJ1aWxkVGFnU3RhY2soZWRpdG9yLCBqc3hSYW5nZSlcbiAgICAgIHdoaWxlICggdGFnTmFtZSA9IHRhZ05hbWVTdGFjay5wb3AoKSk/XG4gICAgICAgIHN1Z2dlc3Rpb25zLnB1c2hcbiAgICAgICAgICBzbmlwcGV0OiBcIiQxPC8je3RhZ05hbWV9PlwiXG4gICAgICAgICAgdHlwZTogXCJ0YWdcIlxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBcImxhbmd1YWdlLWJhYmVsIHRhZyBjbG9zZXJcIlxuXG4gICAgZWxzZSBpZiAganN4VGFnIGlzIEpTWEVORFRBR1NUQVJUXG4gICAgICBzdGFydE9mSlNYID0gQGdldFN0YXJ0T2ZKU1ggZWRpdG9yLCBidWZmZXJQb3NpdGlvblxuICAgICAganN4UmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnRPZkpTWCwgYnVmZmVyUG9zaXRpb24pXG4gICAgICB0YWdOYW1lU3RhY2sgPSBAYnVpbGRUYWdTdGFjayhlZGl0b3IsIGpzeFJhbmdlKVxuICAgICAgd2hpbGUgKCB0YWdOYW1lID0gdGFnTmFtZVN0YWNrLnBvcCgpKT9cbiAgICAgICAgc3VnZ2VzdGlvbnMucHVzaFxuICAgICAgICAgIHNuaXBwZXQ6IFwiI3t0YWdOYW1lfT5cIlxuICAgICAgICAgIHR5cGU6IFwidGFnXCJcbiAgICAgICAgICBkZXNjcmlwdGlvbjogXCJsYW5ndWFnZS1iYWJlbCB0YWcgY2xvc2VyXCJcblxuICAgIGVsc2UgaWYganN4VGFnIGlzIEpTWFRBR1xuICAgICAgcmV0dXJuIGlmIG5vdCAvXlthLXpdL2cuZXhlYyhwcmVmaXgpXG4gICAgICBodG1sRWxlbWVudHMgPSBmaWx0ZXIoQ09NUExFVElPTlMuaHRtbEVsZW1lbnRzLCBwcmVmaXgsIHtrZXk6IFwibmFtZVwifSlcbiAgICAgIGZvciBodG1sRWxlbWVudCBpbiBodG1sRWxlbWVudHNcbiAgICAgICAgaWYgc2NvcmUoaHRtbEVsZW1lbnQubmFtZSwgcHJlZml4KSA8IDAuMDcgdGhlbiBjb250aW51ZVxuICAgICAgICBzdWdnZXN0aW9ucy5wdXNoXG4gICAgICAgICAgc25pcHBldDogaHRtbEVsZW1lbnQubmFtZVxuICAgICAgICAgIHR5cGU6IFwidGFnXCJcbiAgICAgICAgICBkZXNjcmlwdGlvbjogXCJsYW5ndWFnZS1iYWJlbCBKU1ggc3VwcG9ydGVkIGVsZW1lbnRzXCJcbiAgICAgICAgICBkZXNjcmlwdGlvbk1vcmVVUkw6IFJFQUNUVVJMXG5cbiAgICBlbHNlIGlmIGpzeFRhZyBpcyBKU1hBVFRSSUJVVEVcbiAgICAgIHRhZ05hbWUgPSBAZ2V0VGhpc1RhZ05hbWUgZWRpdG9yLCBidWZmZXJQb3NpdGlvblxuICAgICAgcmV0dXJuIGlmIG5vdCB0YWdOYW1lP1xuICAgICAgZm9yIGVsZW1lbnRPYmogaW4gQ09NUExFVElPTlMuaHRtbEVsZW1lbnRzXG4gICAgICAgIGlmIGVsZW1lbnRPYmoubmFtZSBpcyB0YWdOYW1lIHRoZW4gYnJlYWtcbiAgICAgIGF0dHJpYnV0ZXMgPSBlbGVtZW50T2JqLmF0dHJpYnV0ZXMuY29uY2F0IENPTVBMRVRJT05TLmdsb2JhbEF0dHJpYnV0ZXNcbiAgICAgIGF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzLmNvbmNhdCBDT01QTEVUSU9OUy5ldmVudHNcbiAgICAgIGZpbHRlcmVkQXR0cmlidXRlcyA9IGZpbHRlcihhdHRyaWJ1dGVzLCBwcmVmaXgsIHtrZXk6IFwibmFtZVwifSlcbiAgICAgIGZvciBhdHRyaWJ1dGUgaW4gZmlsdGVyZWRBdHRyaWJ1dGVzXG4gICAgICAgIGlmIHNjb3JlKGF0dHJpYnV0ZS5uYW1lLCBwcmVmaXgpIDwgMC4wNyB0aGVuIGNvbnRpbnVlXG4gICAgICAgIHN1Z2dlc3Rpb25zLnB1c2hcbiAgICAgICAgICBzbmlwcGV0OiBhdHRyaWJ1dGUubmFtZVxuICAgICAgICAgIHR5cGU6IFwiYXR0cmlidXRlXCJcbiAgICAgICAgICByaWdodExhYmVsOiBcIjwje3RhZ05hbWV9PlwiXG4gICAgICAgICAgZGVzY3JpcHRpb246IFwibGFuZ3VhZ2UtYmFiZWwgSlNYc3VwcG9ydGVkIGF0dHJpYnV0ZXMvZXZlbnRzXCJcbiAgICAgICAgICBkZXNjcmlwdGlvbk1vcmVVUkw6IFJFQUNUVVJMXG5cbiAgICBlbHNlIHJldHVyblxuICAgIHN1Z2dlc3Rpb25zXG5cbiAgIyBnZXQgdGFnbmFtZSBmb3IgdGhpcyBhdHRyaWJ1dGVcbiAgZ2V0VGhpc1RhZ05hbWU6ICggZWRpdG9yLCBidWZmZXJQb3NpdGlvbikgLT5cbiAgICByb3cgPSBidWZmZXJQb3NpdGlvbi5yb3dcbiAgICBjb2x1bW4gPSBudWxsXG4gICAgd2hpbGUgcm93ID49IDBcbiAgICAgIHJvd1RleHQgPSBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cocm93KVxuICAgICAgaWYgbm90IGNvbHVtbj9cbiAgICAgICAgcm93VGV4dCA9IHJvd1RleHQuc3Vic3RyIDAsIGNvbHVtbiA9IGJ1ZmZlclBvc2l0aW9uLmNvbHVtblxuICAgICAgbWF0Y2hlcyA9IFtdXG4gICAgICB3aGlsZSAoKCBtYXRjaCA9IFRBR1JFR0VYUC5leGVjKHJvd1RleHQpKSBpc250IG51bGwgKVxuICAgICAgICAjIHNhdmUgdGhpcyBtYXRjaCBpZiBpdCBhIHZhbGlkIHRhZ1xuICAgICAgICBzY29wZXMgPSBlZGl0b3Iuc2NvcGVEZXNjcmlwdG9yRm9yQnVmZmVyUG9zaXRpb24oW3JvdywgbWF0Y2guaW5kZXgrMV0pLmdldFNjb3Blc0FycmF5KClcbiAgICAgICAgaWYgXCJlbnRpdHkubmFtZS50YWcub3Blbi5qc3hcIiBpbiBzY29wZXMgdGhlbiBtYXRjaGVzLnB1c2ggbWF0Y2hbMV1cbiAgICAgICMgcmV0dXJuIHRoZSB0YWcgdGhhdCBpcyB0aGUgbGFzdCBvbmUgZm91bmRcbiAgICAgIGlmIG1hdGNoZXMubGVuZ3RoXG4gICAgICAgIHJldHVybiBtYXRjaGVzLnBvcCgpXG4gICAgICBlbHNlIHJvdy0tXG5cblxuICBnZXRUcmlnZ2VyVGFnOiAoZWRpdG9yLCBidWZmZXJQb3NpdGlvbikgLT5cbiAgICAjIEpTWCB0YWcgc2NvcGVzIHdlIGFyZSBpbnRlcmVzdGVkIGluIG1heSBhbHJlYWR5IGNsb3NlZCBvbmNlIHR5cGVkXG4gICAgIyBzbyB3ZSBoYXZlIHRvIGJhY2t0cmFjayBieSBvbmUgY2hhciB0byBzZWUgaWYgdGhleSB3ZXJlIHR5cGVkXG4gICAgY29sdW1uID0gYnVmZmVyUG9zaXRpb24uY29sdW1uLTFcbiAgICBpZiBjb2x1bW4gPj0gMFxuICAgICAgc2NvcGVzID0gZWRpdG9yLnNjb3BlRGVzY3JpcHRvckZvckJ1ZmZlclBvc2l0aW9uKFtidWZmZXJQb3NpdGlvbi5yb3csIGNvbHVtbl0pLmdldFNjb3Blc0FycmF5KClcbiAgICAgIGlmIFwiZW50aXR5Lm90aGVyLmF0dHJpYnV0ZS1uYW1lLmpzeFwiIGluIHNjb3BlcyB0aGVuIHJldHVybiBKU1hBVFRSSUJVVEVcbiAgICAgIGlmIFwiZW50aXR5Lm5hbWUudGFnLm9wZW4uanN4XCIgaW4gc2NvcGVzIHRoZW4gcmV0dXJuIEpTWFRBR1xuICAgICAgaWYgXCJKU1hTdGFydFRhZ0VuZFwiIGluIHNjb3BlcyB0aGVuIHJldHVybiBKU1hTVEFSVFRBR0VORFxuICAgICAgaWYgXCJKU1hFbmRUYWdTdGFydFwiIGluIHNjb3BlcyB0aGVuIHJldHVybiBKU1hFTkRUQUdTVEFSVFxuXG5cbiAgIyBmaW5kIGJlZ2dpbmluZyBvZiBKU1ggaW4gYnVmZmVyIGFuZCByZXR1cm4gUG9pbnRcbiAgZ2V0U3RhcnRPZkpTWDogKGVkaXRvciwgYnVmZmVyUG9zaXRpb24pIC0+XG4gICAgcm93ID0gYnVmZmVyUG9zaXRpb24ucm93XG4gICAgIyBmaW5kIHByZXZpb3VzIHN0YXJ0IG9mIHJvdyB0aGF0IGhhcyBubyBqc3ggdGFnXG4gICAgd2hpbGUgcm93ID49IDBcbiAgICAgIGJyZWFrIGlmIFwibWV0YS50YWcuanN4XCIgbm90IGluIGVkaXRvci5zY29wZURlc2NyaXB0b3JGb3JCdWZmZXJQb3NpdGlvbihbcm93LCAwXSkuZ2V0U2NvcGVzQXJyYXkoKVxuICAgICAgcm93LS1cbiAgICBpZiByb3cgPCAwIHRoZW4gcm93ID0gMFxuICAgICMgbWF5YmUganN4IGFwcGFlYXJzIGxhdGVyIGluIHJvd1xuICAgIGNvbHVtbkxlbiA9IGVkaXRvci5saW5lVGV4dEZvckJ1ZmZlclJvdyhyb3cpLmxlbmd0aFxuICAgIGNvbHVtbiA9IDBcbiAgICB3aGlsZSBjb2x1bW4gPCBjb2x1bW5MZW5cbiAgICAgIGJyZWFrIGlmIFwibWV0YS50YWcuanN4XCIgaW4gZWRpdG9yLnNjb3BlRGVzY3JpcHRvckZvckJ1ZmZlclBvc2l0aW9uKFtyb3csIGNvbHVtbl0pLmdldFNjb3Blc0FycmF5KClcbiAgICAgIGNvbHVtbisrXG4gICAgIyBhZGp1c3Qgcm93IGNvbHVtbiBpZiBqc3ggbm90IGluIHRoaXMgcm93IGF0IGFsbFxuICAgIGlmIGNvbHVtbiBpcyBjb2x1bW5MZW5cbiAgICAgIHJvdysrXG4gICAgICBjb2x1bW4gPSAwXG4gICAgbmV3IFBvaW50KHJvdywgY29sdW1uKVxuXG4gICMgYnVpbGQgc3RhY2sgb2YgdGFnbmFtZXMgb3BlbmVkIGJ1dCBub3QgY2xvc2VkIGluIFJhbmdlXG4gIGJ1aWxkVGFnU3RhY2s6IChlZGl0b3IsIHJhbmdlKSAtPlxuICAgIHRhZ05hbWVTdGFjayA9IFtdXG4gICAgcm93ID0gcmFuZ2Uuc3RhcnQucm93XG4gICAgd2hpbGUgcm93IDw9IHJhbmdlLmVuZC5yb3dcbiAgICAgIGxpbmUgPSBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cgcm93XG4gICAgICBpZiByb3cgaXMgcmFuZ2UuZW5kLnJvd1xuICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIgMCwgcmFuZ2UuZW5kLmNvbHVtblxuICAgICAgd2hpbGUgKCggbWF0Y2ggPSBKU1hSRUdFWFAuZXhlYyhsaW5lKSkgaXNudCBudWxsIClcbiAgICAgICAgbWF0Y2hDb2x1bW4gPSBtYXRjaC5pbmRleFxuICAgICAgICBtYXRjaFBvaW50U3RhcnQgPSBuZXcgUG9pbnQocm93LCBtYXRjaENvbHVtbilcbiAgICAgICAgbWF0Y2hQb2ludEVuZCA9IG5ldyBQb2ludChyb3csIG1hdGNoQ29sdW1uICsgbWF0Y2hbMF0ubGVuZ3RoIC0gMSlcbiAgICAgICAgbWF0Y2hSYW5nZSA9IG5ldyBSYW5nZShtYXRjaFBvaW50U3RhcnQsIG1hdGNoUG9pbnRFbmQpXG4gICAgICAgIGlmIHJhbmdlLmludGVyc2VjdHNXaXRoKG1hdGNoUmFuZ2UpXG4gICAgICAgICAgc2NvcGVzID0gZWRpdG9yLnNjb3BlRGVzY3JpcHRvckZvckJ1ZmZlclBvc2l0aW9uKFtyb3csIG1hdGNoLmluZGV4XSkuZ2V0U2NvcGVzQXJyYXkoKVxuICAgICAgICAgIGNvbnRpbnVlIGlmIFwicHVuY3R1YXRpb24uZGVmaW5pdGlvbi50YWcuanN4XCIgbm90IGluIHNjb3Blc1xuICAgICAgICAgICNjaGVjayBjYXB0dXJlIGdyb3Vwc1xuICAgICAgICAgIGlmIG1hdGNoWzFdPyAjIHRhZ3Mgc3RhcnRpbmcgPHRhZ1xuICAgICAgICAgICAgdGFnTmFtZVN0YWNrLnB1c2ggbWF0Y2hbM11cbiAgICAgICAgICBlbHNlIGlmIG1hdGNoWzJdPyAjIHRhZ3MgZW5kaW5nIDwvdGFnXG4gICAgICAgICAgICBjbG9zZWR0YWcgPSB0YWdOYW1lU3RhY2sucG9wKClcbiAgICAgICAgICAgIGlmIGNsb3NlZHRhZyBpc250IG1hdGNoWzNdXG4gICAgICAgICAgICAgIHRhZ05hbWVTdGFjay5wdXNoIGNsb3NlZHRhZ1xuICAgICAgICAgIGVsc2UgaWYgbWF0Y2hbNF0/ICMgdGFncyBhbmQgZnJhZ21lbnRzIGVuZGluZyAvPlxuICAgICAgICAgICAgdGFnTmFtZVN0YWNrLnBvcCgpXG4gICAgICAgICAgZWxzZSBpZiBtYXRjaFs2XT8gIyB0YWcgZnJhZ21lbnQgc3RhdGluZyA8PlxuICAgICAgICAgICAgdGFnTmFtZVN0YWNrLnB1c2ggXCJcIlxuXG4gICAgICByb3crK1xuICAgIHRhZ05hbWVTdGFja1xuIl19
