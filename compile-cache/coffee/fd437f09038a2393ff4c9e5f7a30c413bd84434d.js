(function() {
  var AutoIndent, CompositeDisposable, INTERFILESAVETIME, LB, autoCompeteEmmetCSS, autoCompleteJSX, autoCompleteStyledComponents, observeStatusBarGrammarNameTimer, observeStatusBarGrammarNameTimerCalled, ttlGrammar;

  CompositeDisposable = require('atom').CompositeDisposable;

  autoCompleteJSX = require('./auto-complete-jsx');

  autoCompleteStyledComponents = require('./auto-complete-styled-components');

  autoCompeteEmmetCSS = require('./auto-complete-emmet-css');

  AutoIndent = require('./auto-indent');

  ttlGrammar = require('./create-ttl-grammar');

  INTERFILESAVETIME = 1000;

  LB = 'language-babel';

  observeStatusBarGrammarNameTimer = null;

  observeStatusBarGrammarNameTimerCalled = 0;

  module.exports = {
    activate: function(state) {
      observeStatusBarGrammarNameTimer = setInterval(this.observeStatusBarGrammarName.bind(this), 1000);
      autoCompleteStyledComponents.loadProperties();
      if (this.transpiler == null) {
        this.transpiler = new (require('./transpiler'));
      }
      this.ttlGrammar = new ttlGrammar(true);
      this.disposable = new CompositeDisposable;
      this.textEditors = {};
      this.fileSaveTimes = {};
      this.disposable.add(atom.packages.onDidActivatePackage(this.isPackageCompatible));
      this.disposable.add(atom.project.onDidChangePaths((function(_this) {
        return function() {
          return _this.transpiler.stopUnusedTasks();
        };
      })(this)));
      return this.disposable.add(atom.workspace.observeTextEditors((function(_this) {
        return function(textEditor) {
          _this.textEditors[textEditor.id] = new CompositeDisposable;
          _this.textEditors[textEditor.id].add(textEditor.observeGrammar(function(grammar) {
            var ref, ref1, ref2, ref3;
            if (textEditor.getGrammar().packageName === LB) {
              return (ref = _this.textEditors[textEditor.id]) != null ? ref.autoIndent = new AutoIndent(textEditor) : void 0;
            } else {
              if ((ref1 = _this.textEditors[textEditor.id]) != null) {
                if ((ref2 = ref1.autoIndent) != null) {
                  ref2.destroy();
                }
              }
              return delete (((ref3 = _this.textEditors[textEditor.id]) != null ? ref3.autoIndent : void 0) != null);
            }
          }));
          _this.textEditors[textEditor.id].add(textEditor.onDidSave(function(event) {
            var filePath, lastSaveTime, ref;
            if (textEditor.getGrammar().packageName === LB) {
              filePath = textEditor.getPath();
              lastSaveTime = (ref = _this.fileSaveTimes[filePath]) != null ? ref : 0;
              _this.fileSaveTimes[filePath] = Date.now();
              if (lastSaveTime < (_this.fileSaveTimes[filePath] - INTERFILESAVETIME)) {
                return _this.transpiler.transpile(filePath, textEditor);
              }
            }
          }));
          return _this.textEditors[textEditor.id].add(textEditor.onDidDestroy(function() {
            var filePath, ref, ref1, ref2;
            if ((ref = _this.textEditors[textEditor.id]) != null) {
              if ((ref1 = ref.autoIndent) != null) {
                ref1.destroy();
              }
            }
            delete (((ref2 = _this.textEditors[textEditor.id]) != null ? ref2.autoIndent : void 0) != null);
            filePath = textEditor.getPath();
            if (_this.fileSaveTimes[filePath] != null) {
              delete _this.fileSaveTimes[filePath];
            }
            _this.textEditors[textEditor.id].dispose();
            return delete _this.textEditors[textEditor.id];
          }));
        };
      })(this)));
    },
    deactivate: function() {
      var disposeable, id, ref, ref1;
      this.disposable.dispose();
      ref = this.textEditors;
      for (id in ref) {
        disposeable = ref[id];
        if (this.textEditors[id].autoIndent != null) {
          this.textEditors[id].autoIndent.destroy();
          delete this.textEditors[id].autoIndent;
        }
        disposeable.dispose();
      }
      this.transpiler.stopAllTranspilerTask();
      this.transpiler.disposables.dispose();
      this.ttlGrammar.destroy();
      return (ref1 = this.mutateStatusGrammarNameObserver) != null ? ref1.disconnet() : void 0;
    },
    isPackageCompatible: function(activatedPackage) {
      var incompatiblePackage, incompatiblePackages, reason, results;
      incompatiblePackages = {
        'source-preview-babel': "Both vie to preview the same file.",
        'source-preview-react': "Both vie to preview the same file.",
        'react': "The Atom community package 'react' (not to be confused \nwith Facebook React) monkey patches the atom methods \nthat provide autoindent features for JSX. \nAs it detects JSX scopes without regard to the grammar being used, \nit tries to auto indent JSX that is highlighted by language-babel. \nAs language-babel also attempts to do auto indentation using \nstandard atom API's, this creates a potential conflict."
      };
      results = [];
      for (incompatiblePackage in incompatiblePackages) {
        reason = incompatiblePackages[incompatiblePackage];
        if (activatedPackage.name === incompatiblePackage) {
          results.push(atom.notifications.addInfo('Incompatible Package Detected', {
            dismissable: true,
            detail: "language-babel has detected the presence of an incompatible Atom package named '" + activatedPackage.name + "'. \n \nIt is recommended that you disable either '" + activatedPackage.name + "' or language-babel \n \nReason:\n \n" + reason
          }));
        } else {
          results.push(void 0);
        }
      }
      return results;
    },
    autoCompleteProvider: function() {
      return [autoCompleteJSX, autoCompleteStyledComponents, autoCompeteEmmetCSS];
    },
    provide: function() {
      return this.transpiler;
    },
    observeStatusBarGrammarName: function() {
      var config, mutateStatusGrammarNameObserver, ref, target;
      target = document.getElementsByTagName('grammar-selector-status');
      if (++observeStatusBarGrammarNameTimerCalled > 60) {
        clearInterval(observeStatusBarGrammarNameTimer);
        observeStatusBarGrammarNameTimerCalled = 0;
      }
      if (target.length === 1) {
        target = (ref = target[0].childNodes) != null ? ref[0] : void 0;
        if (target) {
          clearInterval(observeStatusBarGrammarNameTimer);
          this.mutateStatusBarGrammarName(target);
          mutateStatusGrammarNameObserver = new MutationObserver((function(_this) {
            return function(mutations) {
              return mutations.forEach(function(mutation) {
                return _this.mutateStatusBarGrammarName(mutation.target);
              });
            };
          })(this));
          config = {
            attributes: true,
            childList: false,
            characterData: false
          };
          return mutateStatusGrammarNameObserver.observe(target, config);
        }
      }
    },
    mutateStatusBarGrammarName: function(elem) {
      if ((elem != null ? elem.innerHTML : void 0) === 'Babel ES6 JavaScript') {
        return elem.innerHTML = 'Babel';
      }
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvbGFuZ3VhZ2UtYmFiZWwvbGliL21haW4uY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQUEsTUFBQTs7RUFBQyxzQkFBdUIsT0FBQSxDQUFRLE1BQVI7O0VBQ3hCLGVBQUEsR0FBa0IsT0FBQSxDQUFRLHFCQUFSOztFQUNsQiw0QkFBQSxHQUErQixPQUFBLENBQVEsbUNBQVI7O0VBQy9CLG1CQUFBLEdBQXNCLE9BQUEsQ0FBUSwyQkFBUjs7RUFDdEIsVUFBQSxHQUFhLE9BQUEsQ0FBUSxlQUFSOztFQUNiLFVBQUEsR0FBYSxPQUFBLENBQVEsc0JBQVI7O0VBRWIsaUJBQUEsR0FBb0I7O0VBQ3BCLEVBQUEsR0FBSzs7RUFDTCxnQ0FBQSxHQUFtQzs7RUFDbkMsc0NBQUEsR0FBeUM7O0VBRXpDLE1BQU0sQ0FBQyxPQUFQLEdBQ0U7SUFBQSxRQUFBLEVBQVUsU0FBQyxLQUFEO01BRVIsZ0NBQUEsR0FBbUMsV0FBQSxDQUFZLElBQUMsQ0FBQSwyQkFBMkIsQ0FBQyxJQUE3QixDQUFrQyxJQUFsQyxDQUFaLEVBQWtELElBQWxEO01BQ25DLDRCQUE0QixDQUFDLGNBQTdCLENBQUE7O1FBQ0EsSUFBQyxDQUFBLGFBQWMsSUFBSSxDQUFDLE9BQUEsQ0FBUSxjQUFSLENBQUQ7O01BQ25CLElBQUMsQ0FBQSxVQUFELEdBQWMsSUFBSSxVQUFKLENBQWUsSUFBZjtNQUVkLElBQUMsQ0FBQSxVQUFELEdBQWMsSUFBSTtNQUNsQixJQUFDLENBQUEsV0FBRCxHQUFlO01BQ2YsSUFBQyxDQUFBLGFBQUQsR0FBaUI7TUFFakIsSUFBQyxDQUFBLFVBQVUsQ0FBQyxHQUFaLENBQWdCLElBQUksQ0FBQyxRQUFRLENBQUMsb0JBQWQsQ0FBbUMsSUFBQyxDQUFBLG1CQUFwQyxDQUFoQjtNQUVBLElBQUMsQ0FBQSxVQUFVLENBQUMsR0FBWixDQUFnQixJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFiLENBQThCLENBQUEsU0FBQSxLQUFBO2VBQUEsU0FBQTtpQkFDNUMsS0FBQyxDQUFBLFVBQVUsQ0FBQyxlQUFaLENBQUE7UUFENEM7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQTlCLENBQWhCO2FBR0EsSUFBQyxDQUFBLFVBQVUsQ0FBQyxHQUFaLENBQWdCLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWYsQ0FBa0MsQ0FBQSxTQUFBLEtBQUE7ZUFBQSxTQUFDLFVBQUQ7VUFDaEQsS0FBQyxDQUFBLFdBQVksQ0FBQSxVQUFVLENBQUMsRUFBWCxDQUFiLEdBQThCLElBQUk7VUFFbEMsS0FBQyxDQUFBLFdBQVksQ0FBQSxVQUFVLENBQUMsRUFBWCxDQUFjLENBQUMsR0FBNUIsQ0FBZ0MsVUFBVSxDQUFDLGNBQVgsQ0FBMEIsU0FBQyxPQUFEO0FBRXhELGdCQUFBO1lBQUEsSUFBRyxVQUFVLENBQUMsVUFBWCxDQUFBLENBQXVCLENBQUMsV0FBeEIsS0FBdUMsRUFBMUM7MkVBQzZCLENBQUUsVUFBN0IsR0FBMEMsSUFBSSxVQUFKLENBQWUsVUFBZixXQUQ1QzthQUFBLE1BQUE7OztzQkFHeUMsQ0FBRSxPQUF6QyxDQUFBOzs7cUJBQ0EsT0FBTyx5RkFKVDs7VUFGd0QsQ0FBMUIsQ0FBaEM7VUFRQSxLQUFDLENBQUEsV0FBWSxDQUFBLFVBQVUsQ0FBQyxFQUFYLENBQWMsQ0FBQyxHQUE1QixDQUFnQyxVQUFVLENBQUMsU0FBWCxDQUFxQixTQUFDLEtBQUQ7QUFDbkQsZ0JBQUE7WUFBQSxJQUFHLFVBQVUsQ0FBQyxVQUFYLENBQUEsQ0FBdUIsQ0FBQyxXQUF4QixLQUF1QyxFQUExQztjQUNFLFFBQUEsR0FBVyxVQUFVLENBQUMsT0FBWCxDQUFBO2NBQ1gsWUFBQSx5REFBMEM7Y0FDMUMsS0FBQyxDQUFBLGFBQWMsQ0FBQSxRQUFBLENBQWYsR0FBMkIsSUFBSSxDQUFDLEdBQUwsQ0FBQTtjQUMzQixJQUFLLFlBQUEsR0FBZSxDQUFDLEtBQUMsQ0FBQSxhQUFjLENBQUEsUUFBQSxDQUFmLEdBQTJCLGlCQUE1QixDQUFwQjt1QkFDRSxLQUFDLENBQUEsVUFBVSxDQUFDLFNBQVosQ0FBc0IsUUFBdEIsRUFBZ0MsVUFBaEMsRUFERjtlQUpGOztVQURtRCxDQUFyQixDQUFoQztpQkFRQSxLQUFDLENBQUEsV0FBWSxDQUFBLFVBQVUsQ0FBQyxFQUFYLENBQWMsQ0FBQyxHQUE1QixDQUFnQyxVQUFVLENBQUMsWUFBWCxDQUF3QixTQUFBO0FBQ3RELGdCQUFBOzs7b0JBQXVDLENBQUUsT0FBekMsQ0FBQTs7O1lBQ0EsT0FBTztZQUNQLFFBQUEsR0FBVyxVQUFVLENBQUMsT0FBWCxDQUFBO1lBQ1gsSUFBRyxxQ0FBSDtjQUFrQyxPQUFPLEtBQUMsQ0FBQSxhQUFjLENBQUEsUUFBQSxFQUF4RDs7WUFDQSxLQUFDLENBQUEsV0FBWSxDQUFBLFVBQVUsQ0FBQyxFQUFYLENBQWMsQ0FBQyxPQUE1QixDQUFBO21CQUNBLE9BQU8sS0FBQyxDQUFBLFdBQVksQ0FBQSxVQUFVLENBQUMsRUFBWDtVQU5rQyxDQUF4QixDQUFoQztRQW5CZ0Q7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWxDLENBQWhCO0lBaEJRLENBQVY7SUEyQ0EsVUFBQSxFQUFZLFNBQUE7QUFDVixVQUFBO01BQUEsSUFBQyxDQUFBLFVBQVUsQ0FBQyxPQUFaLENBQUE7QUFDQTtBQUFBLFdBQUEsU0FBQTs7UUFDRSxJQUFHLHVDQUFIO1VBQ0UsSUFBQyxDQUFBLFdBQVksQ0FBQSxFQUFBLENBQUcsQ0FBQyxVQUFVLENBQUMsT0FBNUIsQ0FBQTtVQUNBLE9BQU8sSUFBQyxDQUFBLFdBQVksQ0FBQSxFQUFBLENBQUcsQ0FBQyxXQUYxQjs7UUFHQSxXQUFXLENBQUMsT0FBWixDQUFBO0FBSkY7TUFLQSxJQUFDLENBQUEsVUFBVSxDQUFDLHFCQUFaLENBQUE7TUFDQSxJQUFDLENBQUEsVUFBVSxDQUFDLFdBQVcsQ0FBQyxPQUF4QixDQUFBO01BQ0EsSUFBQyxDQUFBLFVBQVUsQ0FBQyxPQUFaLENBQUE7eUVBQ2dDLENBQUUsU0FBbEMsQ0FBQTtJQVZVLENBM0NaO0lBd0RBLG1CQUFBLEVBQXFCLFNBQUMsZ0JBQUQ7QUFDbkIsVUFBQTtNQUFBLG9CQUFBLEdBQXVCO1FBQ3JCLHNCQUFBLEVBQ0Usb0NBRm1CO1FBR3JCLHNCQUFBLEVBQ0Usb0NBSm1CO1FBS3JCLE9BQUEsRUFDRSw4WkFObUI7O0FBZXZCO1dBQUEsMkNBQUE7O1FBQ0UsSUFBRyxnQkFBZ0IsQ0FBQyxJQUFqQixLQUF5QixtQkFBNUI7dUJBQ0UsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFuQixDQUEyQiwrQkFBM0IsRUFDRTtZQUFBLFdBQUEsRUFBYSxJQUFiO1lBQ0EsTUFBQSxFQUFRLGtGQUFBLEdBQ21DLGdCQUFnQixDQUFDLElBRHBELEdBQ3lELHFEQUR6RCxHQUVrRCxnQkFBZ0IsQ0FBQyxJQUZuRSxHQUV3RSx1Q0FGeEUsR0FHbUIsTUFKM0I7V0FERixHQURGO1NBQUEsTUFBQTsrQkFBQTs7QUFERjs7SUFoQm1CLENBeERyQjtJQWtGQSxvQkFBQSxFQUFzQixTQUFBO2FBQ3BCLENBQUMsZUFBRCxFQUFrQiw0QkFBbEIsRUFBZ0QsbUJBQWhEO0lBRG9CLENBbEZ0QjtJQXNGQSxPQUFBLEVBQVEsU0FBQTthQUNOLElBQUMsQ0FBQTtJQURLLENBdEZSO0lBNkZBLDJCQUFBLEVBQTZCLFNBQUE7QUFFM0IsVUFBQTtNQUFBLE1BQUEsR0FBUyxRQUFRLENBQUMsb0JBQVQsQ0FBOEIseUJBQTlCO01BR1QsSUFBRyxFQUFFLHNDQUFGLEdBQTJDLEVBQTlDO1FBQ0UsYUFBQSxDQUFjLGdDQUFkO1FBQ0Esc0NBQUEsR0FBeUMsRUFGM0M7O01BS0EsSUFBRyxNQUFNLENBQUMsTUFBUCxLQUFpQixDQUFwQjtRQUNFLE1BQUEsNkNBQStCLENBQUEsQ0FBQTtRQUUvQixJQUFHLE1BQUg7VUFFRSxhQUFBLENBQWMsZ0NBQWQ7VUFFQSxJQUFDLENBQUEsMEJBQUQsQ0FBNEIsTUFBNUI7VUFHQSwrQkFBQSxHQUFrQyxJQUFJLGdCQUFKLENBQXFCLENBQUEsU0FBQSxLQUFBO21CQUFBLFNBQUMsU0FBRDtxQkFDckQsU0FBUyxDQUFDLE9BQVYsQ0FBbUIsU0FBQyxRQUFEO3VCQUNmLEtBQUMsQ0FBQSwwQkFBRCxDQUE0QixRQUFRLENBQUMsTUFBckM7Y0FEZSxDQUFuQjtZQURxRDtVQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBckI7VUFLbEMsTUFBQSxHQUFTO1lBQUUsVUFBQSxFQUFZLElBQWQ7WUFBb0IsU0FBQSxFQUFXLEtBQS9CO1lBQXNDLGFBQUEsRUFBZSxLQUFyRDs7aUJBR1QsK0JBQStCLENBQUMsT0FBaEMsQ0FBd0MsTUFBeEMsRUFBZ0QsTUFBaEQsRUFmRjtTQUhGOztJQVYyQixDQTdGN0I7SUE2SEEsMEJBQUEsRUFBNEIsU0FBQyxJQUFEO01BQzFCLG9CQUFHLElBQUksQ0FBRSxtQkFBTixLQUFtQixzQkFBdEI7ZUFDRSxJQUFJLENBQUMsU0FBTCxHQUFpQixRQURuQjs7SUFEMEIsQ0E3SDVCOztBQWJGIiwic291cmNlc0NvbnRlbnQiOlsie0NvbXBvc2l0ZURpc3Bvc2FibGV9ID0gcmVxdWlyZSAnYXRvbSdcbmF1dG9Db21wbGV0ZUpTWCA9IHJlcXVpcmUgJy4vYXV0by1jb21wbGV0ZS1qc3gnXG5hdXRvQ29tcGxldGVTdHlsZWRDb21wb25lbnRzID0gcmVxdWlyZSAnLi9hdXRvLWNvbXBsZXRlLXN0eWxlZC1jb21wb25lbnRzJ1xuYXV0b0NvbXBldGVFbW1ldENTUyA9IHJlcXVpcmUgJy4vYXV0by1jb21wbGV0ZS1lbW1ldC1jc3MnXG5BdXRvSW5kZW50ID0gcmVxdWlyZSAnLi9hdXRvLWluZGVudCdcbnR0bEdyYW1tYXIgPSByZXF1aXJlICcuL2NyZWF0ZS10dGwtZ3JhbW1hcidcblxuSU5URVJGSUxFU0FWRVRJTUUgPSAxMDAwXG5MQiA9ICdsYW5ndWFnZS1iYWJlbCdcbm9ic2VydmVTdGF0dXNCYXJHcmFtbWFyTmFtZVRpbWVyID0gbnVsbFxub2JzZXJ2ZVN0YXR1c0JhckdyYW1tYXJOYW1lVGltZXJDYWxsZWQgPSAwXG5cbm1vZHVsZS5leHBvcnRzID1cbiAgYWN0aXZhdGU6IChzdGF0ZSkgLT5cbiAgICAjIHJ1biBvYnNlcnZlU3RhdHVzQmFyR3JhbW1hck5hbWUgdW50aWwgQXRvbSBoYXMgY3JlYXRlZCB0aGUgU3RhdHVzIEJhciBHcmFtbWFyIE5hbWUgRE9NIG5vZGVcbiAgICBvYnNlcnZlU3RhdHVzQmFyR3JhbW1hck5hbWVUaW1lciA9IHNldEludGVydmFsKEBvYnNlcnZlU3RhdHVzQmFyR3JhbW1hck5hbWUuYmluZChAKSwgMTAwMClcbiAgICBhdXRvQ29tcGxldGVTdHlsZWRDb21wb25lbnRzLmxvYWRQcm9wZXJ0aWVzKClcbiAgICBAdHJhbnNwaWxlciA/PSBuZXcgKHJlcXVpcmUgJy4vdHJhbnNwaWxlcicpXG4gICAgQHR0bEdyYW1tYXIgPSBuZXcgdHRsR3JhbW1hcih0cnVlKVxuICAgICMgdHJhY2sgYW55IGZpbGUgc2F2ZSBldmVudHMgYW5kIHRyYW5zcGlsZSBpZiBiYWJlbFxuICAgIEBkaXNwb3NhYmxlID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgICBAdGV4dEVkaXRvcnMgPSB7fVxuICAgIEBmaWxlU2F2ZVRpbWVzID0ge31cblxuICAgIEBkaXNwb3NhYmxlLmFkZCBhdG9tLnBhY2thZ2VzLm9uRGlkQWN0aXZhdGVQYWNrYWdlIEBpc1BhY2thZ2VDb21wYXRpYmxlXG5cbiAgICBAZGlzcG9zYWJsZS5hZGQgYXRvbS5wcm9qZWN0Lm9uRGlkQ2hhbmdlUGF0aHMgPT5cbiAgICAgIEB0cmFuc3BpbGVyLnN0b3BVbnVzZWRUYXNrcygpXG5cbiAgICBAZGlzcG9zYWJsZS5hZGQgYXRvbS53b3Jrc3BhY2Uub2JzZXJ2ZVRleHRFZGl0b3JzICh0ZXh0RWRpdG9yKSA9PlxuICAgICAgQHRleHRFZGl0b3JzW3RleHRFZGl0b3IuaWRdID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGVcblxuICAgICAgQHRleHRFZGl0b3JzW3RleHRFZGl0b3IuaWRdLmFkZCB0ZXh0RWRpdG9yLm9ic2VydmVHcmFtbWFyIChncmFtbWFyKSA9PlxuICAgICAgICAjIEluc3RhbnRpYXRlIGluZGVudG9yIGZvciBsYW5ndWFnZS1iYWJlbCBmaWxlc1xuICAgICAgICBpZiB0ZXh0RWRpdG9yLmdldEdyYW1tYXIoKS5wYWNrYWdlTmFtZSBpcyBMQlxuICAgICAgICAgIEB0ZXh0RWRpdG9yc1t0ZXh0RWRpdG9yLmlkXT8uYXV0b0luZGVudCA9IG5ldyBBdXRvSW5kZW50KHRleHRFZGl0b3IpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBAdGV4dEVkaXRvcnNbdGV4dEVkaXRvci5pZF0/LmF1dG9JbmRlbnQ/LmRlc3Ryb3koKVxuICAgICAgICAgIGRlbGV0ZSBAdGV4dEVkaXRvcnNbdGV4dEVkaXRvci5pZF0/LmF1dG9JbmRlbnQ/XG5cbiAgICAgIEB0ZXh0RWRpdG9yc1t0ZXh0RWRpdG9yLmlkXS5hZGQgdGV4dEVkaXRvci5vbkRpZFNhdmUgKGV2ZW50KSA9PlxuICAgICAgICBpZiB0ZXh0RWRpdG9yLmdldEdyYW1tYXIoKS5wYWNrYWdlTmFtZSBpcyBMQlxuICAgICAgICAgIGZpbGVQYXRoID0gdGV4dEVkaXRvci5nZXRQYXRoKClcbiAgICAgICAgICBsYXN0U2F2ZVRpbWUgPSBAZmlsZVNhdmVUaW1lc1tmaWxlUGF0aF0gPyAwXG4gICAgICAgICAgQGZpbGVTYXZlVGltZXNbZmlsZVBhdGhdID0gRGF0ZS5ub3coKVxuICAgICAgICAgIGlmICAobGFzdFNhdmVUaW1lIDwgKEBmaWxlU2F2ZVRpbWVzW2ZpbGVQYXRoXSAtIElOVEVSRklMRVNBVkVUSU1FKSlcbiAgICAgICAgICAgIEB0cmFuc3BpbGVyLnRyYW5zcGlsZShmaWxlUGF0aCwgdGV4dEVkaXRvcilcblxuICAgICAgQHRleHRFZGl0b3JzW3RleHRFZGl0b3IuaWRdLmFkZCB0ZXh0RWRpdG9yLm9uRGlkRGVzdHJveSAoKSA9PlxuICAgICAgICBAdGV4dEVkaXRvcnNbdGV4dEVkaXRvci5pZF0/LmF1dG9JbmRlbnQ/LmRlc3Ryb3koKVxuICAgICAgICBkZWxldGUgQHRleHRFZGl0b3JzW3RleHRFZGl0b3IuaWRdPy5hdXRvSW5kZW50P1xuICAgICAgICBmaWxlUGF0aCA9IHRleHRFZGl0b3IuZ2V0UGF0aCgpXG4gICAgICAgIGlmIEBmaWxlU2F2ZVRpbWVzW2ZpbGVQYXRoXT8gdGhlbiBkZWxldGUgQGZpbGVTYXZlVGltZXNbZmlsZVBhdGhdXG4gICAgICAgIEB0ZXh0RWRpdG9yc1t0ZXh0RWRpdG9yLmlkXS5kaXNwb3NlKClcbiAgICAgICAgZGVsZXRlIEB0ZXh0RWRpdG9yc1t0ZXh0RWRpdG9yLmlkXVxuXG4gIGRlYWN0aXZhdGU6IC0+XG4gICAgQGRpc3Bvc2FibGUuZGlzcG9zZSgpXG4gICAgZm9yIGlkLCBkaXNwb3NlYWJsZSBvZiBAdGV4dEVkaXRvcnNcbiAgICAgIGlmIEB0ZXh0RWRpdG9yc1tpZF0uYXV0b0luZGVudD9cbiAgICAgICAgQHRleHRFZGl0b3JzW2lkXS5hdXRvSW5kZW50LmRlc3Ryb3koKVxuICAgICAgICBkZWxldGUgQHRleHRFZGl0b3JzW2lkXS5hdXRvSW5kZW50XG4gICAgICBkaXNwb3NlYWJsZS5kaXNwb3NlKClcbiAgICBAdHJhbnNwaWxlci5zdG9wQWxsVHJhbnNwaWxlclRhc2soKVxuICAgIEB0cmFuc3BpbGVyLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuICAgIEB0dGxHcmFtbWFyLmRlc3Ryb3koKVxuICAgIEBtdXRhdGVTdGF0dXNHcmFtbWFyTmFtZU9ic2VydmVyPy5kaXNjb25uZXQoKVxuXG4gICMgd2FybnMgaWYgYW4gYWN0aXZhdGVkIHBhY2thZ2UgaXMgb24gdGhlIGluY29tcGF0aWJsZSBsaXN0XG4gIGlzUGFja2FnZUNvbXBhdGlibGU6IChhY3RpdmF0ZWRQYWNrYWdlKSAtPlxuICAgIGluY29tcGF0aWJsZVBhY2thZ2VzID0ge1xuICAgICAgJ3NvdXJjZS1wcmV2aWV3LWJhYmVsJzpcbiAgICAgICAgXCJCb3RoIHZpZSB0byBwcmV2aWV3IHRoZSBzYW1lIGZpbGUuXCJcbiAgICAgICdzb3VyY2UtcHJldmlldy1yZWFjdCc6XG4gICAgICAgIFwiQm90aCB2aWUgdG8gcHJldmlldyB0aGUgc2FtZSBmaWxlLlwiXG4gICAgICAncmVhY3QnOlxuICAgICAgICBcIlRoZSBBdG9tIGNvbW11bml0eSBwYWNrYWdlICdyZWFjdCcgKG5vdCB0byBiZSBjb25mdXNlZFxuICAgICAgICBcXG53aXRoIEZhY2Vib29rIFJlYWN0KSBtb25rZXkgcGF0Y2hlcyB0aGUgYXRvbSBtZXRob2RzXG4gICAgICAgIFxcbnRoYXQgcHJvdmlkZSBhdXRvaW5kZW50IGZlYXR1cmVzIGZvciBKU1guXG4gICAgICAgIFxcbkFzIGl0IGRldGVjdHMgSlNYIHNjb3BlcyB3aXRob3V0IHJlZ2FyZCB0byB0aGUgZ3JhbW1hciBiZWluZyB1c2VkLFxuICAgICAgICBcXG5pdCB0cmllcyB0byBhdXRvIGluZGVudCBKU1ggdGhhdCBpcyBoaWdobGlnaHRlZCBieSBsYW5ndWFnZS1iYWJlbC5cbiAgICAgICAgXFxuQXMgbGFuZ3VhZ2UtYmFiZWwgYWxzbyBhdHRlbXB0cyB0byBkbyBhdXRvIGluZGVudGF0aW9uIHVzaW5nXG4gICAgICAgIFxcbnN0YW5kYXJkIGF0b20gQVBJJ3MsIHRoaXMgY3JlYXRlcyBhIHBvdGVudGlhbCBjb25mbGljdC5cIlxuICAgIH1cblxuICAgIGZvciBpbmNvbXBhdGlibGVQYWNrYWdlLCByZWFzb24gb2YgaW5jb21wYXRpYmxlUGFja2FnZXNcbiAgICAgIGlmIGFjdGl2YXRlZFBhY2thZ2UubmFtZSBpcyBpbmNvbXBhdGlibGVQYWNrYWdlXG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRJbmZvICdJbmNvbXBhdGlibGUgUGFja2FnZSBEZXRlY3RlZCcsXG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWVcbiAgICAgICAgICBkZXRhaWw6IFwibGFuZ3VhZ2UtYmFiZWwgaGFzIGRldGVjdGVkIHRoZSBwcmVzZW5jZSBvZiBhblxuICAgICAgICAgICAgICAgICAgaW5jb21wYXRpYmxlIEF0b20gcGFja2FnZSBuYW1lZCAnI3thY3RpdmF0ZWRQYWNrYWdlLm5hbWV9Jy5cbiAgICAgICAgICAgICAgICAgIFxcbiBcXG5JdCBpcyByZWNvbW1lbmRlZCB0aGF0IHlvdSBkaXNhYmxlIGVpdGhlciAnI3thY3RpdmF0ZWRQYWNrYWdlLm5hbWV9JyBvciBsYW5ndWFnZS1iYWJlbFxuICAgICAgICAgICAgICAgICAgXFxuIFxcblJlYXNvbjpcXG4gXFxuI3tyZWFzb259XCJcblxuICAjIGF1dG9jb21wbGV0ZS1wbHVzIHByb3ZpZGVyc1xuICBhdXRvQ29tcGxldGVQcm92aWRlcjogLT5cbiAgICBbYXV0b0NvbXBsZXRlSlNYLCBhdXRvQ29tcGxldGVTdHlsZWRDb21wb25lbnRzLCBhdXRvQ29tcGV0ZUVtbWV0Q1NTXVxuXG4gICMgcHJldmlldyB0cmFucGlsZSBwcm92aWRlclxuICBwcm92aWRlOi0+XG4gICAgQHRyYW5zcGlsZXJcblxuXG4gICMgS2x1ZGdlIHRvIGNoYW5nZSB0aGUgZ3JhbW1hciBuYW1lIGluIHRoZSBzdGF0dXMgYmFyIGZyb20gQmFiZWwgRVM2IEphdmFTY2lwdCB0byBCYWJlbFxuICAjIFRoZSBncmFtbWFyIG5hbWUgc3RpbGwgcmVtYWlucyB0aGUgc2FtZSBmb3IgY29tcGF0aWJpbHR5IHdpdGggb3RoZXIgcGFja2FnZXMgc3VjaCBhcyBhdG9tLWJlYXV0aWZ5XG4gICMgYnV0IGlzIG1vcmUgbWVhbmluZ2Z1bCBhbmQgc2hvcnRlciBvbiB0aGUgc3RhdHVzIGJhci5cbiAgb2JzZXJ2ZVN0YXR1c0JhckdyYW1tYXJOYW1lOiAtPlxuICAgICMgc2VsZWN0IHRoZSB0YXJnZXQgbm9kZVxuICAgIHRhcmdldCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdncmFtbWFyLXNlbGVjdG9yLXN0YXR1cycpO1xuXG4gICAgIyBvbmx5IHJ1biB0aGlzIGZvciBzbyBtYW55IGN5Y2xlcyB3aXRob3V0IGdldHRpbmcgYSB2YWxpZCBkb20gbm9kZVxuICAgIGlmICsrb2JzZXJ2ZVN0YXR1c0JhckdyYW1tYXJOYW1lVGltZXJDYWxsZWQgPiA2MFxuICAgICAgY2xlYXJJbnRlcnZhbChvYnNlcnZlU3RhdHVzQmFyR3JhbW1hck5hbWVUaW1lcilcbiAgICAgIG9ic2VydmVTdGF0dXNCYXJHcmFtbWFyTmFtZVRpbWVyQ2FsbGVkID0gMFxuXG4gICAgIyBvbmx5IGV4cGVjdCBhIHNpbmdsZSBjaGlsZCAoZ3JhbW1hciBuYW1lKSBmb3IgdGhpcyBET00gTm9kZVxuICAgIGlmIHRhcmdldC5sZW5ndGggaXMgMVxuICAgICAgdGFyZ2V0ID0gdGFyZ2V0WzBdLmNoaWxkTm9kZXM/WzBdXG5cbiAgICAgIGlmIHRhcmdldFxuICAgICAgICAjIGRvbid0IHJ1biBhZ2FpbiBhcyB3ZSBhcmUgbm93IG9ic2VydmluZ1xuICAgICAgICBjbGVhckludGVydmFsKG9ic2VydmVTdGF0dXNCYXJHcmFtbWFyTmFtZVRpbWVyKVxuXG4gICAgICAgIEBtdXRhdGVTdGF0dXNCYXJHcmFtbWFyTmFtZSh0YXJnZXQpXG5cbiAgICAgICAgIyBjcmVhdGUgYW4gb2JzZXJ2ZXIgaW5zdGFuY2VcbiAgICAgICAgbXV0YXRlU3RhdHVzR3JhbW1hck5hbWVPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyIChtdXRhdGlvbnMpID0+XG4gICAgICAgICAgbXV0YXRpb25zLmZvckVhY2ggIChtdXRhdGlvbikgPT5cbiAgICAgICAgICAgICAgQG11dGF0ZVN0YXR1c0JhckdyYW1tYXJOYW1lKG11dGF0aW9uLnRhcmdldClcblxuICAgICAgICAjIGNvbmZpZ3VyYXRpb24gb2YgdGhlIG9ic2VydmVyOlxuICAgICAgICBjb25maWcgPSB7IGF0dHJpYnV0ZXM6IHRydWUsIGNoaWxkTGlzdDogZmFsc2UsIGNoYXJhY3RlckRhdGE6IGZhbHNlIH1cblxuICAgICAgICAjIHBhc3MgaW4gdGhlIHRhcmdldCBub2RlLCBhcyB3ZWxsIGFzIHRoZSBvYnNlcnZlciBvcHRpb25zXG4gICAgICAgIG11dGF0ZVN0YXR1c0dyYW1tYXJOYW1lT2JzZXJ2ZXIub2JzZXJ2ZSh0YXJnZXQsIGNvbmZpZyk7XG5cblxuICAjIGNoYW5nZSBuYW1lIGluIHN0YXR1cyBiYXJcbiAgbXV0YXRlU3RhdHVzQmFyR3JhbW1hck5hbWU6IChlbGVtKSAtPlxuICAgIGlmIGVsZW0/LmlubmVySFRNTCBpcyAnQmFiZWwgRVM2IEphdmFTY3JpcHQnXG4gICAgICBlbGVtLmlubmVySFRNTCA9ICdCYWJlbCdcbiJdfQ==
