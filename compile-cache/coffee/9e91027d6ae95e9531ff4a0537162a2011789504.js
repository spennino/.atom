(function() {
  var CompositeDisposable, Disposable, Emitter, HgRepository, HgUtils, ref,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  ref = require('event-kit'), Emitter = ref.Emitter, Disposable = ref.Disposable, CompositeDisposable = ref.CompositeDisposable;

  HgUtils = require('./hg-utils');

  module.exports = HgRepository = (function() {

    /*
    Section: Construction and Destruction
     */
    HgRepository.open = function(path, options) {
      if (options == null) {
        options = {};
      }
      if (!path) {
        return null;
      }
      try {
        return new HgRepository(path, options);
      } catch (error) {
        return null;
      }
    };

    function HgRepository(path, options) {
      var diffRevisionProvider, onWindowFocus, refreshOnWindowFocus;
      if (options == null) {
        options = {};
      }
      this.getCachedHgFileContent = bind(this.getCachedHgFileContent, this);
      this.project = options.project, refreshOnWindowFocus = options.refreshOnWindowFocus, diffRevisionProvider = options.diffRevisionProvider;
      if (diffRevisionProvider == null) {
        diffRevisionProvider = function() {
          return '.';
        };
      }
      this.emitter = new Emitter;
      this.subscriptions = new CompositeDisposable;
      this.repo = HgUtils.open(path, diffRevisionProvider);
      this.shortHead = null;
      if (this.repo == null) {
        throw new Error("No Mercurial repository found searching path: " + path);
      }
      this.path = path;
      this.symlink = HgUtils.resolveSymlink(path);
      this.statuses = {};
      this.upstream = {
        ahead: 0,
        behind: 0
      };
      this.cachedIgnoreStatuses = [];
      this.cachedHgFileContent = {};
      if (refreshOnWindowFocus == null) {
        refreshOnWindowFocus = true;
      }
      if (refreshOnWindowFocus) {
        onWindowFocus = (function(_this) {
          return function() {
            _this.refreshIndex();
            return _this.refreshStatus();
          };
        })(this);
        window.addEventListener('focus', onWindowFocus);
        this.subscriptions.add(new Disposable(function() {
          return window.removeEventListener('focus', onWindowFocus);
        }));
      }
      if (this.project != null) {
        this.project.getBuffers().forEach((function(_this) {
          return function(buffer) {
            return _this.subscribeToBuffer(buffer);
          };
        })(this));
        this.subscriptions.add(this.project.onDidAddBuffer((function(_this) {
          return function(buffer) {
            return _this.subscribeToBuffer(buffer);
          };
        })(this)));
      }
    }

    HgRepository.prototype.destroy = function() {
      if (this.emitter != null) {
        this.emitter.emit('did-destroy');
        this.emitter.dispose();
        this.emitter = null;
      }
      if (this.repo != null) {
        this.repo = null;
      }
      if (this.subscriptions != null) {
        this.subscriptions.dispose();
        return this.subscriptions = null;
      }
    };


    /*
    Section: Event Subscription
     */

    HgRepository.prototype.onDidDestroy = function(callback) {
      return this.emitter.on('did-destroy', callback);
    };

    HgRepository.prototype.onDidChangeStatus = function(callback) {
      return this.emitter.on('did-change-status', callback);
    };

    HgRepository.prototype.onDidChangeStatuses = function(callback) {
      return this.emitter.on('did-change-statuses', callback);
    };


    /*
    Section: Repository Details
     */

    HgRepository.prototype.getType = function() {
      return 'hg';
    };

    HgRepository.prototype.getPath = function() {
      return this.path != null ? this.path : this.path = this.getRepo().getPath();
    };

    HgRepository.prototype.setWorkingDirectory = function(workingDirectory) {
      return this.workingDirectory = workingDirectory;
    };

    HgRepository.prototype.getWorkingDirectory = function() {
      return this.workingDirectory;
    };

    HgRepository.prototype.isProjectAtRoot = function() {
      var ref1;
      return this.projectAtRoot != null ? this.projectAtRoot : this.projectAtRoot = ((ref1 = this.project) != null ? ref1.relativize(this.getPath()) : void 0) === '';
    };

    HgRepository.prototype.relativize = function(path) {
      return null;
    };

    HgRepository.prototype.slashPath = function(path) {
      if (!path) {
        return path;
      }
      if (this.symlink) {
        path = path.replace(this.path, this.symlink);
      }
      if (path && path.indexOf('..') === 0) {
        path = path.replace('..', '');
      }
      if (process.platform === 'win32') {
        return path.replace(/\\/g, '/');
      } else {
        return path;
      }
    };

    HgRepository.prototype.hasBranch = function(branch) {
      return null;
    };

    HgRepository.prototype.getShortHead = function(path) {
      this.getRepo(path).getShortHeadAsync().then((function(_this) {
        return function(shortHead) {
          if (_this.shortHead === shortHead) {
            return;
          }
          _this.shortHead = shortHead;
          return _this.emitter.emit('did-change-statuses');
        };
      })(this));
      return this.shortHead;
    };

    HgRepository.prototype.isSubmodule = function(path) {
      return null;
    };

    HgRepository.prototype.getAheadBehindCount = function(reference, path) {
      return null;
    };

    HgRepository.prototype.getCachedUpstreamAheadBehindCount = function(path) {
      return {
        ahead: 0,
        behind: 0
      };
    };

    HgRepository.prototype.getConfigValue = function(key, path) {
      return null;
    };

    HgRepository.prototype.getOriginUrl = function(path) {
      return null;
    };

    HgRepository.prototype.getUpstreamBranch = function(path) {
      return null;
    };

    HgRepository.prototype.getReferences = function(path) {
      return null;
    };

    HgRepository.prototype.getReferenceTarget = function(reference, path) {
      return null;
    };


    /*
    Section: Reading Status
     */

    HgRepository.prototype.isPathModified = function(path) {
      return this.isStatusModified(this.getPathStatus(path));
    };

    HgRepository.prototype.isPathNew = function(path) {
      return this.isStatusNew(this.getPathStatus(path));
    };

    HgRepository.prototype.isPathIgnored = function(path) {
      return this.cachedIgnoreStatuses.indexOf(this.slashPath(path)) !== -1;
    };

    HgRepository.prototype.isPathStaged = function(path) {
      return this.isStatusStaged(this.getPathStatus(path));
    };

    HgRepository.prototype.getDirectoryStatus = function(directoryPath) {
      var directoryStatus, path, ref1, status;
      directoryPath = (this.slashPath(directoryPath)) + "/";
      directoryStatus = 0;
      ref1 = this.statuses;
      for (path in ref1) {
        status = ref1[path];
        if (path.indexOf(directoryPath) === 0) {
          directoryStatus |= status;
        }
      }
      return directoryStatus;
    };

    HgRepository.prototype.getPathStatus = function(path) {
      var currentPathStatus, pathStatus, ref1, ref2, relativePath, repo;
      repo = this.getRepo();
      relativePath = this.slashPath(path);
      currentPathStatus = (ref1 = this.statuses[relativePath]) != null ? ref1 : 0;
      pathStatus = (ref2 = repo.getPathStatus(relativePath)) != null ? ref2 : 0;
      if (repo.isStatusIgnored(pathStatus)) {
        pathStatus = 0;
      }
      if (pathStatus > 0) {
        this.statuses[relativePath] = pathStatus;
      } else {
        delete this.statuses[relativePath];
      }
      if (currentPathStatus !== pathStatus) {
        this.emitter.emit('did-change-status', {
          path: path,
          pathStatus: pathStatus
        });
      }
      return pathStatus;
    };

    HgRepository.prototype.getCachedPathStatus = function(path) {
      if (!path) {
        return;
      }
      return this.statuses[this.slashPath(path)];
    };

    HgRepository.prototype.isStatusModified = function(status) {
      return this.getRepo().isStatusModified(status);
    };

    HgRepository.prototype.isStatusNew = function(status) {
      return this.getRepo().isStatusNew(status);
    };

    HgRepository.prototype.isStatusIgnored = function(status) {
      return this.getRepo().isStatusIgnored(status);
    };

    HgRepository.prototype.isStatusStaged = function(status) {
      return this.getRepo().isStatusStaged(status);
    };


    /*
    Section: Retrieving Diffs
     */

    HgRepository.prototype.getCachedHgFileContent = function(path) {
      var slashedPath;
      slashedPath = this.slashPath(path);
      if (!this.cachedHgFileContent[slashedPath]) {
        this.repo.getHgCatAsync(path).then((function(_this) {
          return function(contents) {
            var contentsChanged;
            contentsChanged = _this.cachedHgFileContent[slashedPath] !== contents;
            _this.cachedHgFileContent[slashedPath] = contents;
            if (contentsChanged) {
              return _this.getPathStatus(path);
            }
          };
        })(this));
      }
      return this.cachedHgFileContent[slashedPath];
    };

    HgRepository.prototype.getDiffStats = function(path) {
      return this.getRepo().getDiffStats(this.slashPath(path), this.getCachedHgFileContent(path));
    };

    HgRepository.prototype.getLineDiffs = function(path, text) {
      var options, repo;
      options = {
        ignoreEolWhitespace: process.platform === 'win32'
      };
      repo = this.getRepo();
      return repo.getLineDiffs(this.getCachedHgFileContent(path), text, options);
    };


    /*
    Section: Checking Out
     */

    HgRepository.prototype.checkoutHead = function(path) {
      return null;
    };

    HgRepository.prototype.checkoutReference = function(reference, create) {
      return null;
    };


    /*
    Section: Private
     */

    HgRepository.prototype.subscribeToBuffer = function(buffer) {
      var bufferSubscriptions, getBufferPathStatus;
      getBufferPathStatus = (function(_this) {
        return function() {
          var path;
          if (path = buffer.getPath()) {
            return _this.getPathStatus(path);
          }
        };
      })(this);
      bufferSubscriptions = new CompositeDisposable;
      bufferSubscriptions.add(buffer.onDidSave(getBufferPathStatus));
      bufferSubscriptions.add(buffer.onDidReload(getBufferPathStatus));
      bufferSubscriptions.add(buffer.onDidChangePath(getBufferPathStatus));
      bufferSubscriptions.add(buffer.onDidDestroy((function(_this) {
        return function() {
          bufferSubscriptions.dispose();
          return _this.subscriptions.remove(bufferSubscriptions);
        };
      })(this)));
      this.subscriptions.add(bufferSubscriptions);
    };

    HgRepository.prototype.checkoutHeadForEditor = function(editor) {
      return null;
    };

    HgRepository.prototype.getRepo = function() {
      if (this.repo != null) {
        return this.repo;
      } else {
        throw new Error("Repository has been destroyed");
      }
    };

    HgRepository.prototype.refreshIndex = function() {
      return null;
    };

    HgRepository.prototype.refreshStatus = function() {
      return this.getRepo().getRecursiveIgnoreStatuses().then((function(_this) {
        return function(allIgnored) {
          var ignored, statusesDidChange;
          _this.cachedIgnoreStatuses = (function() {
            var i, len, results;
            results = [];
            for (i = 0, len = allIgnored.length; i < len; i++) {
              ignored = allIgnored[i];
              results.push(this.slashPath(ignored));
            }
            return results;
          }).call(_this);
          statusesDidChange = false;
          return _this.getRepo().checkRepositoryHasChangedAsync().then(function(hasChanged) {
            if (hasChanged) {
              _this.statuses = {};
              _this.cachedHgFileContent = {};
              statusesDidChange = true;
            }
            return _this.getRepo().getStatus().then(function(statuses) {
              var i, len, path, ref1, slashedPath, status;
              for (i = 0, len = statuses.length; i < len; i++) {
                ref1 = statuses[i], status = ref1.status, path = ref1.path;
                slashedPath = _this.slashPath(path);
                if (_this.statuses[slashedPath] !== status) {
                  _this.statuses[slashedPath] = status;
                  statusesDidChange = true;
                }
              }
              if (statusesDidChange) {
                return _this.emitter.emit('did-change-statuses');
              }
            });
          });
        };
      })(this));
    };

    return HgRepository;

  })();

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvYXRvbS1oZy9saWIvaGctcmVwb3NpdG9yeS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBLG9FQUFBO0lBQUE7O0VBQUEsTUFBNkMsT0FBQSxDQUFRLFdBQVIsQ0FBN0MsRUFBQyxxQkFBRCxFQUFVLDJCQUFWLEVBQXNCOztFQUV0QixPQUFBLEdBQVUsT0FBQSxDQUFRLFlBQVI7O0VBRVYsTUFBTSxDQUFDLE9BQVAsR0FDTTs7QUFLSjs7O0lBY0EsWUFBQyxDQUFBLElBQUQsR0FBTyxTQUFDLElBQUQsRUFBTyxPQUFQOztRQUFPLFVBQVE7O01BQ3BCLElBQUEsQ0FBbUIsSUFBbkI7QUFBQSxlQUFPLEtBQVA7O0FBQ0E7ZUFDRSxJQUFJLFlBQUosQ0FBaUIsSUFBakIsRUFBdUIsT0FBdkIsRUFERjtPQUFBLGFBQUE7ZUFHRSxLQUhGOztJQUZLOztJQU9NLHNCQUFDLElBQUQsRUFBTyxPQUFQO0FBQ1gsVUFBQTs7UUFEa0IsVUFBUTs7O01BQ3pCLElBQUMsQ0FBQSxrQkFBQSxPQUFGLEVBQVcsbURBQVgsRUFBaUM7O1FBQ2pDLHVCQUF3QixTQUFBO2lCQUFHO1FBQUg7O01BRXhCLElBQUMsQ0FBQSxPQUFELEdBQVcsSUFBSTtNQUNmLElBQUMsQ0FBQSxhQUFELEdBQWlCLElBQUk7TUFDckIsSUFBQyxDQUFBLElBQUQsR0FBUSxPQUFPLENBQUMsSUFBUixDQUFhLElBQWIsRUFBbUIsb0JBQW5CO01BQ1IsSUFBQyxDQUFBLFNBQUQsR0FBYTtNQUViLElBQU8saUJBQVA7QUFDRSxjQUFNLElBQUksS0FBSixDQUFVLGdEQUFBLEdBQWlELElBQTNELEVBRFI7O01BR0EsSUFBQyxDQUFBLElBQUQsR0FBUTtNQUNSLElBQUMsQ0FBQSxPQUFELEdBQVcsT0FBTyxDQUFDLGNBQVIsQ0FBdUIsSUFBdkI7TUFFWCxJQUFDLENBQUEsUUFBRCxHQUFZO01BQ1osSUFBQyxDQUFBLFFBQUQsR0FBWTtRQUFDLEtBQUEsRUFBTyxDQUFSO1FBQVcsTUFBQSxFQUFRLENBQW5COztNQUVaLElBQUMsQ0FBQSxvQkFBRCxHQUF3QjtNQUN4QixJQUFDLENBQUEsbUJBQUQsR0FBdUI7O1FBRXZCLHVCQUF3Qjs7TUFDeEIsSUFBRyxvQkFBSDtRQUNFLGFBQUEsR0FBZ0IsQ0FBQSxTQUFBLEtBQUE7aUJBQUEsU0FBQTtZQUNkLEtBQUMsQ0FBQSxZQUFELENBQUE7bUJBQ0EsS0FBQyxDQUFBLGFBQUQsQ0FBQTtVQUZjO1FBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQTtRQUloQixNQUFNLENBQUMsZ0JBQVAsQ0FBd0IsT0FBeEIsRUFBaUMsYUFBakM7UUFDQSxJQUFDLENBQUEsYUFBYSxDQUFDLEdBQWYsQ0FBbUIsSUFBSSxVQUFKLENBQWUsU0FBQTtpQkFBRyxNQUFNLENBQUMsbUJBQVAsQ0FBMkIsT0FBM0IsRUFBb0MsYUFBcEM7UUFBSCxDQUFmLENBQW5CLEVBTkY7O01BUUEsSUFBRyxvQkFBSDtRQUNFLElBQUMsQ0FBQSxPQUFPLENBQUMsVUFBVCxDQUFBLENBQXFCLENBQUMsT0FBdEIsQ0FBOEIsQ0FBQSxTQUFBLEtBQUE7aUJBQUEsU0FBQyxNQUFEO21CQUFZLEtBQUMsQ0FBQSxpQkFBRCxDQUFtQixNQUFuQjtVQUFaO1FBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUE5QjtRQUNBLElBQUMsQ0FBQSxhQUFhLENBQUMsR0FBZixDQUFtQixJQUFDLENBQUEsT0FBTyxDQUFDLGNBQVQsQ0FBd0IsQ0FBQSxTQUFBLEtBQUE7aUJBQUEsU0FBQyxNQUFEO21CQUFZLEtBQUMsQ0FBQSxpQkFBRCxDQUFtQixNQUFuQjtVQUFaO1FBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUF4QixDQUFuQixFQUZGOztJQTlCVzs7MkJBc0NiLE9BQUEsR0FBUyxTQUFBO01BQ1AsSUFBRyxvQkFBSDtRQUNFLElBQUMsQ0FBQSxPQUFPLENBQUMsSUFBVCxDQUFjLGFBQWQ7UUFDQSxJQUFDLENBQUEsT0FBTyxDQUFDLE9BQVQsQ0FBQTtRQUNBLElBQUMsQ0FBQSxPQUFELEdBQVcsS0FIYjs7TUFTQSxJQUFHLGlCQUFIO1FBRUUsSUFBQyxDQUFBLElBQUQsR0FBUSxLQUZWOztNQUlBLElBQUcsMEJBQUg7UUFDRSxJQUFDLENBQUEsYUFBYSxDQUFDLE9BQWYsQ0FBQTtlQUNBLElBQUMsQ0FBQSxhQUFELEdBQWlCLEtBRm5COztJQWRPOzs7QUFrQlQ7Ozs7MkJBTUEsWUFBQSxHQUFjLFNBQUMsUUFBRDthQUNaLElBQUMsQ0FBQSxPQUFPLENBQUMsRUFBVCxDQUFZLGFBQVosRUFBMkIsUUFBM0I7SUFEWTs7MkJBY2QsaUJBQUEsR0FBbUIsU0FBQyxRQUFEO2FBQ2pCLElBQUMsQ0FBQSxPQUFPLENBQUMsRUFBVCxDQUFZLG1CQUFaLEVBQWlDLFFBQWpDO0lBRGlCOzsyQkFXbkIsbUJBQUEsR0FBcUIsU0FBQyxRQUFEO2FBQ25CLElBQUMsQ0FBQSxPQUFPLENBQUMsRUFBVCxDQUFZLHFCQUFaLEVBQW1DLFFBQW5DO0lBRG1COzs7QUFHckI7Ozs7MkJBUUEsT0FBQSxHQUFTLFNBQUE7YUFBRztJQUFIOzsyQkFHVCxPQUFBLEdBQVMsU0FBQTtpQ0FDUCxJQUFDLENBQUEsT0FBRCxJQUFDLENBQUEsT0FBUSxJQUFDLENBQUEsT0FBRCxDQUFBLENBQVUsQ0FBQyxPQUFYLENBQUE7SUFERjs7MkJBSVQsbUJBQUEsR0FBcUIsU0FBQyxnQkFBRDthQUNuQixJQUFDLENBQUEsZ0JBQUQsR0FBb0I7SUFERDs7MkJBSXJCLG1CQUFBLEdBQXFCLFNBQUE7QUFDbkIsYUFBTyxJQUFDLENBQUE7SUFEVzs7MkJBS3JCLGVBQUEsR0FBaUIsU0FBQTtBQUNmLFVBQUE7MENBQUEsSUFBQyxDQUFBLGdCQUFELElBQUMsQ0FBQSxxREFBeUIsQ0FBRSxVQUFWLENBQXFCLElBQUMsQ0FBQSxPQUFELENBQUEsQ0FBckIsV0FBQSxLQUFvQztJQUR2Qzs7MkJBSWpCLFVBQUEsR0FBWSxTQUFDLElBQUQ7YUFBVTtJQUFWOzsyQkFHWixTQUFBLEdBQVcsU0FBQyxJQUFEO01BQ1QsSUFBQSxDQUFtQixJQUFuQjtBQUFBLGVBQU8sS0FBUDs7TUFDQSxJQUFHLElBQUMsQ0FBQSxPQUFKO1FBQ0UsSUFBQSxHQUFPLElBQUksQ0FBQyxPQUFMLENBQWEsSUFBQyxDQUFBLElBQWQsRUFBb0IsSUFBQyxDQUFBLE9BQXJCLEVBRFQ7O01BR0EsSUFBRyxJQUFBLElBQVEsSUFBSSxDQUFDLE9BQUwsQ0FBYSxJQUFiLENBQUEsS0FBc0IsQ0FBakM7UUFDRSxJQUFBLEdBQU8sSUFBSSxDQUFDLE9BQUwsQ0FBYSxJQUFiLEVBQW1CLEVBQW5CLEVBRFQ7O01BR0EsSUFBRyxPQUFPLENBQUMsUUFBUixLQUFvQixPQUF2QjtBQUNFLGVBQU8sSUFBSSxDQUFDLE9BQUwsQ0FBYSxLQUFiLEVBQW9CLEdBQXBCLEVBRFQ7T0FBQSxNQUFBO0FBR0UsZUFBTyxLQUhUOztJQVJTOzsyQkFjWCxTQUFBLEdBQVcsU0FBQyxNQUFEO2FBQVk7SUFBWjs7MkJBWVgsWUFBQSxHQUFjLFNBQUMsSUFBRDtNQUNaLElBQUMsQ0FBQSxPQUFELENBQVMsSUFBVCxDQUFjLENBQUMsaUJBQWYsQ0FBQSxDQUFrQyxDQUFDLElBQW5DLENBQXdDLENBQUEsU0FBQSxLQUFBO2VBQUEsU0FBQyxTQUFEO1VBQ3RDLElBQVUsS0FBQyxDQUFBLFNBQUQsS0FBYyxTQUF4QjtBQUFBLG1CQUFBOztVQUNBLEtBQUMsQ0FBQSxTQUFELEdBQWE7aUJBQ2IsS0FBQyxDQUFBLE9BQU8sQ0FBQyxJQUFULENBQWMscUJBQWQ7UUFIc0M7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQXhDO0FBSUEsYUFBTyxJQUFDLENBQUE7SUFMSTs7MkJBYWQsV0FBQSxHQUFhLFNBQUMsSUFBRDthQUFVO0lBQVY7OzJCQVFiLG1CQUFBLEdBQXFCLFNBQUMsU0FBRCxFQUFZLElBQVo7YUFBcUI7SUFBckI7OzJCQVdyQixpQ0FBQSxHQUFtQyxTQUFDLElBQUQ7YUFBVTtRQUFDLEtBQUEsRUFBTyxDQUFSO1FBQVcsTUFBQSxFQUFRLENBQW5COztJQUFWOzsyQkFNbkMsY0FBQSxHQUFnQixTQUFDLEdBQUQsRUFBTSxJQUFOO2FBQWU7SUFBZjs7MkJBTWhCLFlBQUEsR0FBYyxTQUFDLElBQUQ7YUFBVTtJQUFWOzsyQkFTZCxpQkFBQSxHQUFtQixTQUFDLElBQUQ7YUFBVTtJQUFWOzsyQkFXbkIsYUFBQSxHQUFlLFNBQUMsSUFBRDthQUFVO0lBQVY7OzJCQU9mLGtCQUFBLEdBQW9CLFNBQUMsU0FBRCxFQUFZLElBQVo7YUFBcUI7SUFBckI7OztBQUVwQjs7OzsyQkFLQSxjQUFBLEdBQWdCLFNBQUMsSUFBRDthQUFVLElBQUMsQ0FBQSxnQkFBRCxDQUFrQixJQUFDLENBQUEsYUFBRCxDQUFlLElBQWYsQ0FBbEI7SUFBVjs7MkJBR2hCLFNBQUEsR0FBVyxTQUFDLElBQUQ7YUFBVSxJQUFDLENBQUEsV0FBRCxDQUFhLElBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixDQUFiO0lBQVY7OzJCQU1YLGFBQUEsR0FBZSxTQUFDLElBQUQ7YUFBVSxJQUFDLENBQUEsb0JBQW9CLENBQUMsT0FBdEIsQ0FBOEIsSUFBQyxDQUFBLFNBQUQsQ0FBVyxJQUFYLENBQTlCLENBQUEsS0FBbUQsQ0FBQztJQUE5RDs7MkJBRWYsWUFBQSxHQUFjLFNBQUMsSUFBRDthQUFVLElBQUMsQ0FBQSxjQUFELENBQWdCLElBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixDQUFoQjtJQUFWOzsyQkFRZCxrQkFBQSxHQUFvQixTQUFDLGFBQUQ7QUFDbEIsVUFBQTtNQUFBLGFBQUEsR0FBa0IsQ0FBQyxJQUFDLENBQUEsU0FBRCxDQUFXLGFBQVgsQ0FBRCxDQUFBLEdBQTJCO01BQzdDLGVBQUEsR0FBa0I7QUFDbEI7QUFBQSxXQUFBLFlBQUE7O1FBQ0UsSUFBNkIsSUFBSSxDQUFDLE9BQUwsQ0FBYSxhQUFiLENBQUEsS0FBK0IsQ0FBNUQ7VUFBQSxlQUFBLElBQW1CLE9BQW5COztBQURGO0FBRUEsYUFBTztJQUxXOzsyQkFhcEIsYUFBQSxHQUFlLFNBQUMsSUFBRDtBQUNiLFVBQUE7TUFBQSxJQUFBLEdBQU8sSUFBQyxDQUFBLE9BQUQsQ0FBQTtNQUNQLFlBQUEsR0FBZSxJQUFDLENBQUEsU0FBRCxDQUFXLElBQVg7TUFDZixpQkFBQSx5REFBOEM7TUFDOUMsVUFBQSw4REFBZ0Q7TUFDaEQsSUFBa0IsSUFBSSxDQUFDLGVBQUwsQ0FBcUIsVUFBckIsQ0FBbEI7UUFBQSxVQUFBLEdBQWEsRUFBYjs7TUFDQSxJQUFHLFVBQUEsR0FBYSxDQUFoQjtRQUNFLElBQUMsQ0FBQSxRQUFTLENBQUEsWUFBQSxDQUFWLEdBQTBCLFdBRDVCO09BQUEsTUFBQTtRQUdFLE9BQU8sSUFBQyxDQUFBLFFBQVMsQ0FBQSxZQUFBLEVBSG5COztNQUlBLElBQUcsaUJBQUEsS0FBdUIsVUFBMUI7UUFDRSxJQUFDLENBQUEsT0FBTyxDQUFDLElBQVQsQ0FBYyxtQkFBZCxFQUFtQztVQUFDLE1BQUEsSUFBRDtVQUFPLFlBQUEsVUFBUDtTQUFuQyxFQURGOztBQUVBLGFBQU87SUFaTTs7MkJBbUJmLG1CQUFBLEdBQXFCLFNBQUMsSUFBRDtNQUNuQixJQUFBLENBQWMsSUFBZDtBQUFBLGVBQUE7O0FBQ0EsYUFBTyxJQUFDLENBQUEsUUFBUyxDQUFBLElBQUMsQ0FBQSxTQUFELENBQVcsSUFBWCxDQUFBO0lBRkU7OzJCQUtyQixnQkFBQSxHQUFrQixTQUFDLE1BQUQ7YUFBWSxJQUFDLENBQUEsT0FBRCxDQUFBLENBQVUsQ0FBQyxnQkFBWCxDQUE0QixNQUE1QjtJQUFaOzsyQkFHbEIsV0FBQSxHQUFhLFNBQUMsTUFBRDthQUFZLElBQUMsQ0FBQSxPQUFELENBQUEsQ0FBVSxDQUFDLFdBQVgsQ0FBdUIsTUFBdkI7SUFBWjs7MkJBR2IsZUFBQSxHQUFpQixTQUFDLE1BQUQ7YUFBWSxJQUFDLENBQUEsT0FBRCxDQUFBLENBQVUsQ0FBQyxlQUFYLENBQTJCLE1BQTNCO0lBQVo7OzJCQUdqQixjQUFBLEdBQWdCLFNBQUMsTUFBRDthQUFZLElBQUMsQ0FBQSxPQUFELENBQUEsQ0FBVSxDQUFDLGNBQVgsQ0FBMEIsTUFBMUI7SUFBWjs7O0FBRWhCOzs7OzJCQVNBLHNCQUFBLEdBQXdCLFNBQUMsSUFBRDtBQUN0QixVQUFBO01BQUEsV0FBQSxHQUFjLElBQUMsQ0FBQSxTQUFELENBQVcsSUFBWDtNQUVkLElBQUksQ0FBQyxJQUFDLENBQUEsbUJBQW9CLENBQUEsV0FBQSxDQUExQjtRQUNFLElBQUMsQ0FBQSxJQUFJLENBQUMsYUFBTixDQUFvQixJQUFwQixDQUF5QixDQUFDLElBQTFCLENBQStCLENBQUEsU0FBQSxLQUFBO2lCQUFBLFNBQUMsUUFBRDtBQUM3QixnQkFBQTtZQUFBLGVBQUEsR0FBa0IsS0FBQyxDQUFBLG1CQUFvQixDQUFBLFdBQUEsQ0FBckIsS0FBcUM7WUFDdkQsS0FBQyxDQUFBLG1CQUFvQixDQUFBLFdBQUEsQ0FBckIsR0FBb0M7WUFDcEMsSUFBdUIsZUFBdkI7cUJBQUEsS0FBQyxDQUFBLGFBQUQsQ0FBZSxJQUFmLEVBQUE7O1VBSDZCO1FBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUEvQixFQURGOztBQU1BLGFBQU8sSUFBQyxDQUFBLG1CQUFvQixDQUFBLFdBQUE7SUFUTjs7MkJBcUJ4QixZQUFBLEdBQWMsU0FBQyxJQUFEO0FBQ1osYUFBTyxJQUFDLENBQUEsT0FBRCxDQUFBLENBQVUsQ0FBQyxZQUFYLENBQXdCLElBQUMsQ0FBQSxTQUFELENBQVcsSUFBWCxDQUF4QixFQUEwQyxJQUFDLENBQUEsc0JBQUQsQ0FBd0IsSUFBeEIsQ0FBMUM7SUFESzs7MkJBY2QsWUFBQSxHQUFjLFNBQUMsSUFBRCxFQUFPLElBQVA7QUFHWixVQUFBO01BQUEsT0FBQSxHQUFVO1FBQUEsbUJBQUEsRUFBcUIsT0FBTyxDQUFDLFFBQVIsS0FBb0IsT0FBekM7O01BQ1YsSUFBQSxHQUFPLElBQUMsQ0FBQSxPQUFELENBQUE7QUFDUCxhQUFPLElBQUksQ0FBQyxZQUFMLENBQWtCLElBQUMsQ0FBQSxzQkFBRCxDQUF3QixJQUF4QixDQUFsQixFQUFpRCxJQUFqRCxFQUF1RCxPQUF2RDtJQUxLOzs7QUFPZDs7OzsyQkFpQkEsWUFBQSxHQUFjLFNBQUMsSUFBRDthQUFVO0lBQVY7OzJCQVNkLGlCQUFBLEdBQW1CLFNBQUMsU0FBRCxFQUFZLE1BQVo7YUFBdUI7SUFBdkI7OztBQUVuQjs7OzsyQkFLQSxpQkFBQSxHQUFtQixTQUFDLE1BQUQ7QUFDakIsVUFBQTtNQUFBLG1CQUFBLEdBQXNCLENBQUEsU0FBQSxLQUFBO2VBQUEsU0FBQTtBQUNwQixjQUFBO1VBQUEsSUFBRyxJQUFBLEdBQU8sTUFBTSxDQUFDLE9BQVAsQ0FBQSxDQUFWO21CQUNFLEtBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixFQURGOztRQURvQjtNQUFBLENBQUEsQ0FBQSxDQUFBLElBQUE7TUFJdEIsbUJBQUEsR0FBc0IsSUFBSTtNQUMxQixtQkFBbUIsQ0FBQyxHQUFwQixDQUF3QixNQUFNLENBQUMsU0FBUCxDQUFpQixtQkFBakIsQ0FBeEI7TUFDQSxtQkFBbUIsQ0FBQyxHQUFwQixDQUF3QixNQUFNLENBQUMsV0FBUCxDQUFtQixtQkFBbkIsQ0FBeEI7TUFDQSxtQkFBbUIsQ0FBQyxHQUFwQixDQUF3QixNQUFNLENBQUMsZUFBUCxDQUF1QixtQkFBdkIsQ0FBeEI7TUFDQSxtQkFBbUIsQ0FBQyxHQUFwQixDQUF3QixNQUFNLENBQUMsWUFBUCxDQUFvQixDQUFBLFNBQUEsS0FBQTtlQUFBLFNBQUE7VUFDMUMsbUJBQW1CLENBQUMsT0FBcEIsQ0FBQTtpQkFDQSxLQUFDLENBQUEsYUFBYSxDQUFDLE1BQWYsQ0FBc0IsbUJBQXRCO1FBRjBDO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFwQixDQUF4QjtNQUdBLElBQUMsQ0FBQSxhQUFhLENBQUMsR0FBZixDQUFtQixtQkFBbkI7SUFaaUI7OzJCQWdCbkIscUJBQUEsR0FBdUIsU0FBQyxNQUFEO2FBQVk7SUFBWjs7MkJBR3ZCLE9BQUEsR0FBUyxTQUFBO01BQ1AsSUFBRyxpQkFBSDtBQUNFLGVBQU8sSUFBQyxDQUFBLEtBRFY7T0FBQSxNQUFBO0FBR0UsY0FBTSxJQUFJLEtBQUosQ0FBVSwrQkFBVixFQUhSOztJQURPOzsyQkFRVCxZQUFBLEdBQWMsU0FBQTthQUFHO0lBQUg7OzJCQUlkLGFBQUEsR0FBZSxTQUFBO2FBQ2IsSUFBQyxDQUFBLE9BQUQsQ0FBQSxDQUFVLENBQUMsMEJBQVgsQ0FBQSxDQUF1QyxDQUFDLElBQXhDLENBQTZDLENBQUEsU0FBQSxLQUFBO2VBQUEsU0FBQyxVQUFEO0FBQzNDLGNBQUE7VUFBQSxLQUFDLENBQUEsb0JBQUQ7O0FBQXlCO2lCQUFBLDRDQUFBOzsyQkFBQSxJQUFDLENBQUEsU0FBRCxDQUFXLE9BQVg7QUFBQTs7O1VBQ3pCLGlCQUFBLEdBQW9CO2lCQUNwQixLQUFDLENBQUEsT0FBRCxDQUFBLENBQVUsQ0FBQyw4QkFBWCxDQUFBLENBQTJDLENBQUMsSUFBNUMsQ0FBaUQsU0FBQyxVQUFEO1lBQy9DLElBQUcsVUFBSDtjQUNFLEtBQUMsQ0FBQSxRQUFELEdBQVk7Y0FDWixLQUFDLENBQUEsbUJBQUQsR0FBdUI7Y0FHdkIsaUJBQUEsR0FBb0IsS0FMdEI7O21CQU1BLEtBQUMsQ0FBQSxPQUFELENBQUEsQ0FBVSxDQUFDLFNBQVgsQ0FBQSxDQUFzQixDQUFDLElBQXZCLENBQTRCLFNBQUMsUUFBRDtBQUMxQixrQkFBQTtBQUFBLG1CQUFBLDBDQUFBO29DQUFLLHNCQUFRO2dCQUNYLFdBQUEsR0FBYyxLQUFDLENBQUEsU0FBRCxDQUFXLElBQVg7Z0JBQ2QsSUFBRyxLQUFDLENBQUEsUUFBUyxDQUFBLFdBQUEsQ0FBVixLQUEwQixNQUE3QjtrQkFDRSxLQUFDLENBQUEsUUFBUyxDQUFBLFdBQUEsQ0FBVixHQUF5QjtrQkFDekIsaUJBQUEsR0FBb0IsS0FGdEI7O0FBRkY7Y0FNQSxJQUFHLGlCQUFIO3VCQUEwQixLQUFDLENBQUEsT0FBTyxDQUFDLElBQVQsQ0FBYyxxQkFBZCxFQUExQjs7WUFQMEIsQ0FBNUI7VUFQK0MsQ0FBakQ7UUFIMkM7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQTdDO0lBRGE7Ozs7O0FBdGJqQiIsInNvdXJjZXNDb250ZW50IjpbIntFbWl0dGVyLCBEaXNwb3NhYmxlLCBDb21wb3NpdGVEaXNwb3NhYmxlfSA9IHJlcXVpcmUgJ2V2ZW50LWtpdCdcblxuSGdVdGlscyA9IHJlcXVpcmUgJy4vaGctdXRpbHMnXG5cbm1vZHVsZS5leHBvcnRzID1cbmNsYXNzIEhnUmVwb3NpdG9yeVxuXG4gICMgZGV2TW9kZTogYXRvbS5pbkRldk1vZGUoKVxuICAjIHdvcmtpbmdEaXJlY3Rvcnk6ICcnXG5cbiAgIyMjXG4gIFNlY3Rpb246IENvbnN0cnVjdGlvbiBhbmQgRGVzdHJ1Y3Rpb25cbiAgIyMjXG5cbiAgIyBQdWJsaWM6IENyZWF0ZXMgYSBuZXcgSGdSZXBvc2l0b3J5IGluc3RhbmNlLlxuICAjXG4gICMgKiBgcGF0aGAgVGhlIHtTdHJpbmd9IHBhdGggdG8gdGhlIE1lcmN1cmlhbCByZXBvc2l0b3J5IHRvIG9wZW4uXG4gICMgKiBgb3B0aW9uc2AgQW4gb3B0aW9uYWwge09iamVjdH0gd2l0aCB0aGUgZm9sbG93aW5nIGtleXM6XG4gICMgICAqIGByZWZyZXNoT25XaW5kb3dGb2N1c2AgQSB7Qm9vbGVhbn0sIGB0cnVlYCB0byByZWZyZXNoIHRoZSBpbmRleCBhbmRcbiAgIyAgICAgc3RhdHVzZXMgd2hlbiB0aGUgd2luZG93IGlzIGZvY3VzZWQuXG4gICMgICAqIGBkaWZmUmV2aXNpb25Qcm92aWRlcmAgYSB7RnVuY3Rpb259IHRoYXQgcHJvdmlkZXMgdGhlIHJldmlzaW9uIHRvIGRpZmZcbiAgIyAgICAgIGFnYWluc3QuIERlZmF1bHRzIHRvICcuJy5cbiAgI1xuICAjIFJldHVybnMgYSB7SGdSZXBvc2l0b3J5fSBpbnN0YW5jZSBvciBgbnVsbGAgaWYgdGhlIHJlcG9zaXRvcnkgY291bGQgbm90IGJlIG9wZW5lZC5cbiAgQG9wZW46IChwYXRoLCBvcHRpb25zPXt9KSAtPlxuICAgIHJldHVybiBudWxsIHVubGVzcyBwYXRoXG4gICAgdHJ5XG4gICAgICBuZXcgSGdSZXBvc2l0b3J5KHBhdGgsIG9wdGlvbnMpXG4gICAgY2F0Y2hcbiAgICAgIG51bGxcblxuICBjb25zdHJ1Y3RvcjogKHBhdGgsIG9wdGlvbnM9e30pIC0+XG4gICAge0Bwcm9qZWN0LCByZWZyZXNoT25XaW5kb3dGb2N1cywgZGlmZlJldmlzaW9uUHJvdmlkZXJ9ID0gb3B0aW9uc1xuICAgIGRpZmZSZXZpc2lvblByb3ZpZGVyID89IC0+ICcuJ1xuXG4gICAgQGVtaXR0ZXIgPSBuZXcgRW1pdHRlclxuICAgIEBzdWJzY3JpcHRpb25zID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgICBAcmVwbyA9IEhnVXRpbHMub3BlbihwYXRoLCBkaWZmUmV2aXNpb25Qcm92aWRlcilcbiAgICBAc2hvcnRIZWFkID0gbnVsbFxuXG4gICAgdW5sZXNzIEByZXBvP1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gTWVyY3VyaWFsIHJlcG9zaXRvcnkgZm91bmQgc2VhcmNoaW5nIHBhdGg6ICN7cGF0aH1cIilcblxuICAgIEBwYXRoID0gcGF0aFxuICAgIEBzeW1saW5rID0gSGdVdGlscy5yZXNvbHZlU3ltbGluayhwYXRoKVxuXG4gICAgQHN0YXR1c2VzID0ge31cbiAgICBAdXBzdHJlYW0gPSB7YWhlYWQ6IDAsIGJlaGluZDogMH1cblxuICAgIEBjYWNoZWRJZ25vcmVTdGF0dXNlcyA9IFtdXG4gICAgQGNhY2hlZEhnRmlsZUNvbnRlbnQgPSB7fVxuXG4gICAgcmVmcmVzaE9uV2luZG93Rm9jdXMgPz0gdHJ1ZVxuICAgIGlmIHJlZnJlc2hPbldpbmRvd0ZvY3VzXG4gICAgICBvbldpbmRvd0ZvY3VzID0gPT5cbiAgICAgICAgQHJlZnJlc2hJbmRleCgpXG4gICAgICAgIEByZWZyZXNoU3RhdHVzKClcblxuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIgJ2ZvY3VzJywgb25XaW5kb3dGb2N1c1xuICAgICAgQHN1YnNjcmlwdGlvbnMuYWRkIG5ldyBEaXNwb3NhYmxlKC0+IHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyICdmb2N1cycsIG9uV2luZG93Rm9jdXMpXG5cbiAgICBpZiBAcHJvamVjdD9cbiAgICAgIEBwcm9qZWN0LmdldEJ1ZmZlcnMoKS5mb3JFYWNoIChidWZmZXIpID0+IEBzdWJzY3JpYmVUb0J1ZmZlcihidWZmZXIpXG4gICAgICBAc3Vic2NyaXB0aW9ucy5hZGQgQHByb2plY3Qub25EaWRBZGRCdWZmZXIgKGJ1ZmZlcikgPT4gQHN1YnNjcmliZVRvQnVmZmVyKGJ1ZmZlcilcblxuICAjIFB1YmxpYzogRGVzdHJveSB0aGlzIHtIZ1JlcG9zaXRvcnl9IG9iamVjdC5cbiAgI1xuICAjIFRoaXMgZGVzdHJveXMgYW55IHRhc2tzIGFuZCBzdWJzY3JpcHRpb25zIGFuZCByZWxlYXNlcyB0aGUgSGdSZXBvc2l0b3J5XG4gICMgb2JqZWN0XG4gIGRlc3Ryb3k6IC0+XG4gICAgaWYgQGVtaXR0ZXI/XG4gICAgICBAZW1pdHRlci5lbWl0ICdkaWQtZGVzdHJveSdcbiAgICAgIEBlbWl0dGVyLmRpc3Bvc2UoKVxuICAgICAgQGVtaXR0ZXIgPSBudWxsXG5cbiAgICAjIGlmIEBzdGF0dXNUYXNrP1xuICAgICAgIyBAc3RhdHVzVGFzay50ZXJtaW5hdGUoKVxuICAgICAgIyBAc3RhdHVzVGFzayA9IG51bGxcblxuICAgIGlmIEByZXBvP1xuICAgICAgIyBAcmVwby5yZWxlYXNlKClcbiAgICAgIEByZXBvID0gbnVsbFxuXG4gICAgaWYgQHN1YnNjcmlwdGlvbnM/XG4gICAgICBAc3Vic2NyaXB0aW9ucy5kaXNwb3NlKClcbiAgICAgIEBzdWJzY3JpcHRpb25zID0gbnVsbFxuXG4gICMjI1xuICBTZWN0aW9uOiBFdmVudCBTdWJzY3JpcHRpb25cbiAgIyMjXG5cbiAgIyBQdWJsaWM6IEludm9rZSB0aGUgZ2l2ZW4gY2FsbGJhY2sgd2hlbiB0aGlzIEhnUmVwb3NpdG9yeSdzIGRlc3Ryb3koKSBtZXRob2RcbiAgIyBpcyBpbnZva2VkLlxuICBvbkRpZERlc3Ryb3k6IChjYWxsYmFjaykgLT5cbiAgICBAZW1pdHRlci5vbiAnZGlkLWRlc3Ryb3knLCBjYWxsYmFja1xuXG4gICMgUHVibGljOiBJbnZva2UgdGhlIGdpdmVuIGNhbGxiYWNrIHdoZW4gYSBzcGVjaWZpYyBmaWxlJ3Mgc3RhdHVzIGhhc1xuICAjIGNoYW5nZWQuIFdoZW4gYSBmaWxlIGlzIHVwZGF0ZWQsIHJlbG9hZGVkLCBldGMsIGFuZCB0aGUgc3RhdHVzIGNoYW5nZXMsIHRoaXNcbiAgIyB3aWxsIGJlIGZpcmVkLlxuICAjXG4gICMgKiBgY2FsbGJhY2tgIHtGdW5jdGlvbn1cbiAgIyAgICogYGV2ZW50YCB7T2JqZWN0fVxuICAjICAgICAqIGBwYXRoYCB7U3RyaW5nfSB0aGUgb2xkIHBhcmFtZXRlcnMgdGhlIGRlY29yYXRpb24gdXNlZCB0byBoYXZlXG4gICMgICAgICogYHBhdGhTdGF0dXNgIHtOdW1iZXJ9IHJlcHJlc2VudGluZyB0aGUgc3RhdHVzLiBUaGlzIHZhbHVlIGNhbiBiZSBwYXNzZWQgdG9cbiAgIyAgICAgICB7Ojppc1N0YXR1c01vZGlmaWVkfSBvciB7Ojppc1N0YXR1c05ld30gdG8gZ2V0IG1vcmUgaW5mb3JtYXRpb24uXG4gICNcbiAgIyBSZXR1cm5zIGEge0Rpc3Bvc2FibGV9IG9uIHdoaWNoIGAuZGlzcG9zZSgpYCBjYW4gYmUgY2FsbGVkIHRvIHVuc3Vic2NyaWJlLlxuICBvbkRpZENoYW5nZVN0YXR1czogKGNhbGxiYWNrKSAtPlxuICAgIEBlbWl0dGVyLm9uICdkaWQtY2hhbmdlLXN0YXR1cycsIGNhbGxiYWNrXG5cbiAgIyBQdWJsaWM6IEludm9rZSB0aGUgZ2l2ZW4gY2FsbGJhY2sgd2hlbiBhIG11bHRpcGxlIGZpbGVzJyBzdGF0dXNlcyBoYXZlXG4gICMgY2hhbmdlZC4gRm9yIGV4YW1wbGUsIG9uIHdpbmRvdyBmb2N1cywgdGhlIHN0YXR1cyBvZiBhbGwgdGhlIHBhdGhzIGluIHRoZVxuICAjIHJlcG8gaXMgY2hlY2tlZC4gSWYgYW55IG9mIHRoZW0gaGF2ZSBjaGFuZ2VkLCB0aGlzIHdpbGwgYmUgZmlyZWQuIENhbGxcbiAgIyB7OjpnZXRQYXRoU3RhdHVzKHBhdGgpfSB0byBnZXQgdGhlIHN0YXR1cyBmb3IgeW91ciBwYXRoIG9mIGNob2ljZS5cbiAgI1xuICAjICogYGNhbGxiYWNrYCB7RnVuY3Rpb259XG4gICNcbiAgIyBSZXR1cm5zIGEge0Rpc3Bvc2FibGV9IG9uIHdoaWNoIGAuZGlzcG9zZSgpYCBjYW4gYmUgY2FsbGVkIHRvIHVuc3Vic2NyaWJlLlxuICBvbkRpZENoYW5nZVN0YXR1c2VzOiAoY2FsbGJhY2spIC0+XG4gICAgQGVtaXR0ZXIub24gJ2RpZC1jaGFuZ2Utc3RhdHVzZXMnLCBjYWxsYmFja1xuXG4gICMjI1xuICBTZWN0aW9uOiBSZXBvc2l0b3J5IERldGFpbHNcbiAgIyMjXG5cbiAgIyBQdWJsaWM6IEEge1N0cmluZ30gaW5kaWNhdGluZyB0aGUgdHlwZSBvZiB2ZXJzaW9uIGNvbnRyb2wgc3lzdGVtIHVzZWQgYnlcbiAgIyB0aGlzIHJlcG9zaXRvcnkuXG4gICNcbiAgIyBSZXR1cm5zIGBcImhnXCJgLlxuICBnZXRUeXBlOiAtPiAnaGcnXG5cbiAgIyBQdWJsaWM6IFJldHVybnMgdGhlIHtTdHJpbmd9IHBhdGggb2YgdGhlIHJlcG9zaXRvcnkuXG4gIGdldFBhdGg6IC0+XG4gICAgQHBhdGggPz0gQGdldFJlcG8oKS5nZXRQYXRoKClcblxuICAjIFB1YmxpYzogU2V0cyB0aGUge1N0cmluZ30gd29ya2luZyBkaXJlY3RvcnkgcGF0aCBvZiB0aGUgcmVwb3NpdG9yeS5cbiAgc2V0V29ya2luZ0RpcmVjdG9yeTogKHdvcmtpbmdEaXJlY3RvcnkpIC0+XG4gICAgQHdvcmtpbmdEaXJlY3RvcnkgPSB3b3JraW5nRGlyZWN0b3J5XG5cbiAgIyBQdWJsaWM6IFJldHVybnMgdGhlIHtTdHJpbmd9IHdvcmtpbmcgZGlyZWN0b3J5IHBhdGggb2YgdGhlIHJlcG9zaXRvcnkuXG4gIGdldFdvcmtpbmdEaXJlY3Rvcnk6IC0+XG4gICAgcmV0dXJuIEB3b3JraW5nRGlyZWN0b3J5XG5cbiAgIyBQdWJsaWM6IFJldHVybnMgdHJ1ZSBpZiBhdCB0aGUgcm9vdCwgZmFsc2UgaWYgaW4gYSBzdWJmb2xkZXIgb2YgdGhlXG4gICMgcmVwb3NpdG9yeS5cbiAgaXNQcm9qZWN0QXRSb290OiAtPlxuICAgIEBwcm9qZWN0QXRSb290ID89IEBwcm9qZWN0Py5yZWxhdGl2aXplKEBnZXRQYXRoKCkpIGlzICcnXG5cbiAgIyBQdWJsaWM6IE1ha2VzIGEgcGF0aCByZWxhdGl2ZSB0byB0aGUgcmVwb3NpdG9yeSdzIHdvcmtpbmcgZGlyZWN0b3J5LlxuICByZWxhdGl2aXplOiAocGF0aCkgLT4gbnVsbFxuXG4gICMgU2xhc2ggd2luMzIgcGF0aFxuICBzbGFzaFBhdGg6IChwYXRoKSAtPlxuICAgIHJldHVybiBwYXRoIHVubGVzcyBwYXRoXG4gICAgaWYgQHN5bWxpbmtcbiAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoQHBhdGgsIEBzeW1saW5rKVxuXG4gICAgaWYgcGF0aCAmJiBwYXRoLmluZGV4T2YoJy4uJykgaXMgMFxuICAgICAgcGF0aCA9IHBhdGgucmVwbGFjZSgnLi4nLCAnJylcblxuICAgIGlmIHByb2Nlc3MucGxhdGZvcm0gaXMgJ3dpbjMyJ1xuICAgICAgcmV0dXJuIHBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpXG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHBhdGhcblxuICAjIFB1YmxpYzogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBicmFuY2ggZXhpc3RzLlxuICBoYXNCcmFuY2g6IChicmFuY2gpIC0+IG51bGxcblxuICAjIFB1YmxpYzogUmV0cmlldmVzIGEgc2hvcnRlbmVkIHZlcnNpb24gb2YgdGhlIEhFQUQgcmVmZXJlbmNlIHZhbHVlLlxuICAjXG4gICMgVGhpcyByZW1vdmVzIHRoZSBsZWFkaW5nIHNlZ21lbnRzIG9mIGByZWZzL2hlYWRzYCwgYHJlZnMvdGFnc2AsIG9yXG4gICMgYHJlZnMvcmVtb3Rlc2AuICBJdCBhbHNvIHNob3J0ZW5zIHRoZSBTSEEtMSBvZiBhIGRldGFjaGVkIGBIRUFEYCB0byA3XG4gICMgY2hhcmFjdGVycy5cbiAgI1xuICAjICogYHBhdGhgIEFuIG9wdGlvbmFsIHtTdHJpbmd9IHBhdGggaW4gdGhlIHJlcG9zaXRvcnkgdG8gZ2V0IHRoaXMgaW5mb3JtYXRpb25cbiAgIyAgIGZvciwgb25seSBuZWVkZWQgaWYgdGhlIHJlcG9zaXRvcnkgY29udGFpbnMgc3VibW9kdWxlcy5cbiAgI1xuICAjIFJldHVybnMgYSB7U3RyaW5nfS5cbiAgZ2V0U2hvcnRIZWFkOiAocGF0aCkgLT5cbiAgICBAZ2V0UmVwbyhwYXRoKS5nZXRTaG9ydEhlYWRBc3luYygpLnRoZW4gKHNob3J0SGVhZCkgPT5cbiAgICAgIHJldHVybiBpZiBAc2hvcnRIZWFkID09IHNob3J0SGVhZFxuICAgICAgQHNob3J0SGVhZCA9IHNob3J0SGVhZFxuICAgICAgQGVtaXR0ZXIuZW1pdCAnZGlkLWNoYW5nZS1zdGF0dXNlcydcbiAgICByZXR1cm4gQHNob3J0SGVhZFxuXG5cbiAgIyBQdWJsaWM6IElzIHRoZSBnaXZlbiBwYXRoIGEgc3VibW9kdWxlIGluIHRoZSByZXBvc2l0b3J5P1xuICAjXG4gICMgKiBgcGF0aGAgVGhlIHtTdHJpbmd9IHBhdGggdG8gY2hlY2suXG4gICNcbiAgIyBSZXR1cm5zIGEge0Jvb2xlYW59LlxuICBpc1N1Ym1vZHVsZTogKHBhdGgpIC0+IG51bGxcblxuICAjIFB1YmxpYzogUmV0dXJucyB0aGUgbnVtYmVyIG9mIGNvbW1pdHMgYmVoaW5kIHRoZSBjdXJyZW50IGJyYW5jaCBpcyBmcm9tIHRoZVxuICAjIGl0cyB1cHN0cmVhbSByZW1vdGUgYnJhbmNoLlxuICAjXG4gICMgKiBgcmVmZXJlbmNlYCBUaGUge1N0cmluZ30gYnJhbmNoIHJlZmVyZW5jZSBuYW1lLlxuICAjICogYHBhdGhgICAgICAgVGhlIHtTdHJpbmd9IHBhdGggaW4gdGhlIHJlcG9zaXRvcnkgdG8gZ2V0IHRoaXMgaW5mb3JtYXRpb24gZm9yLFxuICAjICAgb25seSBuZWVkZWQgaWYgdGhlIHJlcG9zaXRvcnkgY29udGFpbnMgc3VibW9kdWxlcy5cbiAgZ2V0QWhlYWRCZWhpbmRDb3VudDogKHJlZmVyZW5jZSwgcGF0aCkgLT4gbnVsbFxuXG4gICMgUHVibGljOiBHZXQgdGhlIGNhY2hlZCBhaGVhZC9iZWhpbmQgY29tbWl0IGNvdW50cyBmb3IgdGhlIGN1cnJlbnQgYnJhbmNoJ3NcbiAgIyB1cHN0cmVhbSBicmFuY2guXG4gICNcbiAgIyAqIGBwYXRoYCBBbiBvcHRpb25hbCB7U3RyaW5nfSBwYXRoIGluIHRoZSByZXBvc2l0b3J5IHRvIGdldCB0aGlzIGluZm9ybWF0aW9uXG4gICMgICBmb3IsIG9ubHkgbmVlZGVkIGlmIHRoZSByZXBvc2l0b3J5IGhhcyBzdWJtb2R1bGVzLlxuICAjXG4gICMgUmV0dXJucyBhbiB7T2JqZWN0fSB3aXRoIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgIyAgICogYGFoZWFkYCAgVGhlIHtOdW1iZXJ9IG9mIGNvbW1pdHMgYWhlYWQuXG4gICMgICAqIGBiZWhpbmRgIFRoZSB7TnVtYmVyfSBvZiBjb21taXRzIGJlaGluZC5cbiAgZ2V0Q2FjaGVkVXBzdHJlYW1BaGVhZEJlaGluZENvdW50OiAocGF0aCkgLT4ge2FoZWFkOiAwLCBiZWhpbmQ6IDB9XG5cbiAgIyBQdWJsaWM6IFJldHVybnMgdGhlIGhnIHByb3BlcnR5IHZhbHVlIHNwZWNpZmllZCBieSB0aGUga2V5LlxuICAjXG4gICMgKiBgcGF0aGAgQW4gb3B0aW9uYWwge1N0cmluZ30gcGF0aCBpbiB0aGUgcmVwb3NpdG9yeSB0byBnZXQgdGhpcyBpbmZvcm1hdGlvblxuICAjICAgZm9yLCBvbmx5IG5lZWRlZCBpZiB0aGUgcmVwb3NpdG9yeSBoYXMgc3VibW9kdWxlcy5cbiAgZ2V0Q29uZmlnVmFsdWU6IChrZXksIHBhdGgpIC0+IG51bGxcblxuICAjIFB1YmxpYzogUmV0dXJucyB0aGUgb3JpZ2luIHVybCBvZiB0aGUgcmVwb3NpdG9yeS5cbiAgI1xuICAjICogYHBhdGhgIChvcHRpb25hbCkge1N0cmluZ30gcGF0aCBpbiB0aGUgcmVwb3NpdG9yeSB0byBnZXQgdGhpcyBpbmZvcm1hdGlvblxuICAjICAgZm9yLCBvbmx5IG5lZWRlZCBpZiB0aGUgcmVwb3NpdG9yeSBoYXMgc3VibW9kdWxlcy5cbiAgZ2V0T3JpZ2luVXJsOiAocGF0aCkgLT4gbnVsbFxuXG4gICMgUHVibGljOiBSZXR1cm5zIHRoZSB1cHN0cmVhbSBicmFuY2ggZm9yIHRoZSBjdXJyZW50IEhFQUQsIG9yIG51bGwgaWYgdGhlcmVcbiAgIyBpcyBubyB1cHN0cmVhbSBicmFuY2ggZm9yIHRoZSBjdXJyZW50IEhFQUQuXG4gICNcbiAgIyAqIGBwYXRoYCBBbiBvcHRpb25hbCB7U3RyaW5nfSBwYXRoIGluIHRoZSByZXBvIHRvIGdldCB0aGlzIGluZm9ybWF0aW9uIGZvcixcbiAgIyAgIG9ubHkgbmVlZGVkIGlmIHRoZSByZXBvc2l0b3J5IGNvbnRhaW5zIHN1Ym1vZHVsZXMuXG4gICNcbiAgIyBSZXR1cm5zIGEge1N0cmluZ30gYnJhbmNoIG5hbWUgc3VjaCBhcyBgcmVmcy9yZW1vdGVzL29yaWdpbi9tYXN0ZXJgLlxuICBnZXRVcHN0cmVhbUJyYW5jaDogKHBhdGgpIC0+IG51bGxcblxuICAjIFB1YmxpYzogR2V0cyBhbGwgdGhlIGxvY2FsIGFuZCByZW1vdGUgcmVmZXJlbmNlcy5cbiAgI1xuICAjICogYHBhdGhgIEFuIG9wdGlvbmFsIHtTdHJpbmd9IHBhdGggaW4gdGhlIHJlcG9zaXRvcnkgdG8gZ2V0IHRoaXMgaW5mb3JtYXRpb25cbiAgIyAgIGZvciwgb25seSBuZWVkZWQgaWYgdGhlIHJlcG9zaXRvcnkgaGFzIHN1Ym1vZHVsZXMuXG4gICNcbiAgIyBSZXR1cm5zIGFuIHtPYmplY3R9IHdpdGggdGhlIGZvbGxvd2luZyBrZXlzOlxuICAjICAqIGBoZWFkc2AgICBBbiB7QXJyYXl9IG9mIGhlYWQgcmVmZXJlbmNlIG5hbWVzLlxuICAjICAqIGByZW1vdGVzYCBBbiB7QXJyYXl9IG9mIHJlbW90ZSByZWZlcmVuY2UgbmFtZXMuXG4gICMgICogYHRhZ3NgICAgIEFuIHtBcnJheX0gb2YgdGFnIHJlZmVyZW5jZSBuYW1lcy5cbiAgZ2V0UmVmZXJlbmNlczogKHBhdGgpIC0+IG51bGxcblxuICAjIFB1YmxpYzogUmV0dXJucyB0aGUgY3VycmVudCB7U3RyaW5nfSBTSEEgZm9yIHRoZSBnaXZlbiByZWZlcmVuY2UuXG4gICNcbiAgIyAqIGByZWZlcmVuY2VgIFRoZSB7U3RyaW5nfSByZWZlcmVuY2UgdG8gZ2V0IHRoZSB0YXJnZXQgb2YuXG4gICMgKiBgcGF0aGAgQW4gb3B0aW9uYWwge1N0cmluZ30gcGF0aCBpbiB0aGUgcmVwbyB0byBnZXQgdGhlIHJlZmVyZW5jZSB0YXJnZXRcbiAgIyAgIGZvci4gT25seSBuZWVkZWQgaWYgdGhlIHJlcG9zaXRvcnkgY29udGFpbnMgc3VibW9kdWxlcy5cbiAgZ2V0UmVmZXJlbmNlVGFyZ2V0OiAocmVmZXJlbmNlLCBwYXRoKSAtPiBudWxsXG5cbiAgIyMjXG4gIFNlY3Rpb246IFJlYWRpbmcgU3RhdHVzXG4gICMjI1xuXG4gICMgUHVibGljOiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIHBhdGggaXMgbW9kaWZpZWQuXG4gIGlzUGF0aE1vZGlmaWVkOiAocGF0aCkgLT4gQGlzU3RhdHVzTW9kaWZpZWQoQGdldFBhdGhTdGF0dXMocGF0aCkpXG5cbiAgIyBQdWJsaWM6IFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gcGF0aCBpcyBuZXcuXG4gIGlzUGF0aE5ldzogKHBhdGgpIC0+IEBpc1N0YXR1c05ldyhAZ2V0UGF0aFN0YXR1cyhwYXRoKSlcblxuICAjIFB1YmxpYzogSXMgdGhlIGdpdmVuIHBhdGggaWdub3JlZD9cbiAgI1xuICAjIFJldHVybnMgYSB7Qm9vbGVhbn0uXG4gICMgaXNQYXRoSWdub3JlZDogKHBhdGgpIC0+IEBpc1N0YXR1c0lnbm9yZWQoQGdldFBhdGhTdGF0dXMocGF0aCkpXG4gIGlzUGF0aElnbm9yZWQ6IChwYXRoKSAtPiBAY2FjaGVkSWdub3JlU3RhdHVzZXMuaW5kZXhPZihAc2xhc2hQYXRoKHBhdGgpKSAhPSAtMVxuXG4gIGlzUGF0aFN0YWdlZDogKHBhdGgpIC0+IEBpc1N0YXR1c1N0YWdlZChAZ2V0UGF0aFN0YXR1cyhwYXRoKSlcblxuICAjIFB1YmxpYzogR2V0IHRoZSBzdGF0dXMgb2YgYSBkaXJlY3RvcnkgaW4gdGhlIHJlcG9zaXRvcnkncyB3b3JraW5nIGRpcmVjdG9yeS5cbiAgI1xuICAjICogYHBhdGhgIFRoZSB7U3RyaW5nfSBwYXRoIHRvIGNoZWNrLlxuICAjXG4gICMgUmV0dXJucyBhIHtOdW1iZXJ9IHJlcHJlc2VudGluZyB0aGUgc3RhdHVzLiBUaGlzIHZhbHVlIGNhbiBiZSBwYXNzZWQgdG9cbiAgIyB7Ojppc1N0YXR1c01vZGlmaWVkfSBvciB7Ojppc1N0YXR1c05ld30gdG8gZ2V0IG1vcmUgaW5mb3JtYXRpb24uXG4gIGdldERpcmVjdG9yeVN0YXR1czogKGRpcmVjdG9yeVBhdGgpIC0+XG4gICAgZGlyZWN0b3J5UGF0aCA9IFwiI3tAc2xhc2hQYXRoKGRpcmVjdG9yeVBhdGgpfS9cIlxuICAgIGRpcmVjdG9yeVN0YXR1cyA9IDBcbiAgICBmb3IgcGF0aCwgc3RhdHVzIG9mIEBzdGF0dXNlc1xuICAgICAgZGlyZWN0b3J5U3RhdHVzIHw9IHN0YXR1cyBpZiBwYXRoLmluZGV4T2YoZGlyZWN0b3J5UGF0aCkgaXMgMFxuICAgIHJldHVybiBkaXJlY3RvcnlTdGF0dXNcblxuICAjIFB1YmxpYzogR2V0IHRoZSBzdGF0dXMgb2YgYSBzaW5nbGUgcGF0aCBpbiB0aGUgcmVwb3NpdG9yeS5cbiAgI1xuICAjIGBwYXRoYCBBIHtTdHJpbmd9IHJlcG9zaXRvcnktcmVsYXRpdmUgcGF0aC5cbiAgI1xuICAjIFJldHVybnMgYSB7TnVtYmVyfSByZXByZXNlbnRpbmcgdGhlIHN0YXR1cy4gVGhpcyB2YWx1ZSBjYW4gYmUgcGFzc2VkIHRvXG4gICMgezo6aXNTdGF0dXNNb2RpZmllZH0gb3Igezo6aXNTdGF0dXNOZXd9IHRvIGdldCBtb3JlIGluZm9ybWF0aW9uLlxuICBnZXRQYXRoU3RhdHVzOiAocGF0aCkgLT5cbiAgICByZXBvID0gQGdldFJlcG8oKVxuICAgIHJlbGF0aXZlUGF0aCA9IEBzbGFzaFBhdGgocGF0aClcbiAgICBjdXJyZW50UGF0aFN0YXR1cyA9IEBzdGF0dXNlc1tyZWxhdGl2ZVBhdGhdID8gMFxuICAgIHBhdGhTdGF0dXMgPSByZXBvLmdldFBhdGhTdGF0dXMocmVsYXRpdmVQYXRoKSA/IDBcbiAgICBwYXRoU3RhdHVzID0gMCBpZiByZXBvLmlzU3RhdHVzSWdub3JlZChwYXRoU3RhdHVzKVxuICAgIGlmIHBhdGhTdGF0dXMgPiAwXG4gICAgICBAc3RhdHVzZXNbcmVsYXRpdmVQYXRoXSA9IHBhdGhTdGF0dXNcbiAgICBlbHNlXG4gICAgICBkZWxldGUgQHN0YXR1c2VzW3JlbGF0aXZlUGF0aF1cbiAgICBpZiBjdXJyZW50UGF0aFN0YXR1cyBpc250IHBhdGhTdGF0dXNcbiAgICAgIEBlbWl0dGVyLmVtaXQgJ2RpZC1jaGFuZ2Utc3RhdHVzJywge3BhdGgsIHBhdGhTdGF0dXN9XG4gICAgcmV0dXJuIHBhdGhTdGF0dXNcblxuICAjIFB1YmxpYzogR2V0IHRoZSBjYWNoZWQgc3RhdHVzIGZvciB0aGUgZ2l2ZW4gcGF0aC5cbiAgI1xuICAjICogYHBhdGhgIEEge1N0cmluZ30gcGF0aCBpbiB0aGUgcmVwb3NpdG9yeSwgcmVsYXRpdmUgb3IgYWJzb2x1dGUuXG4gICNcbiAgIyBSZXR1cm5zIGEgc3RhdHVzIHtOdW1iZXJ9IG9yIG51bGwgaWYgdGhlIHBhdGggaXMgbm90IGluIHRoZSBjYWNoZS5cbiAgZ2V0Q2FjaGVkUGF0aFN0YXR1czogKHBhdGgpIC0+XG4gICAgcmV0dXJuIHVubGVzcyBwYXRoXG4gICAgcmV0dXJuIEBzdGF0dXNlc1tAc2xhc2hQYXRoKHBhdGgpXVxuXG4gICMgUHVibGljOiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIHN0YXR1cyBpbmRpY2F0ZXMgbW9kaWZpY2F0aW9uLlxuICBpc1N0YXR1c01vZGlmaWVkOiAoc3RhdHVzKSAtPiBAZ2V0UmVwbygpLmlzU3RhdHVzTW9kaWZpZWQoc3RhdHVzKVxuXG4gICMgUHVibGljOiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIHN0YXR1cyBpbmRpY2F0ZXMgYSBuZXcgcGF0aC5cbiAgaXNTdGF0dXNOZXc6IChzdGF0dXMpIC0+IEBnZXRSZXBvKCkuaXNTdGF0dXNOZXcoc3RhdHVzKVxuXG4gICMgUHVibGljOiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIHN0YXR1cyBpcyBpZ25vcmVkLlxuICBpc1N0YXR1c0lnbm9yZWQ6IChzdGF0dXMpIC0+IEBnZXRSZXBvKCkuaXNTdGF0dXNJZ25vcmVkKHN0YXR1cylcblxuICAjIFB1YmxpYzogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBzdGF0dXMgaXMgc3RhZ2VkLlxuICBpc1N0YXR1c1N0YWdlZDogKHN0YXR1cykgLT4gQGdldFJlcG8oKS5pc1N0YXR1c1N0YWdlZChzdGF0dXMpXG5cbiAgIyMjXG4gIFNlY3Rpb246IFJldHJpZXZpbmcgRGlmZnNcbiAgIyMjXG5cbiAgIyBSZXRyaWV2ZXMgdGhlIGZpbGUgY29udGVudCBmcm9tIGxhdGVzdCBoZyByZXZpc2lvbiBhbmQgY2FjaGUgaXQuXG4gICNcbiAgIyAqIGBwYXRoYCBUaGUge1N0cmluZ30gcGF0aCBmb3IgcmV0cmlldmluZyBmaWxlIGNvbnRlbnRzLlxuICAjXG4gICMgUmV0dXJucyBhIHtTdHJpbmd9IHdpdGggdGhlIGZpbGVjb250ZW50c1xuICBnZXRDYWNoZWRIZ0ZpbGVDb250ZW50OiAocGF0aCkgPT5cbiAgICBzbGFzaGVkUGF0aCA9IEBzbGFzaFBhdGgocGF0aClcblxuICAgIGlmICghQGNhY2hlZEhnRmlsZUNvbnRlbnRbc2xhc2hlZFBhdGhdKVxuICAgICAgQHJlcG8uZ2V0SGdDYXRBc3luYyhwYXRoKS50aGVuIChjb250ZW50cykgPT5cbiAgICAgICAgY29udGVudHNDaGFuZ2VkID0gQGNhY2hlZEhnRmlsZUNvbnRlbnRbc2xhc2hlZFBhdGhdICE9IGNvbnRlbnRzXG4gICAgICAgIEBjYWNoZWRIZ0ZpbGVDb250ZW50W3NsYXNoZWRQYXRoXSA9IGNvbnRlbnRzXG4gICAgICAgIEBnZXRQYXRoU3RhdHVzIHBhdGggaWYgY29udGVudHNDaGFuZ2VkXG5cbiAgICByZXR1cm4gQGNhY2hlZEhnRmlsZUNvbnRlbnRbc2xhc2hlZFBhdGhdXG5cbiAgIyBQdWJsaWM6IFJldHJpZXZlcyB0aGUgbnVtYmVyIG9mIGxpbmVzIGFkZGVkIGFuZCByZW1vdmVkIHRvIGEgcGF0aC5cbiAgI1xuICAjIFRoaXMgY29tcGFyZXMgdGhlIHdvcmtpbmcgZGlyZWN0b3J5IGNvbnRlbnRzIG9mIHRoZSBwYXRoIHRvIHRoZSBgSEVBRGBcbiAgIyB2ZXJzaW9uLlxuICAjXG4gICMgKiBgcGF0aGAgVGhlIHtTdHJpbmd9IHBhdGggdG8gY2hlY2suXG4gICNcbiAgIyBSZXR1cm5zIGFuIHtPYmplY3R9IHdpdGggdGhlIGZvbGxvd2luZyBrZXlzOlxuICAjICAgKiBgYWRkZWRgIFRoZSB7TnVtYmVyfSBvZiBhZGRlZCBsaW5lcy5cbiAgIyAgICogYGRlbGV0ZWRgIFRoZSB7TnVtYmVyfSBvZiBkZWxldGVkIGxpbmVzLlxuICBnZXREaWZmU3RhdHM6IChwYXRoKSAtPlxuICAgIHJldHVybiBAZ2V0UmVwbygpLmdldERpZmZTdGF0cyhAc2xhc2hQYXRoKHBhdGgpLCBAZ2V0Q2FjaGVkSGdGaWxlQ29udGVudChwYXRoKSlcblxuICAjIFB1YmxpYzogUmV0cmlldmVzIHRoZSBsaW5lIGRpZmZzIGNvbXBhcmluZyB0aGUgYEhFQURgIHZlcnNpb24gb2YgdGhlIGdpdmVuXG4gICMgcGF0aCBhbmQgdGhlIGdpdmVuIHRleHQuXG4gICNcbiAgIyAqIGBwYXRoYCBUaGUge1N0cmluZ30gcGF0aCByZWxhdGl2ZSB0byB0aGUgcmVwb3NpdG9yeS5cbiAgIyAqIGB0ZXh0YCBUaGUge1N0cmluZ30gdG8gY29tcGFyZSBhZ2FpbnN0IHRoZSBgSEVBRGAgY29udGVudHNcbiAgI1xuICAjIFJldHVybnMgYW4ge0FycmF5fSBvZiBodW5rIHtPYmplY3R9cyB3aXRoIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgIyAgICogYG9sZFN0YXJ0YCBUaGUgbGluZSB7TnVtYmVyfSBvZiB0aGUgb2xkIGh1bmsuXG4gICMgICAqIGBuZXdTdGFydGAgVGhlIGxpbmUge051bWJlcn0gb2YgdGhlIG5ldyBodW5rLlxuICAjICAgKiBgb2xkTGluZXNgIFRoZSB7TnVtYmVyfSBvZiBsaW5lcyBpbiB0aGUgb2xkIGh1bmsuXG4gICMgICAqIGBuZXdMaW5lc2AgVGhlIHtOdW1iZXJ9IG9mIGxpbmVzIGluIHRoZSBuZXcgaHVua1xuICBnZXRMaW5lRGlmZnM6IChwYXRoLCB0ZXh0KSAtPlxuICAgICMgSWdub3JlIGVvbCBvZiBsaW5lIGRpZmZlcmVuY2VzIG9uIHdpbmRvd3Mgc28gdGhhdCBmaWxlcyBjaGVja2VkIGluIGFzXG4gICAgIyBMRiBkb24ndCByZXBvcnQgZXZlcnkgbGluZSBtb2RpZmllZCB3aGVuIHRoZSB0ZXh0IGNvbnRhaW5zIENSTEYgZW5kaW5ncy5cbiAgICBvcHRpb25zID0gaWdub3JlRW9sV2hpdGVzcGFjZTogcHJvY2Vzcy5wbGF0Zm9ybSBpcyAnd2luMzInXG4gICAgcmVwbyA9IEBnZXRSZXBvKClcbiAgICByZXR1cm4gcmVwby5nZXRMaW5lRGlmZnMoQGdldENhY2hlZEhnRmlsZUNvbnRlbnQocGF0aCksIHRleHQsIG9wdGlvbnMpXG5cbiAgIyMjXG4gIFNlY3Rpb246IENoZWNraW5nIE91dFxuICAjIyNcblxuICAjIFB1YmxpYzogUmVzdG9yZSB0aGUgY29udGVudHMgb2YgYSBwYXRoIGluIHRoZSB3b3JraW5nIGRpcmVjdG9yeSBhbmQgaW5kZXhcbiAgIyB0byB0aGUgdmVyc2lvbiBhdCBgSEVBRGAuXG4gICNcbiAgIyBUaGlzIGlzIGVzc2VudGlhbGx5IHRoZSBzYW1lIGFzIHJ1bm5pbmc6XG4gICNcbiAgIyBgYGBzaFxuICAjICAgZ2l0IHJlc2V0IEhFQUQgLS0gPHBhdGg+XG4gICMgICBnaXQgY2hlY2tvdXQgSEVBRCAtLSA8cGF0aD5cbiAgIyBgYGBcbiAgI1xuICAjICogYHBhdGhgIFRoZSB7U3RyaW5nfSBwYXRoIHRvIGNoZWNrb3V0LlxuICAjXG4gICMgUmV0dXJucyBhIHtCb29sZWFufSB0aGF0J3MgdHJ1ZSBpZiB0aGUgbWV0aG9kIHdhcyBzdWNjZXNzZnVsLlxuICBjaGVja291dEhlYWQ6IChwYXRoKSAtPiBudWxsXG5cbiAgIyBQdWJsaWM6IENoZWNrcyBvdXQgYSBicmFuY2ggaW4geW91ciByZXBvc2l0b3J5LlxuICAjXG4gICMgKiBgcmVmZXJlbmNlYCBUaGUge1N0cmluZ30gcmVmZXJlbmNlIHRvIGNoZWNrb3V0LlxuICAjICogYGNyZWF0ZWAgICAgQSB7Qm9vbGVhbn0gdmFsdWUgd2hpY2gsIGlmIHRydWUgY3JlYXRlcyB0aGUgbmV3IHJlZmVyZW5jZSBpZlxuICAjICAgaXQgZG9lc24ndCBleGlzdC5cbiAgI1xuICAjIFJldHVybnMgYSBCb29sZWFuIHRoYXQncyB0cnVlIGlmIHRoZSBtZXRob2Qgd2FzIHN1Y2Nlc3NmdWwuXG4gIGNoZWNrb3V0UmVmZXJlbmNlOiAocmVmZXJlbmNlLCBjcmVhdGUpIC0+IG51bGxcblxuICAjIyNcbiAgU2VjdGlvbjogUHJpdmF0ZVxuICAjIyNcblxuICMgU3Vic2NyaWJlcyB0byBidWZmZXIgZXZlbnRzLlxuICBzdWJzY3JpYmVUb0J1ZmZlcjogKGJ1ZmZlcikgLT5cbiAgICBnZXRCdWZmZXJQYXRoU3RhdHVzID0gPT5cbiAgICAgIGlmIHBhdGggPSBidWZmZXIuZ2V0UGF0aCgpXG4gICAgICAgIEBnZXRQYXRoU3RhdHVzKHBhdGgpXG5cbiAgICBidWZmZXJTdWJzY3JpcHRpb25zID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgICBidWZmZXJTdWJzY3JpcHRpb25zLmFkZCBidWZmZXIub25EaWRTYXZlKGdldEJ1ZmZlclBhdGhTdGF0dXMpXG4gICAgYnVmZmVyU3Vic2NyaXB0aW9ucy5hZGQgYnVmZmVyLm9uRGlkUmVsb2FkKGdldEJ1ZmZlclBhdGhTdGF0dXMpXG4gICAgYnVmZmVyU3Vic2NyaXB0aW9ucy5hZGQgYnVmZmVyLm9uRGlkQ2hhbmdlUGF0aChnZXRCdWZmZXJQYXRoU3RhdHVzKVxuICAgIGJ1ZmZlclN1YnNjcmlwdGlvbnMuYWRkIGJ1ZmZlci5vbkRpZERlc3Ryb3kgPT5cbiAgICAgIGJ1ZmZlclN1YnNjcmlwdGlvbnMuZGlzcG9zZSgpXG4gICAgICBAc3Vic2NyaXB0aW9ucy5yZW1vdmUoYnVmZmVyU3Vic2NyaXB0aW9ucylcbiAgICBAc3Vic2NyaXB0aW9ucy5hZGQoYnVmZmVyU3Vic2NyaXB0aW9ucylcbiAgICByZXR1cm5cblxuICAjIFN1YnNjcmliZXMgdG8gZWRpdG9yIHZpZXcgZXZlbnQuXG4gIGNoZWNrb3V0SGVhZEZvckVkaXRvcjogKGVkaXRvcikgLT4gbnVsbFxuXG4gIyBSZXR1cm5zIHRoZSBjb3JyZXNwb25kaW5nIHtSZXBvc2l0b3J5fVxuICBnZXRSZXBvOiAoKSAtPlxuICAgIGlmIEByZXBvP1xuICAgICAgcmV0dXJuIEByZXBvXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUmVwb3NpdG9yeSBoYXMgYmVlbiBkZXN0cm95ZWRcIilcblxuICAjIFJlcmVhZCB0aGUgaW5kZXggdG8gdXBkYXRlIGFueSB2YWx1ZXMgdGhhdCBoYXZlIGNoYW5nZWQgc2luY2UgdGhlXG4gICMgbGFzdCB0aW1lIHRoZSBpbmRleCB3YXMgcmVhZC5cbiAgcmVmcmVzaEluZGV4OiAtPiBudWxsXG5cbiAgIyBSZWZyZXNoZXMgdGhlIGN1cnJlbnQgaGcgc3RhdHVzIGluIGFuIG91dHNpZGUgcHJvY2VzcyBhbmQgYXN5bmNocm9ub3VzbHlcbiAgIyB1cGRhdGVzIHRoZSByZWxldmFudCBwcm9wZXJ0aWVzLlxuICByZWZyZXNoU3RhdHVzOiAtPlxuICAgIEBnZXRSZXBvKCkuZ2V0UmVjdXJzaXZlSWdub3JlU3RhdHVzZXMoKS50aGVuIChhbGxJZ25vcmVkKSA9PlxuICAgICAgQGNhY2hlZElnbm9yZVN0YXR1c2VzID0gKEBzbGFzaFBhdGggaWdub3JlZCBmb3IgaWdub3JlZCBpbiBhbGxJZ25vcmVkKVxuICAgICAgc3RhdHVzZXNEaWRDaGFuZ2UgPSBmYWxzZVxuICAgICAgQGdldFJlcG8oKS5jaGVja1JlcG9zaXRvcnlIYXNDaGFuZ2VkQXN5bmMoKS50aGVuIChoYXNDaGFuZ2VkKSA9PlxuICAgICAgICBpZiBoYXNDaGFuZ2VkXG4gICAgICAgICAgQHN0YXR1c2VzID0ge31cbiAgICAgICAgICBAY2FjaGVkSGdGaWxlQ29udGVudCA9IHt9XG4gICAgICAgICAgIyBjYWNoZSByZWN1cnNpdiBpZ25vcmUgc3RhdHVzZXNcbiAgICAgICAgICAjIEBjYWNoZWRJZ25vcmVTdGF0dXNlcyA9IEBnZXRSZXBvKCkuZ2V0UmVjdXJzaXZlSWdub3JlU3RhdHVzZXMoKVxuICAgICAgICAgIHN0YXR1c2VzRGlkQ2hhbmdlID0gdHJ1ZVxuICAgICAgICBAZ2V0UmVwbygpLmdldFN0YXR1cygpLnRoZW4gKHN0YXR1c2VzKSA9PlxuICAgICAgICAgIGZvciB7c3RhdHVzLCBwYXRofSBpbiBzdGF0dXNlc1xuICAgICAgICAgICAgc2xhc2hlZFBhdGggPSBAc2xhc2hQYXRoKHBhdGgpXG4gICAgICAgICAgICBpZiBAc3RhdHVzZXNbc2xhc2hlZFBhdGhdICE9IHN0YXR1c1xuICAgICAgICAgICAgICBAc3RhdHVzZXNbc2xhc2hlZFBhdGhdID0gc3RhdHVzXG4gICAgICAgICAgICAgIHN0YXR1c2VzRGlkQ2hhbmdlID0gdHJ1ZVxuXG4gICAgICAgICAgaWYgc3RhdHVzZXNEaWRDaGFuZ2UgdGhlbiBAZW1pdHRlci5lbWl0ICdkaWQtY2hhbmdlLXN0YXR1c2VzJ1xuIl19
