(function() {
  var AnimatedPageScroll, CompositeDisposable, TweenMax;

  CompositeDisposable = require('atom').CompositeDisposable;

  TweenMax = require('gsap');

  module.exports = AnimatedPageScroll = {
    config: {
      scrollDuration: {
        type: 'number',
        "default": 0.2,
        minimum: 0,
        maximum: 1,
        description: 'Scroll duration in seconds.',
        order: 1
      },
      scrollRows: {
        type: 'integer',
        "default": 0,
        minimum: 0,
        maximum: 100,
        description: 'Scroll number of rows (set 0 to use full page).',
        order: 2
      }
    },
    activate: function(state) {
      this.animations = {};
      this.subscriptions = new CompositeDisposable;
      return this.subscriptions.add(atom.commands.add('atom-workspace', {
        'animated-page-scroll:page-up': (function(_this) {
          return function() {
            return _this.scrollPage(-1);
          };
        })(this),
        'animated-page-scroll:page-down': (function(_this) {
          return function() {
            return _this.scrollPage(1);
          };
        })(this)
      }));
    },
    deactivate: function() {
      var _, animation, ref, ref1;
      this.subscriptions.dispose();
      ref = this.animations;
      for (_ in ref) {
        animation = ref[_];
        if ((ref1 = animation.onDidChangeCursorPositionSubscription) != null) {
          ref1.dispose();
        }
        animation.tween.kill();
      }
      return this.animations = {};
    },
    serialize: function() {},
    scrollPage: function(direction) {
      var editor, editorView, numRowsToScroll, ref, scroller, targetScroll;
      editor = atom.workspace.getActiveTextEditor();
      numRowsToScroll = (((ref = this.animations[editor.id]) != null ? ref.numRowsToScroll : void 0) || 0) + ((this.getScrollRows() || editor.getRowsPerPage()) * direction);
      targetScroll = {
        top: editor.getLineHeightInPixels() * (editor.getCursorScreenPosition().row - 2 + numRowsToScroll)
      };
      if (this.animations[editor.id]) {
        this.animations[editor.id].numRowsToScroll = numRowsToScroll;
        return this.animations[editor.id].tween.updateTo(targetScroll, true);
      } else {
        editorView = atom.views.getView(editor);
        scroller = {
          top: editorView.getScrollTop()
        };
        return this.animations[editor.id] = {
          onDidChangeCursorPositionSubscription: editor.onDidChangeCursorPosition((function(_this) {
            return function(_) {
              return _this.stopAnimation(_this.animations[editor.id]);
            };
          })(this)),
          numRowsToScroll: numRowsToScroll,
          tween: TweenMax.to(scroller, this.getScrollDuration(), {
            top: targetScroll.top,
            ease: Power2.easeOut,
            onUpdate: (function(_this) {
              return function() {
                var animation;
                if (editorView != null) {
                  editorView.setScrollTop(scroller.top);
                  animation = _this.animations[editor.id];
                  if ((animation.numRowsToScroll < 0 && editorView.getScrollTop() <= 0) || (animation.numRowsToScroll > 0 && editorView.getScrollBottom() >= editor.getLineHeightInPixels() * editor.getScreenLineCount())) {
                    return _this.stopAnimation(animation);
                  }
                }
              };
            })(this),
            onComplete: (function(_this) {
              return function() {
                _this.animations[editor.id].onDidChangeCursorPositionSubscription.dispose();
                editor.moveDown(_this.animations[editor.id].numRowsToScroll);
                return delete _this.animations[editor.id];
              };
            })(this)
          })
        };
      }
    },
    stopAnimation: function(animation) {
      return animation.tween.seek(animation.tween.duration(), false);
    },
    getScrollDuration: function() {
      return atom.config.get('animated-page-scroll.scrollDuration');
    },
    getScrollRows: function() {
      return atom.config.get('animated-page-scroll.scrollRows');
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvYW5pbWF0ZWQtcGFnZS1zY3JvbGwvbGliL2FuaW1hdGVkLXBhZ2Utc2Nyb2xsLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLE1BQUE7O0VBQUMsc0JBQXVCLE9BQUEsQ0FBUSxNQUFSOztFQUN4QixRQUFBLEdBQVcsT0FBQSxDQUFRLE1BQVI7O0VBRVgsTUFBTSxDQUFDLE9BQVAsR0FBaUIsa0JBQUEsR0FDZjtJQUFBLE1BQUEsRUFDRTtNQUFBLGNBQUEsRUFDRTtRQUFBLElBQUEsRUFBTSxRQUFOO1FBQ0EsQ0FBQSxPQUFBLENBQUEsRUFBUyxHQURUO1FBRUEsT0FBQSxFQUFTLENBRlQ7UUFHQSxPQUFBLEVBQVMsQ0FIVDtRQUlBLFdBQUEsRUFBYSw2QkFKYjtRQUtBLEtBQUEsRUFBTyxDQUxQO09BREY7TUFPQSxVQUFBLEVBQ0U7UUFBQSxJQUFBLEVBQU0sU0FBTjtRQUNBLENBQUEsT0FBQSxDQUFBLEVBQVMsQ0FEVDtRQUVBLE9BQUEsRUFBUyxDQUZUO1FBR0EsT0FBQSxFQUFTLEdBSFQ7UUFJQSxXQUFBLEVBQWEsaURBSmI7UUFLQSxLQUFBLEVBQU8sQ0FMUDtPQVJGO0tBREY7SUFnQkEsUUFBQSxFQUFVLFNBQUMsS0FBRDtNQUNSLElBQUMsQ0FBQSxVQUFELEdBQWM7TUFDZCxJQUFDLENBQUEsYUFBRCxHQUFpQixJQUFJO2FBQ3JCLElBQUMsQ0FBQSxhQUFhLENBQUMsR0FBZixDQUFtQixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQWQsQ0FBa0IsZ0JBQWxCLEVBQ2pCO1FBQUEsOEJBQUEsRUFBZ0MsQ0FBQSxTQUFBLEtBQUE7aUJBQUEsU0FBQTttQkFBRyxLQUFDLENBQUEsVUFBRCxDQUFZLENBQUMsQ0FBYjtVQUFIO1FBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFoQztRQUNBLGdDQUFBLEVBQWtDLENBQUEsU0FBQSxL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QkFDRSxLQUFDLENBQUEsYUFBRCxDQUFlLFNBQWYsRUFERjttQkFMRjs7Y0FEUTtZQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FIVjtZQVlBLFVBQUEsRUFBWSxDQUFBLFNBQUEsS0FBQTtxQkFBQSxTQUFBO2dCQUNWLEtBQUMsQ0FBQSxVQUFXLENBQUEsTUFBTSxDQUFDLEVBQVAsQ0FBVSxDQUFDLHFDQUFxQyxDQUFDLE9BQTdELENBQUE7Z0JBQ0EsTUFBTSxDQUFDLFFBQVAsQ0FBZ0IsS0FBQyxDQUFBLFVBQVcsQ0FBQSxNQUFNLENBQUMsRUFBUCxDQUFVLENBQUMsZUFBdkM7dUJBQ0EsT0FBTyxLQUFDLENBQUEsVUFBVyxDQUFBLE1BQU0sQ0FBQyxFQUFQO2NBSFQ7WUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBWlo7V0FESyxDQUxQO1VBWEo7O0lBTlUsQ0FoQ1o7SUF3RUEsYUFBQSxFQUFlLFNBQUMsU0FBRDthQUNiLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBaEIsQ0FBcUIsU0FBUyxDQUFDLEtBQUssQ0FBQyxRQUFoQixDQUFBLENBQXJCLEVBQWlELEtBQWpEO0lBRGEsQ0F4RWY7SUEyRUEsaUJBQUEsRUFBbUIsU0FBQTthQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQVosQ0FBZ0IscUNBQWhCO0lBRGlCLENBM0VuQjtJQThFQSxhQUFBLEVBQWUsU0FBQTthQUNiLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBWixDQUFnQixpQ0FBaEI7SUFEYSxDQTlFZjs7QUFKRiIsInNvdXJjZXNDb250ZW50IjpbIntDb21wb3NpdGVEaXNwb3NhYmxlfSA9IHJlcXVpcmUgJ2F0b20nXG5Ud2Vlbk1heCA9IHJlcXVpcmUgJ2dzYXAnXG5cbm1vZHVsZS5leHBvcnRzID0gQW5pbWF0ZWRQYWdlU2Nyb2xsID1cbiAgY29uZmlnOlxuICAgIHNjcm9sbER1cmF0aW9uOlxuICAgICAgdHlwZTogJ251bWJlcidcbiAgICAgIGRlZmF1bHQ6IDAuMlxuICAgICAgbWluaW11bTogMFxuICAgICAgbWF4aW11bTogMVxuICAgICAgZGVzY3JpcHRpb246ICdTY3JvbGwgZHVyYXRpb24gaW4gc2Vjb25kcy4nXG4gICAgICBvcmRlcjogMVxuICAgIHNjcm9sbFJvd3M6XG4gICAgICB0eXBlOiAnaW50ZWdlcidcbiAgICAgIGRlZmF1bHQ6IDBcbiAgICAgIG1pbmltdW06IDBcbiAgICAgIG1heGltdW06IDEwMFxuICAgICAgZGVzY3JpcHRpb246ICdTY3JvbGwgbnVtYmVyIG9mIHJvd3MgKHNldCAwIHRvIHVzZSBmdWxsIHBhZ2UpLidcbiAgICAgIG9yZGVyOiAyXG5cbiAgYWN0aXZhdGU6IChzdGF0ZSkgLT5cbiAgICBAYW5pbWF0aW9ucyA9IHt9XG4gICAgQHN1YnNjcmlwdGlvbnMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZVxuICAgIEBzdWJzY3JpcHRpb25zLmFkZCBhdG9tLmNvbW1hbmRzLmFkZCAnYXRvbS13b3Jrc3BhY2UnLFxuICAgICAgJ2FuaW1hdGVkLXBhZ2Utc2Nyb2xsOnBhZ2UtdXAnOiA9PiBAc2Nyb2xsUGFnZSAtMVxuICAgICAgJ2FuaW1hdGVkLXBhZ2Utc2Nyb2xsOnBhZ2UtZG93bic6ID0+IEBzY3JvbGxQYWdlIDFcblxuICBkZWFjdGl2YXRlOiAtPlxuICAgIEBzdWJzY3JpcHRpb25zLmRpc3Bvc2UoKVxuICAgIGZvciBfLCBhbmltYXRpb24gb2YgQGFuaW1hdGlvbnNcbiAgICAgIGFuaW1hdGlvbi5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uU3Vic2NyaXB0aW9uPy5kaXNwb3NlKClcbiAgICAgIGFuaW1hdGlvbi50d2Vlbi5raWxsKClcbiAgICBAYW5pbWF0aW9ucyA9IHt9XG5cbiAgc2VyaWFsaXplOiAtPlxuXG4gIHNjcm9sbFBhZ2U6IChkaXJlY3Rpb24pIC0+XG4gICAgZWRpdG9yID0gYXRvbS53b3Jrc3BhY2UuZ2V0QWN0aXZlVGV4dEVkaXRvcigpXG4gICAgIyBudW1Sb3dzVG9TY3JvbGwgY2FuIGJlIHBvc2l0aXZlIG9yIG5lZ2F0aXZlIGRlcGVuZGluZyBvbiB0aGUgZGlyZWN0aW9uICgtMSBvciAxKS5cbiAgICBudW1Sb3dzVG9TY3JvbGwgPSAoQGFuaW1hdGlvbnNbZWRpdG9yLmlkXT8ubnVtUm93c1RvU2Nyb2xsIHx8IDApICsgKChAZ2V0U2Nyb2xsUm93cygpIHx8IGVkaXRvci5nZXRSb3dzUGVyUGFnZSgpKSAqIGRpcmVjdGlvbilcbiAgICB0YXJnZXRTY3JvbGwgPSB7dG9wOiBlZGl0b3IuZ2V0TGluZUhlaWdodEluUGl4ZWxzKCkgKiAoZWRpdG9yLmdldEN1cnNvclNjcmVlblBvc2l0aW9uKCkucm93IC0gMiArIG51bVJvd3NUb1Njcm9sbCl9XG5cbiAgICBpZiBAYW5pbWF0aW9uc1tlZGl0b3IuaWRdXG4gICAgICAjIElmIGFuIGFuaW1hdGlvbiB3YXMgYWxyZWFkeSBzdGFydGVkIGZvciB0aGUgZWRpdG9yLCB1cGRhdGUgdGhlIHR3ZWVuIHRhcmdldC5cbiAgICAgIEBhbmltYXRpb25zW2VkaXRvci5pZF0ubnVtUm93c1RvU2Nyb2xsID0gbnVtUm93c1RvU2Nyb2xsXG4gICAgICBAYW5pbWF0aW9uc1tlZGl0b3IuaWRdLnR3ZWVuLnVwZGF0ZVRvIHRhcmdldFNjcm9sbCwgdHJ1ZVxuXG4gICAgZWxzZVxuICAgICAgZWRpdG9yVmlldyA9IGF0b20udmlld3MuZ2V0VmlldyhlZGl0b3IpXG4gICAgICBzY3JvbGxlciA9IHt0b3A6IGVkaXRvclZpZXcuZ2V0U2Nyb2xsVG9wKCl9XG5cbiAgICAgIEBhbmltYXRpb25zW2VkaXRvci5pZF0gPVxuICAgICAgICAjIFN0b3AgYW5pbWF0aW9uIHdoZW4gYSBjdXJzb3Igd2FzIG1vdmVkLlxuICAgICAgICBvbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uU3Vic2NyaXB0aW9uOiBlZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbiAoXykgPT5cbiAgICAgICAgICBAc3RvcEFuaW1hdGlvbiBAYW5pbWF0aW9uc1tlZGl0b3IuaWRdXG5cbiAgICAgICAgbnVtUm93c1RvU2Nyb2xsOiBudW1Sb3dzVG9TY3JvbGxcblxuICAgICAgICB0d2VlbjogVHdlZW5NYXgudG8gc2Nyb2xsZXIsIEBnZXRTY3JvbGxEdXJhdGlvbigpLFxuICAgICAgICAgIHRvcDogdGFyZ2V0U2Nyb2xsLnRvcFxuICAgICAgICAgIGVhc2U6IFBvd2VyMi5lYXNlT3V0XG5cbiAgICAgICAgICBvblVwZGF0ZTogPT5cbiAgICAgICAgICAgIGlmIGVkaXRvclZpZXc/XG4gICAgICAgICAgICAgIGVkaXRvclZpZXcuc2V0U2Nyb2xsVG9wIHNjcm9sbGVyLnRvcFxuXG4gICAgICAgICAgICAgICMgU3RvcCBhbmltYXRpb24gdXBvbiBzY3JvbGxpbmcgdG8gdGhlIHRvcCBvciBib3R0b20uXG4gICAgICAgICAgICAgIGFuaW1hdGlvbiA9IEBhbmltYXRpb25zW2VkaXRvci5pZF1cbiAgICAgICAgICAgICAgaWYgKGFuaW1hdGlvbi5udW1Sb3dzVG9TY3JvbGwgPCAwICYmIGVkaXRvclZpZXcuZ2V0U2Nyb2xsVG9wKCkgPD0gMCkgfHwgKGFuaW1hdGlvbi5udW1Sb3dzVG9TY3JvbGwgPiAwICYmIGVkaXRvclZpZXcuZ2V0U2Nyb2xsQm90dG9tKCkgPj0gZWRpdG9yLmdldExpbmVIZWlnaHRJblBpeGVscygpICogZWRpdG9yLmdldFNjcmVlbkxpbmVDb3VudCgpKVxuICAgICAgICAgICAgICAgIEBzdG9wQW5pbWF0aW9uIGFuaW1hdGlvblxuXG4gICAgICAgICAgb25Db21wbGV0ZTogPT5cbiAgICAgICAgICAgIEBhbmltYXRpb25zW2VkaXRvci5pZF0ub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvblN1YnNjcmlwdGlvbi5kaXNwb3NlKClcbiAgICAgICAgICAgIGVkaXRvci5tb3ZlRG93biBAYW5pbWF0aW9uc1tlZGl0b3IuaWRdLm51bVJvd3NUb1Njcm9sbFxuICAgICAgICAgICAgZGVsZXRlIEBhbmltYXRpb25zW2VkaXRvci5pZF1cblxuICBzdG9wQW5pbWF0aW9uOiAoYW5pbWF0aW9uKSAtPlxuICAgIGFuaW1hdGlvbi50d2Vlbi5zZWVrIGFuaW1hdGlvbi50d2Vlbi5kdXJhdGlvbigpLCBmYWxzZVxuXG4gIGdldFNjcm9sbER1cmF0aW9uOiAtPlxuICAgIGF0b20uY29uZmlnLmdldCgnYW5pbWF0ZWQtcGFnZS1zY3JvbGwuc2Nyb2xsRHVyYXRpb24nKVxuXG4gIGdldFNjcm9sbFJvd3M6IC0+XG4gICAgYXRvbS5jb25maWcuZ2V0KCdhbmltYXRlZC1wYWdlLXNjcm9sbC5zY3JvbGxSb3dzJylcbiJdfQ==
