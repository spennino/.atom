(function() {
  var cssDocsURL, firstCharsEqual, firstInlinePropertyNameWithColonPattern, fs, hasScope, importantPrefixPattern, inlinePropertyNameWithColonPattern, lineEndsWithSemicolon, makeSnippet, path, pesudoSelectorPrefixPattern, propertyNamePrefixPattern, propertyNameWithColonPattern, tagSelectorPrefixPattern;

  fs = require('fs');

  path = require('path');

  firstInlinePropertyNameWithColonPattern = /{\s*(\S+)\s*:/;

  inlinePropertyNameWithColonPattern = /(?:;.+?)*;\s*(\S+)\s*:/;

  propertyNameWithColonPattern = /^\s*(\S+)\s*:/;

  propertyNamePrefixPattern = /[a-zA-Z]+[-a-zA-Z]*$/;

  pesudoSelectorPrefixPattern = /:(:)?([a-z]+[a-z-]*)?$/;

  tagSelectorPrefixPattern = /(^|\s|,)([a-z]+)?$/;

  importantPrefixPattern = /(![a-z]+)$/;

  cssDocsURL = "https://developer.mozilla.org/en-US/docs/Web/CSS";

  module.exports = {
    selector: '.source.inside-js.css.styled, .source.css.styled',
    disableForSelector: ".source.inside-js.css.styled .comment, .source.inside-js.css.styled .string, .source.inside-js.css.styled .entity.quasi.element.js, .source.css.styled .comment, .source.css.styled .string, .source.css.styled .entity.quasi.element.js",
    filterSuggestions: true,
    inclusionPriority: 10000,
    excludeLowerPriority: false,
    suggestionPriority: 90,
    getSuggestions: function(request) {
      var completions, scopes;
      completions = null;
      scopes = request.scopeDescriptor.getScopesArray();
      if (this.isCompletingValue(request)) {
        completions = this.getPropertyValueCompletions(request);
      } else if (this.isCompletingPseudoSelector(request)) {
        completions = this.getPseudoSelectorCompletions(request);
      } else {
        if (this.isCompletingName(request)) {
          completions = this.getPropertyNameCompletions(request);
        } else if (this.isCompletingNameOrTag(request)) {
          completions = this.getPropertyNameCompletions(request).concat(this.getTagCompletions(request));
        }
      }
      return completions;
    },
    onDidInsertSuggestion: function(arg) {
      var editor, suggestion;
      editor = arg.editor, suggestion = arg.suggestion;
      if (suggestion.type === 'property') {
        return setTimeout(this.triggerAutocomplete.bind(this, editor), 1);
      }
    },
    triggerAutocomplete: function(editor) {
      return atom.commands.dispatch(atom.views.getView(editor), 'autocomplete-plus:activate', {
        activatedManually: false
      });
    },
    loadProperties: function() {
      this.properties = {};
      return fs.readFile(path.resolve(__dirname, 'completions.json'), (function(_this) {
        return function(error, content) {
          var ref;
          if (error == null) {
            ref = JSON.parse(content), _this.pseudoSelectors = ref.pseudoSelectors, _this.properties = ref.properties, _this.tags = ref.tags;
          }
        };
      })(this));
    },
    isCompletingValue: function(arg) {
      var beforePrefixBufferPosition, beforePrefixScopes, beforePrefixScopesArray, bufferPosition, editor, prefix, scopeDescriptor, scopes;
      scopeDescriptor = arg.scopeDescriptor, bufferPosition = arg.bufferPosition, prefix = arg.prefix, editor = arg.editor;
      scopes = scopeDescriptor.getScopesArray();
      beforePrefixBufferPosition = [bufferPosition.row, Math.max(0, bufferPosition.column - prefix.length - 1)];
      beforePrefixScopes = editor.scopeDescriptorForBufferPosition(beforePrefixBufferPosition);
      beforePrefixScopesArray = beforePrefixScopes.getScopesArray();
      return (hasScope(scopes, 'meta.property-values.css')) || (hasScope(beforePrefixScopesArray, 'meta.property-values.css'));
    },
    isCompletingName: function(arg) {
      var bufferPosition, editor, prefix, scope, scopeDescriptor;
      scopeDescriptor = arg.scopeDescriptor, bufferPosition = arg.bufferPosition, editor = arg.editor;
      scope = scopeDescriptor.getScopesArray().slice(-1);
      prefix = this.getPropertyNamePrefix(bufferPosition, editor);
      return this.isPropertyNamePrefix(prefix) && (scope[0] === 'meta.property-list.css');
    },
    isCompletingNameOrTag: function(arg) {
      var bufferPosition, editor, prefix, scope, scopeDescriptor;
      scopeDescriptor = arg.scopeDescriptor, bufferPosition = arg.bufferPosition, editor = arg.editor;
      scope = scopeDescriptor.getScopesArray().slice(-1);
      prefix = this.getPropertyNamePrefix(bufferPosition, editor);
      return this.isPropertyNamePrefix(prefix) && ((scope[0] === 'meta.property-list.css') || (scope[0] === 'source.css.styled') || (scope[0] === 'entity.name.tag.css') || (scope[0] === 'source.inside-js.css.styled'));
    },
    isCompletingPseudoSelector: function(arg) {
      var bufferPosition, editor, scope, scopeDescriptor;
      editor = arg.editor, scopeDescriptor = arg.scopeDescriptor, bufferPosition = arg.bufferPosition;
      scope = scopeDescriptor.getScopesArray().slice(-1);
      return (scope[0] === 'constant.language.pseudo.prefixed.css') || (scope[0] === 'keyword.operator.pseudo.css');
    },
    isPropertyValuePrefix: function(prefix) {
      prefix = prefix.trim();
      return prefix.length > 0 && prefix !== ':';
    },
    isPropertyNamePrefix: function(prefix) {
      if (prefix == null) {
        return false;
      }
      prefix = prefix.trim();
      return prefix.match(/^[a-zA-Z-]+$/);
    },
    getImportantPrefix: function(editor, bufferPosition) {
      var line, ref;
      line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
      return (ref = importantPrefixPattern.exec(line)) != null ? ref[1] : void 0;
    },
    getPreviousPropertyName: function(bufferPosition, editor) {
      var line, propertyName, ref, ref1, ref2, row;
      row = bufferPosition.row;
      while (row >= 0) {
        line = editor.lineTextForBufferRow(row);
        propertyName = (ref = inlinePropertyNameWithColonPattern.exec(line)) != null ? ref[1] : void 0;
        if (propertyName == null) {
          propertyName = (ref1 = firstInlinePropertyNameWithColonPattern.exec(line)) != null ? ref1[1] : void 0;
        }
        if (propertyName == null) {
          propertyName = (ref2 = propertyNameWithColonPattern.exec(line)) != null ? ref2[1] : void 0;
        }
        if (propertyName) {
          return propertyName;
        }
        row--;
      }
    },
    getPropertyValueCompletions: function(arg) {
      var addSemicolon, bufferPosition, completions, editor, i, importantPrefix, j, len, len1, prefix, property, ref, scopeDescriptor, scopes, value, values;
      bufferPosition = arg.bufferPosition, editor = arg.editor, prefix = arg.prefix, scopeDescriptor = arg.scopeDescriptor;
      property = this.getPreviousPropertyName(bufferPosition, editor);
      values = (ref = this.properties[property]) != null ? ref.values : void 0;
      if (values == null) {
        return null;
      }
      scopes = scopeDescriptor.getScopesArray();
      addSemicolon = !lineEndsWithSemicolon(bufferPosition, editor);
      completions = [];
      if (this.isPropertyValuePrefix(prefix)) {
        for (i = 0, len = values.length; i < len; i++) {
          value = values[i];
          if (firstCharsEqual(value, prefix)) {
            completions.push(this.buildPropertyValueCompletion(value, property, addSemicolon));
          }
        }
      } else {
        for (j = 0, len1 = values.length; j < len1; j++) {
          value = values[j];
          completions.push(this.buildPropertyValueCompletion(value, property, addSemicolon));
        }
      }
      if (importantPrefix = this.getImportantPrefix(editor, bufferPosition)) {
        completions.push({
          type: 'keyword',
          text: '!important',
          displayText: '!important',
          replacementPrefix: importantPrefix,
          description: "Forces this property to override any other declaration of the same property. Use with caution.",
          descriptionMoreURL: cssDocsURL + "/Specificity#The_!important_exception"
        });
      }
      return completions;
    },
    buildPropertyValueCompletion: function(value, propertyName, addSemicolon) {
      var text;
      text = value;
      if (addSemicolon) {
        text += ';';
      }
      text = makeSnippet(text);
      return {
        type: 'value',
        snippet: text,
        displayText: value,
        description: value + " value for the " + propertyName + " property",
        descriptionMoreURL: cssDocsURL + "/" + propertyName + "#Values"
      };
    },
    getPropertyNamePrefix: function(bufferPosition, editor) {
      var line, ref;
      line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
      return (ref = propertyNamePrefixPattern.exec(line)) != null ? ref[0] : void 0;
    },
    getPropertyNameCompletions: function(arg) {
      var activatedManually, bufferPosition, completions, editor, line, options, prefix, property, ref, scopeDescriptor, scopes;
      bufferPosition = arg.bufferPosition, editor = arg.editor, scopeDescriptor = arg.scopeDescriptor, activatedManually = arg.activatedManually;
      scopes = scopeDescriptor.getScopesArray();
      line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
      prefix = this.getPropertyNamePrefix(bufferPosition, editor);
      if (!(activatedManually || prefix)) {
        return [];
      }
      completions = [];
      ref = this.properties;
      for (property in ref) {
        options = ref[property];
        if (!prefix || firstCharsEqual(property, prefix)) {
          completions.push(this.buildPropertyNameCompletion(property, prefix, options));
        }
      }
      return completions;
    },
    buildPropertyNameCompletion: function(propertyName, prefix, arg) {
      var description;
      description = arg.description;
      return {
        type: 'property',
        text: propertyName + ": ",
        displayText: propertyName,
        replacementPrefix: prefix,
        description: description,
        descriptionMoreURL: cssDocsURL + "/" + propertyName
      };
    },
    getPseudoSelectorPrefix: function(editor, bufferPosition) {
      var line, ref;
      line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
      return (ref = line.match(pesudoSelectorPrefixPattern)) != null ? ref[0] : void 0;
    },
    getPseudoSelectorCompletions: function(arg) {
      var bufferPosition, completions, editor, options, prefix, pseudoSelector, ref;
      bufferPosition = arg.bufferPosition, editor = arg.editor;
      prefix = this.getPseudoSelectorPrefix(editor, bufferPosition);
      if (!prefix) {
        return null;
      }
      completions = [];
      ref = this.pseudoSelectors;
      for (pseudoSelector in ref) {
        options = ref[pseudoSelector];
        if (firstCharsEqual(pseudoSelector, prefix)) {
          completions.push(this.buildPseudoSelectorCompletion(pseudoSelector, prefix, options));
        }
      }
      return completions;
    },
    buildPseudoSelectorCompletion: function(pseudoSelector, prefix, arg) {
      var argument, completion, description;
      argument = arg.argument, description = arg.description;
      completion = {
        type: 'pseudo-selector',
        replacementPrefix: prefix,
        description: description,
        descriptionMoreURL: cssDocsURL + "/" + pseudoSelector
      };
      if (argument != null) {
        completion.snippet = pseudoSelector + "(${1:" + argument + "})";
      } else {
        completion.text = pseudoSelector;
      }
      return completion;
    },
    getTagSelectorPrefix: function(editor, bufferPosition) {
      var line, ref;
      line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
      return (ref = tagSelectorPrefixPattern.exec(line)) != null ? ref[2] : void 0;
    },
    getTagCompletions: function(arg) {
      var bufferPosition, completions, editor, i, len, prefix, ref, tag;
      bufferPosition = arg.bufferPosition, editor = arg.editor, prefix = arg.prefix;
      completions = [];
      if (prefix) {
        ref = this.tags;
        for (i = 0, len = ref.length; i < len; i++) {
          tag = ref[i];
          if (firstCharsEqual(tag, prefix)) {
            completions.push(this.buildTagCompletion(tag));
          }
        }
      }
      return completions;
    },
    buildTagCompletion: function(tag) {
      return {
        type: 'tag',
        text: tag,
        description: "Selector for <" + tag + "> elements"
      };
    }
  };

  lineEndsWithSemicolon = function(bufferPosition, editor) {
    var line, row;
    row = bufferPosition.row;
    line = editor.lineTextForBufferRow(row);
    return /;\s*$/.test(line);
  };

  hasScope = function(scopesArray, scope) {
    return scopesArray.indexOf(scope) !== -1;
  };

  firstCharsEqual = function(str1, str2) {
    return str1[0].toLowerCase() === str2[0].toLowerCase();
  };

  makeSnippet = function(text) {
    var snippetNumber;
    snippetNumber = 0;
    while (text.includes('()')) {
      text = text.replace('()', "($" + (++snippetNumber) + ")");
    }
    text = text + ("$" + (++snippetNumber));
    return text;
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvbGFuZ3VhZ2UtYmFiZWwvbGliL2F1dG8tY29tcGxldGUtc3R5bGVkLWNvbXBvbmVudHMuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUtBO0FBQUEsTUFBQTs7RUFBQSxFQUFBLEdBQUssT0FBQSxDQUFRLElBQVI7O0VBQ0wsSUFBQSxHQUFPLE9BQUEsQ0FBUSxNQUFSOztFQUVQLHVDQUFBLEdBQTBDOztFQUMxQyxrQ0FBQSxHQUFxQzs7RUFDckMsNEJBQUEsR0FBK0I7O0VBQy9CLHlCQUFBLEdBQTRCOztFQUM1QiwyQkFBQSxHQUE4Qjs7RUFDOUIsd0JBQUEsR0FBMkI7O0VBQzNCLHNCQUFBLEdBQXlCOztFQUN6QixVQUFBLEdBQWE7O0VBRWIsTUFBTSxDQUFDLE9BQVAsR0FDRTtJQUFBLFFBQUEsRUFBVSxrREFBVjtJQUNBLGtCQUFBLEVBQW9CLDBPQURwQjtJQUdBLGlCQUFBLEVBQW1CLElBSG5CO0lBSUEsaUJBQUEsRUFBbUIsS0FKbkI7SUFLQSxvQkFBQSxFQUFzQixLQUx0QjtJQU1BLGtCQUFBLEVBQW9CLEVBTnBCO0lBUUEsY0FBQSxFQUFnQixTQUFDLE9BQUQ7QUFDZCxVQUFBO01BQUEsV0FBQSxHQUFjO01BQ2QsTUFBQSxHQUFTLE9BQU8sQ0FBQyxlQUFlLENBQUMsY0FBeEIsQ0FBQTtNQUVULElBQUcsSUFBQyxDQUFBLGlCQUFELENBQW1CLE9BQW5CLENBQUg7UUFDRSxXQUFBLEdBQWMsSUFBQyxDQUFBLDJCQUFELENBQTZCLE9BQTdCLEVBRGhCO09BQUEsTUFFSyxJQUFHLElBQUMsQ0FBQSwwQkFBRCxDQUE0QixPQUE1QixDQUFIO1FBQ0gsV0FBQSxHQUFjLElBQUMsQ0FBQSw0QkFBRCxDQUE4QixPQUE5QixFQURYO09BQUEsTUFBQTtRQUdILElBQUcsSUFBQyxDQUFBLGdCQUFELENBQWtCLE9BQWxCLENBQUg7VUFDRSxXQUFB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IGJhc2VkIHVwb24gaHR0cHM6Ly9naXRodWIuY29tL2F0b20vYXV0b2NvbXBsZXRlLWNzcyBidXQgaGFzIGJlZW4gbW9kaWZpZWQgdG8gYWxsb3cgaXQgdG8gYmUgdXNlZFxuIyBmb3Igc3R5bGVkLWNvbXBvbmVuZXRzLiBUaGUgY29tcGxldGlvbnMuanNvbiBmaWxlIHVzZWQgdG8gYXV0byBjb21wbGV0ZSBpcyBhIGNvcHkgb2YgdGhlIG9uZSB1c2VkIGJ5IHRoZSBhdG9tXG4jIHBhY2thZ2UuIFRoYXQgcGFja2FnZSwgcHJvdmlkZWQgYXMgYW4gQXRvbSBiYXNlIHBhY2thZ2UsIGhhcyB0b29scyB0byB1cGRhdGUgdGhlIGNvbXBsZXRpb25zLmpzb24gZmlsZSBmcm9tIHRoZSB3ZWIuXG4jIFNlZSB0aGF0IHBhY2thZ2UgZm9yIG1vcmUgaW5mbyBhbmQganVzdCBjb3B5IHRoZSBjb21wbGV0aW9ucy5qc29uIHRvIHRoaXMgZmlsZXMgZGlyZWN0b3J5IHdoZW4gYSByZWZyZXNoIGlzIG5lZWRlZC5cblxuZnMgPSByZXF1aXJlICdmcydcbnBhdGggPSByZXF1aXJlICdwYXRoJ1xuXG5maXJzdElubGluZVByb3BlcnR5TmFtZVdpdGhDb2xvblBhdHRlcm4gPSAve1xccyooXFxTKylcXHMqOi8gIyAuZXhhbXBsZSB7IGRpc3BsYXk6IH1cbmlubGluZVByb3BlcnR5TmFtZVdpdGhDb2xvblBhdHRlcm4gPSAvKD86Oy4rPykqO1xccyooXFxTKylcXHMqOi8gIyAuZXhhbXBsZSB7IGRpc3BsYXk6IGJsb2NrOyBmbG9hdDogbGVmdDsgY29sb3I6IH0gKG1hdGNoIHRoZSBsYXN0IG9uZSlcbnByb3BlcnR5TmFtZVdpdGhDb2xvblBhdHRlcm4gPSAvXlxccyooXFxTKylcXHMqOi8gIyBkaXNwbGF5OlxucHJvcGVydHlOYW1lUHJlZml4UGF0dGVybiA9IC9bYS16QS1aXStbLWEtekEtWl0qJC9cbnBlc3Vkb1NlbGVjdG9yUHJlZml4UGF0dGVybiA9IC86KDopPyhbYS16XStbYS16LV0qKT8kL1xudGFnU2VsZWN0b3JQcmVmaXhQYXR0ZXJuID0gLyhefFxcc3wsKShbYS16XSspPyQvXG5pbXBvcnRhbnRQcmVmaXhQYXR0ZXJuID0gLyghW2Etel0rKSQvXG5jc3NEb2NzVVJMID0gXCJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1NcIlxuXG5tb2R1bGUuZXhwb3J0cyA9XG4gIHNlbGVjdG9yOiAnLnNvdXJjZS5pbnNpZGUtanMuY3NzLnN0eWxlZCwgLnNvdXJjZS5jc3Muc3R5bGVkJ1xuICBkaXNhYmxlRm9yU2VsZWN0b3I6IFwiLnNvdXJjZS5pbnNpZGUtanMuY3NzLnN0eWxlZCAuY29tbWVudCwgLnNvdXJjZS5pbnNpZGUtanMuY3NzLnN0eWxlZCAuc3RyaW5nLCAuc291cmNlLmluc2lkZS1qcy5jc3Muc3R5bGVkIC5lbnRpdHkucXVhc2kuZWxlbWVudC5qcywgLnNvdXJjZS5jc3Muc3R5bGVkIC5jb21tZW50LCAuc291cmNlLmNzcy5zdHlsZWQgLnN0cmluZywgLnNvdXJjZS5jc3Muc3R5bGVkIC5lbnRpdHkucXVhc2kuZWxlbWVudC5qc1wiXG5cbiAgZmlsdGVyU3VnZ2VzdGlvbnM6IHRydWVcbiAgaW5jbHVzaW9uUHJpb3JpdHk6IDEwMDAwXG4gIGV4Y2x1ZGVMb3dlclByaW9yaXR5OiBmYWxzZVxuICBzdWdnZXN0aW9uUHJpb3JpdHk6IDkwXG5cbiAgZ2V0U3VnZ2VzdGlvbnM6IChyZXF1ZXN0KSAtPlxuICAgIGNvbXBsZXRpb25zID0gbnVsbFxuICAgIHNjb3BlcyA9IHJlcXVlc3Quc2NvcGVEZXNjcmlwdG9yLmdldFNjb3Blc0FycmF5KClcblxuICAgIGlmIEBpc0NvbXBsZXRpbmdWYWx1ZShyZXF1ZXN0KVxuICAgICAgY29tcGxldGlvbnMgPSBAZ2V0UHJvcGVydHlWYWx1ZUNvbXBsZXRpb25zKHJlcXVlc3QpXG4gICAgZWxzZSBpZiBAaXNDb21wbGV0aW5nUHNldWRvU2VsZWN0b3IocmVxdWVzdClcbiAgICAgIGNvbXBsZXRpb25zID0gQGdldFBzZXVkb1NlbGVjdG9yQ29tcGxldGlvbnMocmVxdWVzdClcbiAgICBlbHNlXG4gICAgICBpZiBAaXNDb21wbGV0aW5nTmFtZShyZXF1ZXN0KVxuICAgICAgICBjb21wbGV0aW9ucyA9IEBnZXRQcm9wZXJ0eU5hbWVDb21wbGV0aW9ucyhyZXF1ZXN0KVxuICAgICAgZWxzZSBpZiBAaXNDb21wbGV0aW5nTmFtZU9yVGFnKHJlcXVlc3QpXG4gICAgICAgIGNvbXBsZXRpb25zID0gQGdldFByb3BlcnR5TmFtZUNvbXBsZXRpb25zKHJlcXVlc3QpXG4gICAgICAgICAgLmNvbmNhdChAZ2V0VGFnQ29tcGxldGlvbnMocmVxdWVzdCkpXG5cbiAgICByZXR1cm4gY29tcGxldGlvbnNcblxuICBvbkRpZEluc2VydFN1Z2dlc3Rpb246ICh7ZWRpdG9yLCBzdWdnZXN0aW9ufSkgLT5cbiAgICBzZXRUaW1lb3V0KEB0cmlnZ2VyQXV0b2NvbXBsZXRlLmJpbmQodGhpcywgZWRpdG9yKSwgMSkgaWYgc3VnZ2VzdGlvbi50eXBlIGlzICdwcm9wZXJ0eSdcblxuICB0cmlnZ2VyQXV0b2NvbXBsZXRlOiAoZWRpdG9yKSAtPlxuICAgIGF0b20uY29tbWFuZHMuZGlzcGF0Y2goYXRvbS52aWV3cy5nZXRWaWV3KGVkaXRvciksICdhdXRvY29tcGxldGUtcGx1czphY3RpdmF0ZScsIHthY3RpdmF0ZWRNYW51YWxseTogZmFsc2V9KVxuXG4gIGxvYWRQcm9wZXJ0aWVzOiAtPlxuICAgIEBwcm9wZXJ0aWVzID0ge31cbiAgICBmcy5yZWFkRmlsZSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnY29tcGxldGlvbnMuanNvbicpLCAoZXJyb3IsIGNvbnRlbnQpID0+XG4gICAgICB7QHBzZXVkb1NlbGVjdG9ycywgQHByb3BlcnRpZXMsIEB0YWdzfSA9IEpTT04ucGFyc2UoY29udGVudCkgdW5sZXNzIGVycm9yP1xuXG4gICAgICByZXR1cm5cblxuICBpc0NvbXBsZXRpbmdWYWx1ZTogKHtzY29wZURlc2NyaXB0b3IsIGJ1ZmZlclBvc2l0aW9uLCBwcmVmaXgsIGVkaXRvcn0pIC0+XG4gICAgc2NvcGVzID0gc2NvcGVEZXNjcmlwdG9yLmdldFNjb3Blc0FycmF5KClcblxuICAgIGJlZm9yZVByZWZpeEJ1ZmZlclBvc2l0aW9uID0gW2J1ZmZlclBvc2l0aW9uLnJvdywgTWF0aC5tYXgoMCwgYnVmZmVyUG9zaXRpb24uY29sdW1uIC0gcHJlZml4Lmxlbmd0aCAtIDEpXVxuICAgIGJlZm9yZVByZWZpeFNjb3BlcyA9IGVkaXRvci5zY29wZURlc2NyaXB0b3JGb3JCdWZmZXJQb3NpdGlvbihiZWZvcmVQcmVmaXhCdWZmZXJQb3NpdGlvbilcbiAgICBiZWZvcmVQcmVmaXhTY29wZXNBcnJheSA9IGJlZm9yZVByZWZpeFNjb3Blcy5nZXRTY29wZXNBcnJheSgpXG5cbiAgICByZXR1cm4gKGhhc1Njb3BlKHNjb3BlcywgJ21ldGEucHJvcGVydHktdmFsdWVzLmNzcycpKSBvclxuICAgICAgKGhhc1Njb3BlKGJlZm9yZVByZWZpeFNjb3Blc0FycmF5ICwgJ21ldGEucHJvcGVydHktdmFsdWVzLmNzcycpKVxuXG4gIGlzQ29tcGxldGluZ05hbWU6ICh7c2NvcGVEZXNjcmlwdG9yLCBidWZmZXJQb3NpdGlvbiwgZWRpdG9yfSkgLT5cbiAgICBzY29wZSA9IHNjb3BlRGVzY3JpcHRvci5nZXRTY29wZXNBcnJheSgpLnNsaWNlKC0xKVxuICAgIHByZWZpeCA9IEBnZXRQcm9wZXJ0eU5hbWVQcmVmaXgoYnVmZmVyUG9zaXRpb24sIGVkaXRvcilcbiAgICByZXR1cm4gQGlzUHJvcGVydHlOYW1lUHJlZml4KHByZWZpeCkgYW5kIChzY29wZVswXSBpcyAnbWV0YS5wcm9wZXJ0eS1saXN0LmNzcycpXG5cbiAgaXNDb21wbGV0aW5nTmFtZU9yVGFnOiAoe3Njb3BlRGVzY3JpcHRvciwgYnVmZmVyUG9zaXRpb24sIGVkaXRvcn0pIC0+XG4gICAgc2NvcGUgPSBzY29wZURlc2NyaXB0b3IuZ2V0U2NvcGVzQXJyYXkoKS5zbGljZSgtMSlcbiAgICBwcmVmaXggPSBAZ2V0UHJvcGVydHlOYW1lUHJlZml4KGJ1ZmZlclBvc2l0aW9uLCBlZGl0b3IpXG4gICAgcmV0dXJuIEBpc1Byb3BlcnR5TmFtZVByZWZpeChwcmVmaXgpIGFuZFxuICAgICAoKHNjb3BlWzBdIGlzICdtZXRhLnByb3BlcnR5LWxpc3QuY3NzJykgb3JcbiAgICAgIChzY29wZVswXSBpcyAnc291cmNlLmNzcy5zdHlsZWQnKSBvclxuICAgICAgKHNjb3BlWzBdIGlzICdlbnRpdHkubmFtZS50YWcuY3NzJykgb3JcbiAgICAgIChzY29wZVswXSBpcyAnc291cmNlLmluc2lkZS1qcy5jc3Muc3R5bGVkJykpXG5cbiAgaXNDb21wbGV0aW5nUHNldWRvU2VsZWN0b3I6ICh7ZWRpdG9yLCBzY29wZURlc2NyaXB0b3IsIGJ1ZmZlclBvc2l0aW9ufSkgLT5cbiAgICBzY29wZSA9IHNjb3BlRGVzY3JpcHRvci5nZXRTY29wZXNBcnJheSgpLnNsaWNlKC0xKVxuICAgIHJldHVybiAoICggc2NvcGVbMF0gaXMgJ2NvbnN0YW50Lmxhbmd1YWdlLnBzZXVkby5wcmVmaXhlZC5jc3MnKSBvclxuICAgICAgKCBzY29wZVswXSBpcyAna2V5d29yZC5vcGVyYXRvci5wc2V1ZG8uY3NzJykgKVxuXG4gIGlzUHJvcGVydHlWYWx1ZVByZWZpeDogKHByZWZpeCkgLT5cbiAgICBwcmVmaXggPSBwcmVmaXgudHJpbSgpXG4gICAgcHJlZml4Lmxlbmd0aCA+IDAgYW5kIHByZWZpeCBpc250ICc6J1xuXG4gIGlzUHJvcGVydHlOYW1lUHJlZml4OiAocHJlZml4KSAtPlxuICAgIHJldHVybiBmYWxzZSB1bmxlc3MgcHJlZml4P1xuICAgIHByZWZpeCA9IHByZWZpeC50cmltKClcbiAgICBwcmVmaXgubWF0Y2goL15bYS16QS1aLV0rJC8pXG5cbiAgZ2V0SW1wb3J0YW50UHJlZml4OiAoZWRpdG9yLCBidWZmZXJQb3NpdGlvbikgLT5cbiAgICBsaW5lID0gZWRpdG9yLmdldFRleHRJblJhbmdlKFtbYnVmZmVyUG9zaXRpb24ucm93LCAwXSwgYnVmZmVyUG9zaXRpb25dKVxuICAgIGltcG9ydGFudFByZWZpeFBhdHRlcm4uZXhlYyhsaW5lKT9bMV1cblxuICBnZXRQcmV2aW91c1Byb3BlcnR5TmFtZTogKGJ1ZmZlclBvc2l0aW9uLCBlZGl0b3IpIC0+XG4gICAge3Jvd30gPSBidWZmZXJQb3NpdGlvblxuICAgIHdoaWxlIHJvdyA+PSAwXG4gICAgICBsaW5lID0gZWRpdG9yLmxpbmVUZXh0Rm9yQnVmZmVyUm93KHJvdylcbiAgICAgIHByb3BlcnR5TmFtZSA9IGlubGluZVByb3BlcnR5TmFtZVdpdGhDb2xvblBhdHRlcm4uZXhlYyhsaW5lKT9bMV1cbiAgICAgIHByb3BlcnR5TmFtZSA/PSBmaXJzdElubGluZVByb3BlcnR5TmFtZVdpdGhDb2xvblBhdHRlcm4uZXhlYyhsaW5lKT9bMV1cbiAgICAgIHByb3BlcnR5TmFtZSA/PSBwcm9wZXJ0eU5hbWVXaXRoQ29sb25QYXR0ZXJuLmV4ZWMobGluZSk/WzFdXG4gICAgICByZXR1cm4gcHJvcGVydHlOYW1lIGlmIHByb3BlcnR5TmFtZVxuICAgICAgcm93LS1cbiAgICByZXR1cm5cblxuICBnZXRQcm9wZXJ0eVZhbHVlQ29tcGxldGlvbnM6ICh7YnVmZmVyUG9zaXRpb24sIGVkaXRvciwgcHJlZml4LCBzY29wZURlc2NyaXB0b3J9KSAtPlxuICAgIHByb3BlcnR5ID0gQGdldFByZXZpb3VzUHJvcGVydHlOYW1lKGJ1ZmZlclBvc2l0aW9uLCBlZGl0b3IpXG4gICAgdmFsdWVzID0gQHByb3BlcnRpZXNbcHJvcGVydHldPy52YWx1ZXNcbiAgICByZXR1cm4gbnVsbCB1bmxlc3MgdmFsdWVzP1xuXG4gICAgc2NvcGVzID0gc2NvcGVEZXNjcmlwdG9yLmdldFNjb3Blc0FycmF5KClcbiAgICBhZGRTZW1pY29sb24gPSBub3QgbGluZUVuZHNXaXRoU2VtaWNvbG9uKGJ1ZmZlclBvc2l0aW9uLCBlZGl0b3IpXG5cbiAgICBjb21wbGV0aW9ucyA9IFtdXG4gICAgaWYgQGlzUHJvcGVydHlWYWx1ZVByZWZpeChwcmVmaXgpXG4gICAgICBmb3IgdmFsdWUgaW4gdmFsdWVzIHdoZW4gZmlyc3RDaGFyc0VxdWFsKHZhbHVlLCBwcmVmaXgpXG4gICAgICAgIGNvbXBsZXRpb25zLnB1c2goQGJ1aWxkUHJvcGVydHlWYWx1ZUNvbXBsZXRpb24odmFsdWUsIHByb3BlcnR5LCBhZGRTZW1pY29sb24pKVxuICAgIGVsc2VcbiAgICAgIGZvciB2YWx1ZSBpbiB2YWx1ZXNcbiAgICAgICAgY29tcGxldGlvbnMucHVzaChAYnVpbGRQcm9wZXJ0eVZhbHVlQ29tcGxldGlvbih2YWx1ZSwgcHJvcGVydHksIGFkZFNlbWljb2xvbikpXG5cbiAgICBpZiBpbXBvcnRhbnRQcmVmaXggPSBAZ2V0SW1wb3J0YW50UHJlZml4KGVkaXRvciwgYnVmZmVyUG9zaXRpb24pXG4gICAgICBjb21wbGV0aW9ucy5wdXNoXG4gICAgICAgIHR5cGU6ICdrZXl3b3JkJ1xuICAgICAgICB0ZXh0OiAnIWltcG9ydGFudCdcbiAgICAgICAgZGlzcGxheVRleHQ6ICchaW1wb3J0YW50J1xuICAgICAgICByZXBsYWNlbWVudFByZWZpeDogaW1wb3J0YW50UHJlZml4XG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkZvcmNlcyB0aGlzIHByb3BlcnR5IHRvIG92ZXJyaWRlIGFueSBvdGhlciBkZWNsYXJhdGlvbiBvZiB0aGUgc2FtZSBwcm9wZXJ0eS4gVXNlIHdpdGggY2F1dGlvbi5cIlxuICAgICAgICBkZXNjcmlwdGlvbk1vcmVVUkw6IFwiI3tjc3NEb2NzVVJMfS9TcGVjaWZpY2l0eSNUaGVfIWltcG9ydGFudF9leGNlcHRpb25cIlxuXG4gICAgY29tcGxldGlvbnNcblxuICBidWlsZFByb3BlcnR5VmFsdWVDb21wbGV0aW9uOiAodmFsdWUsIHByb3BlcnR5TmFtZSwgYWRkU2VtaWNvbG9uKSAtPlxuICAgIHRleHQgPSB2YWx1ZVxuICAgIHRleHQgKz0gJzsnIGlmIGFkZFNlbWljb2xvblxuICAgIHRleHQgPSBtYWtlU25pcHBldCh0ZXh0KVxuXG4gICAge1xuICAgICAgdHlwZTogJ3ZhbHVlJ1xuICAgICAgc25pcHBldDogdGV4dFxuICAgICAgZGlzcGxheVRleHQ6IHZhbHVlXG4gICAgICBkZXNjcmlwdGlvbjogXCIje3ZhbHVlfSB2YWx1ZSBmb3IgdGhlICN7cHJvcGVydHlOYW1lfSBwcm9wZXJ0eVwiXG4gICAgICBkZXNjcmlwdGlvbk1vcmVVUkw6IFwiI3tjc3NEb2NzVVJMfS8je3Byb3BlcnR5TmFtZX0jVmFsdWVzXCJcbiAgICB9XG5cbiAgZ2V0UHJvcGVydHlOYW1lUHJlZml4OiAoYnVmZmVyUG9zaXRpb24sIGVkaXRvcikgLT5cbiAgICBsaW5lID0gZWRpdG9yLmdldFRleHRJblJhbmdlKFtbYnVmZmVyUG9zaXRpb24ucm93LCAwXSwgYnVmZmVyUG9zaXRpb25dKVxuICAgIHByb3BlcnR5TmFtZVByZWZpeFBhdHRlcm4uZXhlYyhsaW5lKT9bMF1cblxuICBnZXRQcm9wZXJ0eU5hbWVDb21wbGV0aW9uczogKHtidWZmZXJQb3NpdGlvbiwgZWRpdG9yLCBzY29wZURlc2NyaXB0b3IsIGFjdGl2YXRlZE1hbnVhbGx5fSkgLT5cbiAgICBzY29wZXMgPSBzY29wZURlc2NyaXB0b3IuZ2V0U2NvcGVzQXJyYXkoKVxuICAgIGxpbmUgPSBlZGl0b3IuZ2V0VGV4dEluUmFuZ2UoW1tidWZmZXJQb3NpdGlvbi5yb3csIDBdLCBidWZmZXJQb3NpdGlvbl0pXG5cbiAgICBwcmVmaXggPSBAZ2V0UHJvcGVydHlOYW1lUHJlZml4KGJ1ZmZlclBvc2l0aW9uLCBlZGl0b3IpXG4gICAgcmV0dXJuIFtdIHVubGVzcyBhY3RpdmF0ZWRNYW51YWxseSBvciBwcmVmaXhcblxuICAgIGNvbXBsZXRpb25zID0gW11cbiAgICBmb3IgcHJvcGVydHksIG9wdGlvbnMgb2YgQHByb3BlcnRpZXMgd2hlbiBub3QgcHJlZml4IG9yIGZpcnN0Q2hhcnNFcXVhbChwcm9wZXJ0eSwgcHJlZml4KVxuICAgICAgY29tcGxldGlvbnMucHVzaChAYnVpbGRQcm9wZXJ0eU5hbWVDb21wbGV0aW9uKHByb3BlcnR5LCBwcmVmaXgsIG9wdGlvbnMpKVxuICAgIGNvbXBsZXRpb25zXG5cbiAgYnVpbGRQcm9wZXJ0eU5hbWVDb21wbGV0aW9uOiAocHJvcGVydHlOYW1lLCBwcmVmaXgsIHtkZXNjcmlwdGlvbn0pIC0+XG4gICAgdHlwZTogJ3Byb3BlcnR5J1xuICAgIHRleHQ6IFwiI3twcm9wZXJ0eU5hbWV9OiBcIlxuICAgIGRpc3BsYXlUZXh0OiBwcm9wZXJ0eU5hbWVcbiAgICByZXBsYWNlbWVudFByZWZpeDogcHJlZml4XG4gICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uXG4gICAgZGVzY3JpcHRpb25Nb3JlVVJMOiBcIiN7Y3NzRG9jc1VSTH0vI3twcm9wZXJ0eU5hbWV9XCJcblxuICBnZXRQc2V1ZG9TZWxlY3RvclByZWZpeDogKGVkaXRvciwgYnVmZmVyUG9zaXRpb24pIC0+XG4gICAgbGluZSA9IGVkaXRvci5nZXRUZXh0SW5SYW5nZShbW2J1ZmZlclBvc2l0aW9uLnJvdywgMF0sIGJ1ZmZlclBvc2l0aW9uXSlcbiAgICBsaW5lLm1hdGNoKHBlc3Vkb1NlbGVjdG9yUHJlZml4UGF0dGVybik/WzBdXG5cbiAgZ2V0UHNldWRvU2VsZWN0b3JDb21wbGV0aW9uczogKHtidWZmZXJQb3NpdGlvbiwgZWRpdG9yfSkgLT5cbiAgICBwcmVmaXggPSBAZ2V0UHNldWRvU2VsZWN0b3JQcmVmaXgoZWRpdG9yLCBidWZmZXJQb3NpdGlvbilcbiAgICByZXR1cm4gbnVsbCB1bmxlc3MgcHJlZml4XG5cbiAgICBjb21wbGV0aW9ucyA9IFtdXG4gICAgZm9yIHBzZXVkb1NlbGVjdG9yLCBvcHRpb25zIG9mIEBwc2V1ZG9TZWxlY3RvcnMgd2hlbiBmaXJzdENoYXJzRXF1YWwocHNldWRvU2VsZWN0b3IsIHByZWZpeClcbiAgICAgIGNvbXBsZXRpb25zLnB1c2goQGJ1aWxkUHNldWRvU2VsZWN0b3JDb21wbGV0aW9uKHBzZXVkb1NlbGVjdG9yLCBwcmVmaXgsIG9wdGlvbnMpKVxuICAgIGNvbXBsZXRpb25zXG5cbiAgYnVpbGRQc2V1ZG9TZWxlY3RvckNvbXBsZXRpb246IChwc2V1ZG9TZWxlY3RvciwgcHJlZml4LCB7YXJndW1lbnQsIGRlc2NyaXB0aW9ufSkgLT5cbiAgICBjb21wbGV0aW9uID1cbiAgICAgIHR5cGU6ICdwc2V1ZG8tc2VsZWN0b3InXG4gICAgICByZXBsYWNlbWVudFByZWZpeDogcHJlZml4XG4gICAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25cbiAgICAgIGRlc2NyaXB0aW9uTW9yZVVSTDogXCIje2Nzc0RvY3NVUkx9LyN7cHNldWRvU2VsZWN0b3J9XCJcblxuICAgIGlmIGFyZ3VtZW50P1xuICAgICAgY29tcGxldGlvbi5zbmlwcGV0ID0gXCIje3BzZXVkb1NlbGVjdG9yfSgkezE6I3thcmd1bWVudH19KVwiXG4gICAgZWxzZVxuICAgICAgY29tcGxldGlvbi50ZXh0ID0gcHNldWRvU2VsZWN0b3JcbiAgICBjb21wbGV0aW9uXG5cbiAgZ2V0VGFnU2VsZWN0b3JQcmVmaXg6IChlZGl0b3IsIGJ1ZmZlclBvc2l0aW9uKSAtPlxuICAgIGxpbmUgPSBlZGl0b3IuZ2V0VGV4dEluUmFuZ2UoW1tidWZmZXJQb3NpdGlvbi5yb3csIDBdLCBidWZmZXJQb3NpdGlvbl0pXG4gICAgdGFnU2VsZWN0b3JQcmVmaXhQYXR0ZXJuLmV4ZWMobGluZSk/WzJdXG5cbiAgZ2V0VGFnQ29tcGxldGlvbnM6ICh7YnVmZmVyUG9zaXRpb24sIGVkaXRvciwgcHJlZml4fSkgLT5cbiAgICBjb21wbGV0aW9ucyA9IFtdXG4gICAgaWYgcHJlZml4XG4gICAgICBmb3IgdGFnIGluIEB0YWdzIHdoZW4gZmlyc3RDaGFyc0VxdWFsKHRhZywgcHJlZml4KVxuICAgICAgICBjb21wbGV0aW9ucy5wdXNoKEBidWlsZFRhZ0NvbXBsZXRpb24odGFnKSlcbiAgICBjb21wbGV0aW9uc1xuXG4gIGJ1aWxkVGFnQ29tcGxldGlvbjogKHRhZykgLT5cbiAgICB0eXBlOiAndGFnJ1xuICAgIHRleHQ6IHRhZ1xuICAgIGRlc2NyaXB0aW9uOiBcIlNlbGVjdG9yIGZvciA8I3t0YWd9PiBlbGVtZW50c1wiXG5cbmxpbmVFbmRzV2l0aFNlbWljb2xvbiA9IChidWZmZXJQb3NpdGlvbiwgZWRpdG9yKSAtPlxuICB7cm93fSA9IGJ1ZmZlclBvc2l0aW9uXG4gIGxpbmUgPSBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cocm93KVxuICAvO1xccyokLy50ZXN0KGxpbmUpXG5cbmhhc1Njb3BlID0gKHNjb3Blc0FycmF5LCBzY29wZSkgLT5cbiAgc2NvcGVzQXJyYXkuaW5kZXhPZihzY29wZSkgaXNudCAtMVxuXG5maXJzdENoYXJzRXF1YWwgPSAoc3RyMSwgc3RyMikgLT5cbiAgc3RyMVswXS50b0xvd2VyQ2FzZSgpIGlzIHN0cjJbMF0udG9Mb3dlckNhc2UoKVxuXG4jIGxvb2tzIGF0IGEgc3RyaW5nIGFuZCByZXBsYWNlcyBjb25zZWN1dGl2ZSAoKSB3aXRoIGluY3JlbWVudGluZyBzbmlwcGV0IHBvc2l0aW9ucyAoJG4pXG4jIEl0IGFsc28gYWRkcyBhIHRyYWlsaW5nICRuIGF0IGVuZCBvZiB0ZXh0XG4jIGUuZyB0cmFuc2xhdGUoKSBiZWNvbWVzIHRyYW5zbGF0ZSgkMSkkMlxubWFrZVNuaXBwZXQgPSAodGV4dCkgIC0+XG4gIHNuaXBwZXROdW1iZXIgPSAwXG4gIHdoaWxlIHRleHQuaW5jbHVkZXMoJygpJylcbiAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKCcoKScsIFwiKCQjeysrc25pcHBldE51bWJlcn0pXCIpXG4gIHRleHQgPSB0ZXh0ICsgXCIkI3srK3NuaXBwZXROdW1iZXJ9XCJcbiAgcmV0dXJuIHRleHRcbiJdfQ==
