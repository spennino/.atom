(function() {
  var CompositeDisposable;

  CompositeDisposable = require('atom').CompositeDisposable;

  module.exports = {
    activate: function() {
      this.disposables = new CompositeDisposable;
      atom.grammars.getGrammars().map((function(_this) {
        return function(grammar) {
          return _this.createCommand(grammar);
        };
      })(this));
      return this.disposables.add(atom.grammars.onDidAddGrammar((function(_this) {
        return function(grammar) {
          return _this.createCommand(grammar);
        };
      })(this)));
    },
    deactivate: function() {
      return this.disposables.dispose();
    },
    createCommand: function(grammar) {
      var workspaceElement;
      if ((grammar != null ? grammar.name : void 0) != null) {
        workspaceElement = atom.views.getView(atom.workspace);
        return this.disposables.add(atom.commands.add(workspaceElement, "set-syntax:" + grammar.name, function() {
          var editor;
          editor = atom.workspace.getActiveTextEditor();
          if (editor) {
            return atom.textEditors.setGrammarOverride(editor, grammar.scopeName);
          }
        }));
      }
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvc2V0LXN5bnRheC9saWIvbWFpbi5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBOztFQUFDLHNCQUF1QixPQUFBLENBQVEsTUFBUjs7RUFFeEIsTUFBTSxDQUFDLE9BQVAsR0FFRTtJQUFBLFFBQUEsRUFBVSxTQUFBO01BQ1IsSUFBQyxDQUFBLFdBQUQsR0FBZSxJQUFJO01BRW5CLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBZCxDQUFBLENBQTJCLENBQUMsR0FBNUIsQ0FBZ0MsQ0FBQSxTQUFBLEtBQUE7ZUFBQSxTQUFDLE9BQUQ7aUJBQzlCLEtBQUMsQ0FBQSxhQUFELENBQWUsT0FBZjtRQUQ4QjtNQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBaEM7YUFHQSxJQUFDLENBQUEsV0FBVyxDQUFDLEdBQWIsQ0FBaUIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFkLENBQThCLENBQUEsU0FBQSxLQUFBO2VBQUEsU0FBQyxPQUFEO2lCQUM3QyxLQUFDLENBQUEsYUFBRCxDQUFlLE9BQWY7UUFENkM7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQTlCLENBQWpCO0lBTlEsQ0FBVjtJQVVBLFVBQUEsRUFBWSxTQUFBO2FBQ1YsSUFBQyxDQUFBLFdBQVcsQ0FBQyxPQUFiLENBQUE7SUFEVSxDQVZaO0lBZ0JBLGFBQUEsRUFBZSxTQUFDLE9BQUQ7QUFDYixVQUFBO01BQUEsSUFBRyxpREFBSDtRQUNFLGdCQUFBLEdBQW1CLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBWCxDQUFtQixJQUFJLENBQUMsU0FBeEI7ZUFDbkIsSUFBQyxDQUFBLFdBQVcsQ0FBQyxHQUFiLENBQWlCLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBZCxDQUFrQixnQkFBbEIsRUFBb0MsYUFBQSxHQUFjLE9BQU8sQ0FBQyxJQUExRCxFQUFrRSxTQUFBO0FBQ2pGLGNBQUE7VUFBQSxNQUFBLEdBQVMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBZixDQUFBO1VBQ1QsSUFBRyxNQUFIO21CQUNFLElBQUksQ0FBQyxXQUFXLENBQUMsa0JBQWpCLENBQW9DLE1BQXBDLEVBQTRDLE9BQU8sQ0FBQyxTQUFwRCxFQURGOztRQUZpRixDQUFsRSxDQUFqQixFQUZGOztJQURhLENBaEJmOztBQUpGIiwic291cmNlc0NvbnRlbnQiOlsie0NvbXBvc2l0ZURpc3Bvc2FibGV9ID0gcmVxdWlyZSAnYXRvbSdcblxubW9kdWxlLmV4cG9ydHMgPVxuICAjIFB1YmxpYzogQWN0aXZhdGVzIHRoZSBwYWNrYWdlLlxuICBhY3RpdmF0ZTogLT5cbiAgICBAZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZVxuXG4gICAgYXRvbS5ncmFtbWFycy5nZXRHcmFtbWFycygpLm1hcCAoZ3JhbW1hcikgPT5cbiAgICAgIEBjcmVhdGVDb21tYW5kKGdyYW1tYXIpXG5cbiAgICBAZGlzcG9zYWJsZXMuYWRkIGF0b20uZ3JhbW1hcnMub25EaWRBZGRHcmFtbWFyIChncmFtbWFyKSA9PlxuICAgICAgQGNyZWF0ZUNvbW1hbmQoZ3JhbW1hcilcblxuICAjIFB1YmxpYzogRGVhY3RpdmF0ZXMgdGhlIHBhY2thZ2UuXG4gIGRlYWN0aXZhdGU6IC0+XG4gICAgQGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuXG4gICMgUHJpdmF0ZTogQ3JlYXRlcyB0aGUgY29tbWFuZCBmb3IgYSBnaXZlbiB7R3JhbW1hcn0uXG4gICNcbiAgIyAqIGBncmFtbWFyYCB7R3JhbW1hcn0gdGhlIGNvbW1hbmQgd2lsbCBiZSBmb3IuXG4gIGNyZWF0ZUNvbW1hbmQ6IChncmFtbWFyKSAtPlxuICAgIGlmIGdyYW1tYXI/Lm5hbWU/XG4gICAgICB3b3Jrc3BhY2VFbGVtZW50ID0gYXRvbS52aWV3cy5nZXRWaWV3KGF0b20ud29ya3NwYWNlKVxuICAgICAgQGRpc3Bvc2FibGVzLmFkZCBhdG9tLmNvbW1hbmRzLmFkZCB3b3Jrc3BhY2VFbGVtZW50LCBcInNldC1zeW50YXg6I3tncmFtbWFyLm5hbWV9XCIsIC0+XG4gICAgICAgIGVkaXRvciA9IGF0b20ud29ya3NwYWNlLmdldEFjdGl2ZVRleHRFZGl0b3IoKVxuICAgICAgICBpZiBlZGl0b3JcbiAgICAgICAgICBhdG9tLnRleHRFZGl0b3JzLnNldEdyYW1tYXJPdmVycmlkZShlZGl0b3IsIGdyYW1tYXIuc2NvcGVOYW1lKVxuIl19
