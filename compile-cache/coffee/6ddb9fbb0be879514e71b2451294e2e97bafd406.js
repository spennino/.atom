(function() {
  var Repository, deletedStatusFlags, diffLib, exec, fs, modifiedStatusFlags, newStatusFlags, openRepository, path, ref, resolveSymlink, spawnSync, statusIgnored, statusIndexDeleted, statusIndexNew, statusWorkingDirDelete, statusWorkingDirModified, statusWorkingDirNew, statusWorkingDirTypeChange, suppressHgWarnings, urlParser, util,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  fs = require('fs');

  path = require('path');

  util = require('util');

  urlParser = require('url');

  ref = require('child_process'), spawnSync = ref.spawnSync, exec = ref.exec;

  diffLib = require('jsdifflib');


  /*
  Section: Constants used for file/buffer checking against changes
   */

  statusIndexNew = 1 << 0;

  statusIndexDeleted = 1 << 2;

  statusWorkingDirNew = 1 << 7;

  statusWorkingDirModified = 1 << 8;

  statusWorkingDirDelete = 1 << 9;

  statusWorkingDirTypeChange = 1 << 10;

  statusIgnored = 1 << 14;

  modifiedStatusFlags = statusWorkingDirModified | statusWorkingDirDelete | statusWorkingDirTypeChange | statusIndexDeleted;

  newStatusFlags = statusWorkingDirNew | statusIndexNew;

  deletedStatusFlags = statusWorkingDirDelete | statusIndexDeleted;

  suppressHgWarnings = ['W200005', 'E200009'];

  Repository = (function() {
    Repository.prototype.username = null;

    Repository.prototype.password = null;

    Repository.prototype.rootPath = null;

    Repository.prototype.isHgRepository = false;

    Repository.prototype.binaryAvailable = false;

    Repository.prototype.version = null;

    Repository.prototype.url = null;

    Repository.prototype.urlPath = null;

    Repository.prototype.revision = null;

    Repository.prototype.diffRevisionProvider = null;


    /*
    Section: Initialization and startup checks
     */

    function Repository(repoRootPath, diffRevisionProvider) {
      this.getHgWorkingCopyRevisionAsync = bind(this.getHgWorkingCopyRevisionAsync, this);
      this.getShortHeadAsync = bind(this.getShortHeadAsync, this);
      this.checkRepositoryHasChangedAsync = bind(this.checkRepositoryHasChangedAsync, this);
      var lstat;
      this.rootPath = path.normalize(repoRootPath);
      if (!fs.existsSync(this.rootPath)) {
        return;
      }
      lstat = fs.lstatSync(this.rootPath);
      if (!lstat.isSymbolicLink()) {
        return;
      }
      this.diffRevisionProvider = diffRevisionProvider;
      this.rootPath = fs.realpathSync(this.rootPath);
    }

    Repository.prototype.checkBinaryAvailable = function() {
      this.version = this.getHgVersion();
      if (this.version != null) {
        this.binaryAvailable = true;
      } else {
        this.binaryAvailable = false;
      }
      return this.binaryAvailable;
    };

    Repository.prototype.exists = function() {
      return fs.existsSync(this.rootPath + '/.hg');
    };

    Repository.prototype.checkRepositoryHasChangedAsync = function() {
      return this.getHgWorkingCopyRevisionAsync().then((function(_this) {
        return function(revision) {
          if ((revision != null) && revision !== _this.revision) {
            _this.revision = revision;
            return true;
          }
          return false;
        };
      })(this));
    };

    Repository.prototype.getShortHeadAsync = function() {
      return new Promise((function(_this) {
        return function(resolve) {
          var bookmarkFile, branchFile, prompt;
          branchFile = _this.rootPath + '/.hg/branch';
          bookmarkFile = _this.rootPath + '/.hg/bookmarks.current';
          prompt = 'default';
          return fs.readFile(branchFile, 'utf8', function(err, data) {
            if (!err) {
              prompt = data.trim();
            }
            return fs.readFile(bookmarkFile, 'utf8', function(err, data) {
              if (!err) {
                prompt += ':' + data.trim();
              }
              return _this.getHgTagsAsync().then(function(tags) {
                if (tags != null ? tags.length : void 0) {
                  return prompt += ':' + tags.join(',');
                }
              }).then(function() {
                return resolve(prompt);
              });
            });
          });
        };
      })(this));
    };


    /*
    Section: TreeView Path Mercurial status
     */

    Repository.prototype.getStatus = function() {
      return this.getHgStatusAsync();
    };

    Repository.prototype.getPathStatus = function(hgPath) {
      var status;
      status = this.getHgPathStatus(hgPath);
      return status;
    };

    Repository.prototype.getPath = function() {
      return this.rootPath;
    };

    Repository.prototype.isStatusModified = function(status) {
      if (status == null) {
        status = 0;
      }
      return (status & modifiedStatusFlags) > 0;
    };

    Repository.prototype.isPathModified = function(path) {
      return this.isStatusModified(this.getPathStatus(path));
    };

    Repository.prototype.isStatusNew = function(status) {
      if (status == null) {
        status = 0;
      }
      return (status & newStatusFlags) > 0;
    };

    Repository.prototype.isPathNew = function(path) {
      return this.isStatusNew(this.getPathStatus(path));
    };

    Repository.prototype.isStatusDeleted = function(status) {
      if (status == null) {
        status = 0;
      }
      return (status & deletedStatusFlags) > 0;
    };

    Repository.prototype.isPathDeleted = function(path) {
      return this.isStatusDeleted(this.getPathStatus(path));
    };

    Repository.prototype.isPathStaged = function(path) {
      return this.isStatusStaged(this.getPathStatus(path));
    };

    Repository.prototype.isStatusIgnored = function(status) {
      if (status == null) {
        status = 0;
      }
      return (status & statusIgnored) > 0;
    };

    Repository.prototype.isStatusStaged = function(status) {
      if (status == null) {
        status = 0;
      }
      return (status & statusWorkingDirNew) === 0;
    };


    /*
    Section: Editor Mercurial line diffs
     */

    Repository.prototype.getDiffStats = function(path, lastRevFileContent) {
      var base, diffStats, i, len, newtxt, opcode, opcodes, sm;
      diffStats = {
        added: 0,
        deleted: 0
      };
      if ((lastRevFileContent != null) && fs.existsSync(path)) {
        base = diffLib.stringAsLines(lastRevFileContent);
        newtxt = diffLib.stringAsLines(fs.readFileSync(path).toString());
        sm = new diffLib.SequenceMatcher(base, newtxt);
        opcodes = sm.get_opcodes();
        for (i = 0, len = opcodes.length; i < len; i++) {
          opcode = opcodes[i];
          if (opcode[0] === 'insert' || opcode[0] === 'replace') {
            diffStats.added += (opcode[2] - opcode[1]) + (opcode[4] - opcode[3]);
          }
          if (opcode[0] === 'delete') {
            diffStats.deleted += (opcode[2] - opcode[1]) - (opcode[4] - opcode[3]);
          }
        }
      }
      return diffStats;
    };

    Repository.prototype.getLineDiffs = function(lastRevFileContent, text, options) {
      var actions, base, hunk, hunks, i, len, newtxt, opcode, opcodes, sm;
      hunks = [];
      if ((lastRevFileContent != null)) {
        base = diffLib.stringAsLines(lastRevFileContent);
        newtxt = diffLib.stringAsLines(text);
        sm = new diffLib.SequenceMatcher(base, newtxt);
        opcodes = sm.get_opcodes();
        actions = ['replace', 'insert', 'delete'];
        for (i = 0, len = opcodes.length; i < len; i++) {
          opcode = opcodes[i];
          if (actions.indexOf(opcode[0]) >= 0) {
            hunk = {
              oldStart: opcode[1] + 1,
              oldLines: opcode[2] - opcode[1],
              newStart: opcode[3] + 1,
              newLines: opcode[4] - opcode[3]
            };
            if (opcode[0] === 'delete') {
              hunk.newStart = hunk.newStart - 1;
            }
            hunks.push(hunk);
          }
        }
      }
      return hunks;
    };


    /*
    Section: Mercurial Command handling
     */

    Repository.prototype.hgCommand = function(params) {
      var child;
      if (!params) {
        params = [];
      }
      if (!util.isArray(params)) {
        params = [params];
      }
      if (!this.isCommandForRepo(params)) {
        return '';
      }
      child = spawnSync('hg', params, {
        cwd: this.rootPath
      });
      if (child.status !== 0) {
        if (child.stderr) {
          throw new Error(child.stderr.toString());
        }
        if (child.stdout) {
          throw new Error(child.stdout.toString());
        }
        throw new Error('Error trying to execute Mercurial binary with params \'' + params + '\'');
      }
      return child.stdout.toString();
    };

    Repository.prototype.hgCommandAsync = function(params) {
      var flatArgs;
      if (!params) {
        params = [];
      }
      if (!util.isArray(params)) {
        params = [params];
      }
      if (!this.isCommandForRepo(params)) {
        return Promise.resolve('');
      }
      flatArgs = params.reduce(function(prev, next) {
        if ((next.indexOf != null) && next.indexOf(' ') !== -1) {
          next = "\"" + next + "\"";
        }
        return prev + " " + next;
      }, "");
      flatArgs = flatArgs.substring(1);
      return new Promise((function(_this) {
        return function(resolve, reject) {
          var child, opts;
          opts = {
            cwd: _this.rootPath,
            maxBuffer: 50 * 1024 * 1024
          };
          return child = exec('hg ' + flatArgs, opts, function(err, stdout, stderr) {
            if (err) {
              reject(err);
            }
            if ((stderr != null ? stderr.length : void 0) > 0) {
              reject(stderr);
            }
            return resolve(stdout);
          });
        };
      })(this));
    };

    Repository.prototype.handleHgError = function(error) {
      var i, len, logMessage, message, suppressHgWarning;
      logMessage = true;
      message = error.message;
      for (i = 0, len = suppressHgWarnings.length; i < len; i++) {
        suppressHgWarning = suppressHgWarnings[i];
        if (message.indexOf(suppressHgWarning) > 0) {
          logMessage = false;
          break;
        }
      }
      if (logMessage) {
        return console.error('Mercurial', 'hg-utils', error);
      }
    };

    Repository.prototype.getHgVersion = function() {
      var error, version;
      try {
        version = this.hgCommand(['--version', '--quiet']);
        return version.trim();
      } catch (error1) {
        error = error1;
        this.handleHgError(error);
        return null;
      }
    };

    Repository.prototype.getHgWorkingCopyRevisionAsync = function() {
      return this.hgCommandAsync(['id', '-i', this.rootPath])["catch"]((function(_this) {
        return function(error) {
          _this.handleHgError(error);
          return null;
        };
      })(this));
    };

    Repository.prototype.getRecursiveIgnoreStatuses = function() {
      var revision;
      revision = this.diffRevisionProvider();
      return this.hgCommandAsync(['status', this.rootPath, "-i", "--rev", revision]).then((function(_this) {
        return function(files) {
          var entries, entry, i, item, items, j, len, len1, parts, pathPart, results, status;
          items = [];
          entries = files.split('\n');
          if (entries) {
            for (i = 0, len = entries.length; i < len; i++) {
              entry = entries[i];
              parts = entry.split(' ');
              status = parts[0];
              pathPart = parts[1];
              if ((pathPart != null) && (status != null)) {
                if (status === 'I') {
                  items.push(pathPart.replace('..', ''));
                }
              }
            }
          }
          results = [];
          for (j = 0, len1 = items.length; j < len1; j++) {
            item = items[j];
            results.push(path.join(_this.rootPath, item));
          }
          return results;
        };
      })(this))["catch"]((function(_this) {
        return function(error) {
          _this.handleHgError(error);
          return [];
        };
      })(this));
    };

    Repository.prototype.getHgStatusAsync = function() {
      var revision;
      revision = this.diffRevisionProvider();
      return this.hgCommandAsync(['status', this.rootPath, '--rev', revision]).then((function(_this) {
        return function(files) {
          var entries, entry, i, items, len, parts, pathPart, status;
          items = [];
          entries = files.split('\n');
          if (entries) {
            for (i = 0, len = entries.length; i < len; i++) {
              entry = entries[i];
              parts = entry.split(' ');
              status = parts[0];
              pathPart = parts[1];
              if ((pathPart != null) && (status != null)) {
                items.push({
                  'path': path.join(_this.rootPath, pathPart),
                  'status': _this.mapHgStatus(status)
                });
              }
            }
          }
          return items;
        };
      })(this))["catch"]((function(_this) {
        return function(error) {
          _this.handleHgError(error);
          return null;
        };
      })(this));
    };

    Repository.prototype.getHgTagsAsync = function() {
      return this.hgCommandAsync(['id', '-t', this.rootPath]).then(function(tags) {
        tags = tags.trim();
        if (tags) {
          return tags.split(' ').sort();
        }
      })["catch"]((function(_this) {
        return function(error) {
          _this.handleHgError(error);
          return null;
        };
      })(this));
    };

    Repository.prototype.getHgPathStatus = function(hgPath) {
      var entries, entry, error, files, i, items, len, parts, pathPart, path_status, revision, status;
      if (!hgPath) {
        return null;
      }
      try {
        revision = this.diffRevisionProvider();
        files = this.hgCommand(['status', hgPath, '--rev', revision]);
      } catch (error1) {
        error = error1;
        this.handleHgError(error);
        return null;
      }
      items = [];
      entries = files.split('\n');
      if (entries) {
        path_status = 0;
        for (i = 0, len = entries.length; i < len; i++) {
          entry = entries[i];
          parts = entry.split(' ');
          status = parts[0];
          pathPart = parts[1];
          if (status != null) {
            path_status |= this.mapHgStatus(status);
          }
        }
        return path_status;
      } else {
        return null;
      }
    };

    Repository.prototype.mapHgStatus = function(status) {
      var statusBitmask;
      if (!status) {
        return 0;
      }
      statusBitmask = 0;
      if (status === 'M') {
        statusBitmask = statusWorkingDirModified;
      }
      if (status === '?') {
        statusBitmask = statusWorkingDirNew;
      }
      if (status === '!') {
        statusBitmask = statusWorkingDirDelete;
      }
      if (status === 'I') {
        statusBitmask = statusIgnored;
      }
      if (status === 'M') {
        statusBitmask = statusWorkingDirTypeChange;
      }
      if (status === 'A') {
        statusBitmask = statusIndexNew;
      }
      if (status === 'R') {
        statusBitmask = statusIndexDeleted;
      }
      return statusBitmask;
    };

    Repository.prototype.getHgCatAsync = function(hgPath) {
      var params, revision;
      revision = this.diffRevisionProvider();
      params = ['cat', hgPath, '--rev', revision];
      return this.hgCommandAsync(params)["catch"]((function(_this) {
        return function(error) {
          if (/no such file in rev/.test(error)) {
            return null;
          }
          _this.handleHgError(error);
          return null;
        };
      })(this));
    };

    Repository.prototype.isCommandForRepo = function(params) {
      var paths, rootPath;
      rootPath = this.rootPath;
      paths = params.filter(function(param) {
        var normalizedPath;
        normalizedPath = path.normalize(param || '');
        return normalizedPath.startsWith(rootPath);
      });
      return paths.length > 0;
    };

    return Repository;

  })();

  exports.isStatusModified = function(status) {
    return (status & modifiedStatusFlags) > 0;
  };

  exports.isStatusNew = function(status) {
    return (status & newStatusFlags) > 0;
  };

  exports.isStatusDeleted = function(status) {
    return (status & deletedStatusFlags) > 0;
  };

  exports.isStatusIgnored = function(status) {
    return (status & statusIgnored) > 0;
  };

  exports.isStatusStaged = function(status) {
    return (status & statusWorkingDirNew) === 0;
  };

  openRepository = function(repositoryPath, diffRevisionProvider) {
    var repository;
    repository = new Repository(repositoryPath);
    if (repository.checkBinaryAvailable() && repository.exists()) {
      repository.diffRevisionProvider = diffRevisionProvider;
      return repository;
    } else {
      return null;
    }
  };

  exports.open = function(repositoryPath, diffRevisionProvider) {
    return openRepository(repositoryPath, diffRevisionProvider);
  };

  resolveSymlink = function(repositoryPath) {
    var lstat;
    lstat = fs.lstatSync(repositoryPath);
    if (!lstat.isSymbolicLink()) {
      return null;
    }
    return fs.realpathSync(repositoryPath);
  };

  exports.resolveSymlink = function(repositoryPath) {
    return resolveSymlink(repositoryPath);
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvYXRvbS1oZy9saWIvaGctdXRpbHMuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQUEsTUFBQSx1VUFBQTtJQUFBOztFQUFBLEVBQUEsR0FBSyxPQUFBLENBQVEsSUFBUjs7RUFDTCxJQUFBLEdBQU8sT0FBQSxDQUFRLE1BQVI7O0VBQ1AsSUFBQSxHQUFPLE9BQUEsQ0FBUSxNQUFSOztFQUNQLFNBQUEsR0FBWSxPQUFBLENBQVEsS0FBUjs7RUFDWixNQUFvQixPQUFBLENBQVEsZUFBUixDQUFwQixFQUFDLHlCQUFELEVBQVk7O0VBQ1osT0FBQSxHQUFVLE9BQUEsQ0FBUSxXQUFSOzs7QUFFVjs7OztFQUdBLGNBQUEsR0FBaUIsQ0FBQSxJQUFLOztFQUN0QixrQkFBQSxHQUFxQixDQUFBLElBQUs7O0VBRTFCLG1CQUFBLEdBQXNCLENBQUEsSUFBSzs7RUFDM0Isd0JBQUEsR0FBMkIsQ0FBQSxJQUFLOztFQUNoQyxzQkFBQSxHQUF5QixDQUFBLElBQUs7O0VBQzlCLDBCQUFBLEdBQTZCLENBQUEsSUFBSzs7RUFDbEMsYUFBQSxHQUFnQixDQUFBLElBQUs7O0VBRXJCLG1CQUFBLEdBQXNCLHdCQUFBLEdBQTJCLHNCQUEzQixHQUNBLDBCQURBLEdBQzZCOztFQUVuRCxjQUFBLEdBQWlCLG1CQUFBLEdBQXNCOztFQUV2QyxrQkFBQSxHQUFxQixzQkFBQSxHQUF5Qjs7RUFFOUMsa0JBQUEsR0FBcUIsQ0FDbkIsU0FEbUIsRUFFbkIsU0FGbUI7O0VBS2Y7eUJBRUosUUFBQSxHQUFVOzt5QkFDVixRQUFBLEdBQVU7O3lCQUVWLFFBQUEsR0FBVTs7eUJBRVYsY0FBQSxHQUFnQjs7eUJBQ2hCLGVBQUEsR0FBaUI7O3lCQUVqQixPQUFBLEdBQVM7O3lCQUVULEdBQUEsR0FBSzs7eUJBQ0wsT0FBQSxHQUFTOzt5QkFFVCxRQUFBLEdBQVU7O3lCQUNW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O01BQ0UsVUFBVSxDQUFDLG9CQUFYLEdBQWtDO0FBQ2xDLGFBQU8sV0FGVDtLQUFBLE1BQUE7QUFJRSxhQUFPLEtBSlQ7O0VBRmU7O0VBU2pCLE9BQU8sQ0FBQyxJQUFSLEdBQWUsU0FBQyxjQUFELEVBQWlCLG9CQUFqQjtBQUNiLFdBQU8sY0FBQSxDQUFlLGNBQWYsRUFBK0Isb0JBQS9CO0VBRE07O0VBS2YsY0FBQSxHQUFpQixTQUFDLGNBQUQ7QUFDZixRQUFBO0lBQUEsS0FBQSxHQUFRLEVBQUUsQ0FBQyxTQUFILENBQWEsY0FBYjtJQUNSLElBQUEsQ0FBTyxLQUFLLENBQUMsY0FBTixDQUFBLENBQVA7QUFDRSxhQUFPLEtBRFQ7O0FBR0EsV0FBTyxFQUFFLENBQUMsWUFBSCxDQUFnQixjQUFoQjtFQUxROztFQU9qQixPQUFPLENBQUMsY0FBUixHQUF5QixTQUFDLGNBQUQ7QUFDdkIsV0FBTyxjQUFBLENBQWUsY0FBZjtFQURnQjtBQTlmekIiLCJzb3VyY2VzQ29udGVudCI6WyJmcyA9IHJlcXVpcmUgJ2ZzJ1xucGF0aCA9IHJlcXVpcmUgJ3BhdGgnXG51dGlsID0gcmVxdWlyZSAndXRpbCdcbnVybFBhcnNlciA9IHJlcXVpcmUgJ3VybCdcbntzcGF3blN5bmMsIGV4ZWN9ID0gcmVxdWlyZSAnY2hpbGRfcHJvY2VzcydcbmRpZmZMaWIgPSByZXF1aXJlICdqc2RpZmZsaWInXG5cbiMjI1xuU2VjdGlvbjogQ29uc3RhbnRzIHVzZWQgZm9yIGZpbGUvYnVmZmVyIGNoZWNraW5nIGFnYWluc3QgY2hhbmdlc1xuIyMjXG5zdGF0dXNJbmRleE5ldyA9IDEgPDwgMFxuc3RhdHVzSW5kZXhEZWxldGVkID0gMSA8PCAyXG5cbnN0YXR1c1dvcmtpbmdEaXJOZXcgPSAxIDw8IDdcbnN0YXR1c1dvcmtpbmdEaXJNb2RpZmllZCA9IDEgPDwgOFxuc3RhdHVzV29ya2luZ0RpckRlbGV0ZSA9IDEgPDwgOVxuc3RhdHVzV29ya2luZ0RpclR5cGVDaGFuZ2UgPSAxIDw8IDEwXG5zdGF0dXNJZ25vcmVkID0gMSA8PCAxNFxuXG5tb2RpZmllZFN0YXR1c0ZsYWdzID0gc3RhdHVzV29ya2luZ0Rpck1vZGlmaWVkIHwgc3RhdHVzV29ya2luZ0RpckRlbGV0ZSB8XG4gICAgICAgICAgICAgICAgICAgICAgc3RhdHVzV29ya2luZ0RpclR5cGVDaGFuZ2UgfCBzdGF0dXNJbmRleERlbGV0ZWRcblxubmV3U3RhdHVzRmxhZ3MgPSBzdGF0dXNXb3JraW5nRGlyTmV3IHwgc3RhdHVzSW5kZXhOZXdcblxuZGVsZXRlZFN0YXR1c0ZsYWdzID0gc3RhdHVzV29ya2luZ0RpckRlbGV0ZSB8IHN0YXR1c0luZGV4RGVsZXRlZFxuXG5zdXBwcmVzc0hnV2FybmluZ3MgPSBbXG4gICdXMjAwMDA1JyAjIGhnOiB3YXJuaW5nOiBXMjAwMDA1OiAnZmlsZScgaXMgbm90IHVuZGVyIHZlcnNpb24gY29udHJvbFxuICAnRTIwMDAwOScgIyBDb3VsZCBub3QgY2F0IGFsbCB0YXJnZXRzIGJlY2F1c2Ugc29tZSB0YXJnZXRzIGFyZSBub3QgdmVyc2lvbmVkXG5dXG5cbmNsYXNzIFJlcG9zaXRvcnlcblxuICB1c2VybmFtZTogbnVsbFxuICBwYXNzd29yZDogbnVsbFxuXG4gIHJvb3RQYXRoOiBudWxsXG5cbiAgaXNIZ1JlcG9zaXRvcnk6IGZhbHNlXG4gIGJpbmFyeUF2YWlsYWJsZTogZmFsc2VcblxuICB2ZXJzaW9uOiBudWxsXG5cbiAgdXJsOiBudWxsXG4gIHVybFBhdGg6IG51bGxcblxuICByZXZpc2lvbjogbnVsbFxuICBkaWZmUmV2aXNpb25Qcm92aWRlcjogbnVsbFxuXG4gICMjI1xuICBTZWN0aW9uOiBJbml0aWFsaXphdGlvbiBhbmQgc3RhcnR1cCBjaGVja3NcbiAgIyMjXG5cbiAgY29uc3RydWN0b3I6IChyZXBvUm9vdFBhdGgsIGRpZmZSZXZpc2lvblByb3ZpZGVyKSAtPlxuICAgIEByb290UGF0aCA9IHBhdGgubm9ybWFsaXplKHJlcG9Sb290UGF0aClcbiAgICB1bmxlc3MgZnMuZXhpc3RzU3luYyhAcm9vdFBhdGgpXG4gICAgICByZXR1cm5cblxuICAgIGxzdGF0ID0gZnMubHN0YXRTeW5jKEByb290UGF0aClcbiAgICB1bmxlc3MgbHN0YXQuaXNTeW1ib2xpY0xpbmsoKVxuICAgICAgcmV0dXJuXG5cbiAgICBAZGlmZlJldmlzaW9uUHJvdmlkZXIgPSBkaWZmUmV2aXNpb25Qcm92aWRlclxuICAgIEByb290UGF0aCA9IGZzLnJlYWxwYXRoU3luYyhAcm9vdFBhdGgpXG5cbiAgIyBDaGVja3MgaWYgdGhlcmUgaXMgYSBoZyBiaW5hcnkgaW4gdGhlIG9zIHNlYXJjaHBhdGggYW5kIHJldHVybnMgdGhlXG4gICMgYmluYXJ5IHZlcnNpb24gc3RyaW5nLlxuICAjXG4gICMgUmV0dXJucyBhIHtib29sZWFufVxuICBjaGVja0JpbmFyeUF2YWlsYWJsZTogKCkgLT5cbiAgICBAdmVyc2lvbiA9IEBnZXRIZ1ZlcnNpb24oKVxuICAgIGlmIEB2ZXJzaW9uP1xuICAgICAgQGJpbmFyeUF2YWlsYWJsZSA9IHRydWVcbiAgICBlbHNlXG4gICAgICBAYmluYXJ5QXZhaWxhYmxlID0gZmFsc2VcbiAgICByZXR1cm4gQGJpbmFyeUF2YWlsYWJsZVxuXG4gIGV4aXN0czogKCkgLT5cbiAgICByZXR1cm4gZnMuZXhpc3RzU3luYyhAcm9vdFBhdGggKyAnLy5oZycpXG5cbiAgIyBQYXJzZXMgaW5mbyBmcm9tIGBoZyBpbmZvYCBhbmQgYGhndmVyc2lvbmAgY29tbWFuZCBhbmQgY2hlY2tzIGlmIHJlcG8gaW5mb3MgaGF2ZSBjaGFuZ2VkXG4gICMgc2luY2UgbGFzdCBjaGVja1xuICAjXG4gICMgUmV0dXJucyBhIHtQcm9taXNlfSBvZiBhIHtib29sZWFufSBpZiByZXBvIGluZm9zIGhhdmUgY2hhbmdlZFxuICBjaGVja1JlcG9zaXRvcnlIYXNDaGFuZ2VkQXN5bmM6ICgpID0+XG4gICAgcmV0dXJuIEBnZXRIZ1dvcmtpbmdDb3B5UmV2aXNpb25Bc3luYygpLnRoZW4gKHJldmlzaW9uKSA9PlxuICAgICAgaWYgcmV2aXNpb24/IGFuZCByZXZpc2lvbiAhPSBAcmV2aXNpb25cbiAgICAgICAgQHJldmlzaW9uID0gcmV2aXNpb25cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIHJldHVybiBmYWxzZVxuXG4gIGdldFNob3J0SGVhZEFzeW5jOiAoKSA9PlxuICAgIHJldHVybiBuZXcgUHJvbWlzZSAocmVzb2x2ZSkgPT5cbiAgICAgIGJyYW5jaEZpbGUgPSBAcm9vdFBhdGggKyAnLy5oZy9icmFuY2gnXG4gICAgICBib29rbWFya0ZpbGUgPSBAcm9vdFBhdGggKyAnLy5oZy9ib29rbWFya3MuY3VycmVudCdcbiAgICAgIHByb21wdCA9ICdkZWZhdWx0J1xuXG4gICAgICBmcy5yZWFkRmlsZSBicmFuY2hGaWxlLCAndXRmOCcsIChlcnIsIGRhdGEpID0+XG4gICAgICAgIHByb21wdCA9IGRhdGEudHJpbSgpIHVubGVzcyBlcnJcbiAgICAgICAgZnMucmVhZEZpbGUgYm9va21hcmtGaWxlLCAndXRmOCcsIChlcnIsIGRhdGEpID0+XG4gICAgICAgICAgcHJvbXB0ICs9ICc6JyArIGRhdGEudHJpbSgpIHVubGVzcyBlcnJcbiAgICAgICAgICBAZ2V0SGdUYWdzQXN5bmMoKS50aGVuICh0YWdzKSAtPlxuICAgICAgICAgICAgcHJvbXB0ICs9ICc6JyArIHRhZ3Muam9pbignLCcpIGlmIHRhZ3M/Lmxlbmd0aFxuICAgICAgICAgIC50aGVuICgpIC0+ICMgRmluYWxseVxuICAgICAgICAgICAgcmVzb2x2ZSBwcm9tcHRcblxuXG5cbiAgIyMjXG4gIFNlY3Rpb246IFRyZWVWaWV3IFBhdGggTWVyY3VyaWFsIHN0YXR1c1xuICAjIyNcblxuICAjIFBhcnNlcyBgaGcgc3RhdHVzYC4gR2V0cyBpbml0aWFsbHkgY2FsbGVkIGJ5IGhnLXJlcG9zaXRvcnkucmVmcmVzaFN0YXR1cygpXG4gICNcbiAgIyBSZXR1cm5zIGEge1Byb21pc2V9IG9mIGFuIHtBcnJheX0gYXJyYXkga2V5cyBhcmUgcGF0aHMsIHZhbHVlcyBhcmUgY2hhbmdlXG4gICMgY29uc3RhbnRzLiBPciBudWxsXG4gIGdldFN0YXR1czogKCkgLT5cbiAgICByZXR1cm4gQGdldEhnU3RhdHVzQXN5bmMoKVxuXG4gICMgUGFyc2VzIGBoZyBzdGF0dXNgLiBHZXRzIGNhbGxlZCBieSBoZy1yZXBvc2l0b3J5LnJlZnJlc2hTdGF0dXMoKVxuICAjXG4gICMgUmV0dXJucyBhbiB7QXJyYXl9IEFycmF5IGtleXMgYXJlIHBhdGhzLCB2YWx1ZXMgYXJlIGNoYW5nZSBjb25zdGFudHNcbiAgZ2V0UGF0aFN0YXR1czogKGhnUGF0aCkgLT5cbiAgICBzdGF0dXMgPSBAZ2V0SGdQYXRoU3RhdHVzKGhnUGF0aClcbiAgICByZXR1cm4gc3RhdHVzXG5cbiAgZ2V0UGF0aDogKCkgLT5cbiAgICByZXR1cm4gQHJvb3RQYXRoXG5cbiAgaXNTdGF0dXNNb2RpZmllZDogKHN0YXR1cz0wKSAtPlxuICAgIChzdGF0dXMgJiBtb2RpZmllZFN0YXR1c0ZsYWdzKSA+IDBcblxuICBpc1BhdGhNb2RpZmllZDogKHBhdGgpIC0+XG4gICAgQGlzU3RhdHVzTW9kaWZpZWQoQGdldFBhdGhTdGF0dXMocGF0aCkpXG5cbiAgaXNTdGF0dXNOZXc6IChzdGF0dXM9MCkgLT5cbiAgICAoc3RhdHVzICYgbmV3U3RhdHVzRmxhZ3MpID4gMFxuXG4gIGlzUGF0aE5ldzogKHBhdGgpIC0+XG4gICAgQGlzU3RhdHVzTmV3KEBnZXRQYXRoU3RhdHVzKHBhdGgpKVxuXG4gIGlzU3RhdHVzRGVsZXRlZDogKHN0YXR1cz0wKSAtPlxuICAgIChzdGF0dXMgJiBkZWxldGVkU3RhdHVzRmxhZ3MpID4gMFxuXG4gIGlzUGF0aERlbGV0ZWQ6IChwYXRoKSAtPlxuICAgIEBpc1N0YXR1c0RlbGV0ZWQoQGdldFBhdGhTdGF0dXMocGF0aCkpXG5cbiAgaXNQYXRoU3RhZ2VkOiAocGF0aCkgLT5cbiAgICBAaXNTdGF0dXNTdGFnZWQoQGdldFBhdGhTdGF0dXMocGF0aCkpXG5cbiAgaXNTdGF0dXNJZ25vcmVkOiAoc3RhdHVzPTApIC0+XG4gICAgKHN0YXR1cyAmIHN0YXR1c0lnbm9yZWQpID4gMFxuXG4gIGlzU3RhdHVzU3RhZ2VkOiAoc3RhdHVzPTApIC0+XG4gICAgKHN0YXR1cyAmIHN0YXR1c1dvcmtpbmdEaXJOZXcpID09IDBcblxuXG4gICMjI1xuICBTZWN0aW9uOiBFZGl0b3IgTWVyY3VyaWFsIGxpbmUgZGlmZnNcbiAgIyMjXG5cbiAgIyBQdWJsaWM6IFJldHJpZXZlcyB0aGUgbnVtYmVyIG9mIGxpbmVzIGFkZGVkIGFuZCByZW1vdmVkIHRvIGEgcGF0aC5cbiAgI1xuICAjIFRoaXMgY29tcGFyZXMgdGhlIHdvcmtpbmcgZGlyZWN0b3J5IGNvbnRlbnRzIG9mIHRoZSBwYXRoIHRvIHRoZSBgSEVBRGBcbiAgIyB2ZXJzaW9uLlxuICAjXG4gICMgKiBgcGF0aGAgVGhlIHtTdHJpbmd9IHBhdGggdG8gY2hlY2suXG4gICMgKiBgbGFzdFJldkZpbGVDb250ZW50YCBmaWxlY29udGVudCBmcm9tIGxhdGVzdCBoZyByZXZpc2lvbi5cbiAgI1xuICAjIFJldHVybnMgYW4ge09iamVjdH0gd2l0aCB0aGUgZm9sbG93aW5nIGtleXM6XG4gICMgICAqIGBhZGRlZGAgVGhlIHtOdW1iZXJ9IG9mIGFkZGVkIGxpbmVzLlxuICAjICAgKiBgZGVsZXRlZGAgVGhlIHtOdW1iZXJ9IG9mIGRlbGV0ZWQgbGluZXMuXG4gIGdldERpZmZTdGF0czogKHBhdGgsIGxhc3RSZXZGaWxlQ29udGVudCkgLT5cbiAgICBkaWZmU3RhdHMgPSB7XG4gICAgICBhZGRlZDogMFxuICAgICAgZGVsZXRlZDogMFxuICAgIH1cbiAgICBpZiAobGFzdFJldkZpbGVDb250ZW50PyAmJiBmcy5leGlzdHNTeW5jKHBhdGgpKVxuICAgICAgYmFzZSA9IGRpZmZMaWIuc3RyaW5nQXNMaW5lcyhsYXN0UmV2RmlsZUNvbnRlbnQpXG4gICAgICBuZXd0eHQgPSBkaWZmTGliLnN0cmluZ0FzTGluZXMoZnMucmVhZEZpbGVTeW5jKHBhdGgpLnRvU3RyaW5nKCkpXG5cbiAgICAgICMgY3JlYXRlIGEgU2VxdWVuY2VNYXRjaGVyIGluc3RhbmNlIHRoYXQgZGlmZnMgdGhlIHR3byBzZXRzIG9mIGxpbmVzXG4gICAgICBzbSA9IG5ldyBkaWZmTGliLlNlcXVlbmNlTWF0Y2hlcihiYXNlLCBuZXd0eHQpXG5cbiAgICAgICMgZ2V0IHRoZSBvcGNvZGVzIGZyb20gdGhlIFNlcXVlbmNlTWF0Y2hlciBpbnN0YW5jZVxuICAgICAgIyBvcGNvZGVzIGlzIGEgbGlzdCBvZiAzLXR1cGxlcyBkZXNjcmliaW5nIHdoYXQgY2hhbmdlcyBzaG91bGQgYmUgbWFkZSB0byB0aGUgYmFzZSB0ZXh0XG4gICAgICAjIGluIG9yZGVyIHRvIHlpZWxkIHRoZSBuZXcgdGV4dFxuICAgICAgb3Bjb2RlcyA9IHNtLmdldF9vcGNvZGVzKClcblxuICAgICAgZm9yIG9wY29kZSBpbiBvcGNvZGVzXG4gICAgICAgIGlmIG9wY29kZVswXSA9PSAnaW5zZXJ0JyB8fCBvcGNvZGVbMF0gPT0gJ3JlcGxhY2UnXG4gICAgICAgICAgZGlmZlN0YXRzLmFkZGVkICs9IChvcGNvZGVbMl0gLSBvcGNvZGVbMV0pICsgKG9wY29kZVs0XSAtIG9wY29kZVszXSlcbiAgICAgICAgaWYgb3Bjb2RlWzBdID09ICdkZWxldGUnXG4gICAgICAgICAgZGlmZlN0YXRzLmRlbGV0ZWQgKz0gKG9wY29kZVsyXSAtIG9wY29kZVsxXSkgLSAob3Bjb2RlWzRdIC0gb3Bjb2RlWzNdKVxuXG4gICAgcmV0dXJuIGRpZmZTdGF0c1xuXG4gICMgUHVibGljOiBSZXRyaWV2ZXMgdGhlIGxpbmUgZGlmZnMgY29tcGFyaW5nIHRoZSBgSEVBRGAgdmVyc2lvbiBvZiB0aGUgZ2l2ZW5cbiAgIyBwYXRoIGFuZCB0aGUgZ2l2ZW4gdGV4dC5cbiAgI1xuICAjICogYGxhc3RSZXZGaWxlQ29udGVudGAgZmlsZWNvbnRlbnQgZnJvbSBsYXRlc3QgaGcgcmV2aXNpb24uXG4gICMgKiBgdGV4dGAgVGhlIHtTdHJpbmd9IHRvIGNvbXBhcmUgYWdhaW5zdCB0aGUgYEhFQURgIGNvbnRlbnRzXG4gICNcbiAgIyBSZXR1cm5zIGFuIHtBcnJheX0gb2YgaHVuayB7T2JqZWN0fXMgd2l0aCB0aGUgZm9sbG93aW5nIGtleXM6XG4gICMgICAqIGBvbGRTdGFydGAgVGhlIGxpbmUge051bWJlcn0gb2YgdGhlIG9sZCBodW5rLlxuICAjICAgKiBgbmV3U3RhcnRgIFRoZSBsaW5lIHtOdW1iZXJ9IG9mIHRoZSBuZXcgaHVuay5cbiAgIyAgICogYG9sZExpbmVzYCBUaGUge051bWJlcn0gb2YgbGluZXMgaW4gdGhlIG9sZCBodW5rLlxuICAjICAgKiBgbmV3TGluZXNgIFRoZSB7TnVtYmVyfSBvZiBsaW5lcyBpbiB0aGUgbmV3IGh1bmtcbiAgZ2V0TGluZURpZmZzOiAobGFzdFJldkZpbGVDb250ZW50LCB0ZXh0LCBvcHRpb25zKSAtPlxuICAgIGh1bmtzID0gW11cblxuICAgIGlmIChsYXN0UmV2RmlsZUNvbnRlbnQ/KVxuICAgICAgYmFzZSA9IGRpZmZMaWIuc3RyaW5nQXNMaW5lcyhsYXN0UmV2RmlsZUNvbnRlbnQpXG4gICAgICBuZXd0eHQgPSBkaWZmTGliLnN0cmluZ0FzTGluZXModGV4dClcbiAgICAgICMgY3JlYXRlIGEgU2VxdWVuY2VNYXRjaGVyIGluc3RhbmNlIHRoYXQgZGlmZnMgdGhlIHR3byBzZXRzIG9mIGxpbmVzXG4gICAgICBzbSA9IG5ldyBkaWZmTGliLlNlcXVlbmNlTWF0Y2hlcihiYXNlLCBuZXd0eHQpXG5cbiAgICAgICMgZ2V0IHRoZSBvcGNvZGVzIGZyb20gdGhlIFNlcXVlbmNlTWF0Y2hlciBpbnN0YW5jZVxuICAgICAgIyBvcGNvZGVzIGlzIGEgbGlzdCBvZiAzLXR1cGxlcyBkZXNjcmliaW5nIHdoYXQgY2hhbmdlcyBzaG91bGQgYmUgbWFkZSB0byB0aGUgYmFzZSB0ZXh0XG4gICAgICAjIGluIG9yZGVyIHRvIHlpZWxkIHRoZSBuZXcgdGV4dFxuICAgICAgb3Bjb2RlcyA9IHNtLmdldF9vcGNvZGVzKClcblxuICAgICAgYWN0aW9ucyA9IFsncmVwbGFjZScsICdpbnNlcnQnLCAnZGVsZXRlJ11cbiAgICAgIGZvciBvcGNvZGUgaW4gb3Bjb2Rlc1xuICAgICAgICBpZiBhY3Rpb25zLmluZGV4T2Yob3Bjb2RlWzBdKSA+PSAwXG4gICAgICAgICAgaHVuayA9IHtcbiAgICAgICAgICAgIG9sZFN0YXJ0OiBvcGNvZGVbMV0gKyAxXG4gICAgICAgICAgICBvbGRMaW5lczogb3Bjb2RlWzJdIC0gb3Bjb2RlWzFdXG4gICAgICAgICAgICBuZXdTdGFydDogb3Bjb2RlWzNdICsgMVxuICAgICAgICAgICAgbmV3TGluZXM6IG9wY29kZVs0XSAtIG9wY29kZVszXVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiBvcGNvZGVbMF0gPT0gJ2RlbGV0ZSdcbiAgICAgICAgICAgIGh1bmsubmV3U3RhcnQgPSBodW5rLm5ld1N0YXJ0IC0gMVxuICAgICAgICAgIGh1bmtzLnB1c2goaHVuaylcblxuICAgIHJldHVybiBodW5rc1xuXG4gICMjI1xuICBTZWN0aW9uOiBNZXJjdXJpYWwgQ29tbWFuZCBoYW5kbGluZ1xuICAjIyNcblxuICAjIFNwYXducyBhbiBoZyBjb21tYW5kIGFuZCByZXR1cm5zIHN0ZG91dCBvciB0aHJvd3MgYW4gZXJyb3IgaWYgcHJvY2Vzc1xuICAjIGV4aXRzIHdpdGggYW4gZXhpdGNvZGUgdW5lcXVhbCB0byB6ZXJvLlxuICAjXG4gICMgKiBgcGFyYW1zYCBUaGUge0FycmF5fSBmb3IgY29tbWFuZGxpbmUgYXJndW1lbnRzXG4gICNcbiAgIyBSZXR1cm5zIGEge1N0cmluZ30gb2YgcHJvY2VzcyBzdGRvdXRcbiAgaGdDb21tYW5kOiAocGFyYW1zKSAtPlxuICAgIGlmICFwYXJhbXNcbiAgICAgIHBhcmFtcyA9IFtdXG4gICAgaWYgIXV0aWwuaXNBcnJheShwYXJhbXMpXG4gICAgICBwYXJhbXMgPSBbcGFyYW1zXVxuXG4gICAgaWYgIUBpc0NvbW1hbmRGb3JSZXBvKHBhcmFtcylcbiAgICAgIHJldHVybiAnJ1xuXG4gICAgY2hpbGQgPSBzcGF3blN5bmMoJ2hnJywgcGFyYW1zLCB7IGN3ZDogQHJvb3RQYXRoIH0pXG4gICAgaWYgY2hpbGQuc3RhdHVzICE9IDBcbiAgICAgIGlmIGNoaWxkLnN0ZGVyclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoY2hpbGQuc3RkZXJyLnRvU3RyaW5nKCkpXG5cbiAgICAgIGlmIGNoaWxkLnN0ZG91dFxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoY2hpbGQuc3Rkb3V0LnRvU3RyaW5nKCkpXG5cbiAgICAgIHRocm93IG5ldyBFcnJvcignRXJyb3IgdHJ5aW5nIHRvIGV4ZWN1dGUgTWVyY3VyaWFsIGJpbmFyeSB3aXRoIHBhcmFtcyBcXCcnICsgcGFyYW1zICsgJ1xcJycpXG5cbiAgICByZXR1cm4gY2hpbGQuc3Rkb3V0LnRvU3RyaW5nKClcblxuICBoZ0NvbW1hbmRBc3luYzogKHBhcmFtcykgLT5cbiAgICBpZiAhcGFyYW1zXG4gICAgICBwYXJhbXMgPSBbXVxuICAgIGlmICF1dGlsLmlzQXJyYXkocGFyYW1zKVxuICAgICAgcGFyYW1zID0gW3BhcmFtc11cblxuICAgIGlmICFAaXNDb21tYW5kRm9yUmVwbyhwYXJhbXMpXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCcnKVxuXG4gICAgZmxhdEFyZ3MgPSBwYXJhbXMucmVkdWNlIChwcmV2LCBuZXh0KSAtPlxuICAgICAgaWYgbmV4dC5pbmRleE9mPyBhbmQgbmV4dC5pbmRleE9mKCcgJykgIT0gLTFcbiAgICAgICAgbmV4dCA9IFwiXFxcIlwiICsgbmV4dCArIFwiXFxcIlwiXG5cbiAgICAgIHByZXYgKyBcIiBcIiArIG5leHRcbiAgICAsIFwiXCJcbiAgICBmbGF0QXJncyA9IGZsYXRBcmdzLnN1YnN0cmluZygxKVxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlIChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICBvcHRzID1cbiAgICAgICAgY3dkOiBAcm9vdFBhdGhcbiAgICAgICAgbWF4QnVmZmVyOiA1MCAqIDEwMjQgKiAxMDI0XG4gICAgICBjaGlsZCA9IGV4ZWMgJ2hnICcgKyBmbGF0QXJncywgb3B0cywgKGVyciwgc3Rkb3V0LCBzdGRlcnIpIC0+XG4gICAgICAgIGlmIGVyclxuICAgICAgICAgIHJlamVjdCBlcnJcbiAgICAgICAgaWYgc3RkZXJyPy5sZW5ndGggPiAwXG4gICAgICAgICAgcmVqZWN0IHN0ZGVyclxuICAgICAgICByZXNvbHZlIHN0ZG91dFxuXG4gIGhhbmRsZUhnRXJyb3I6IChlcnJvcikgLT5cbiAgICBsb2dNZXNzYWdlID0gdHJ1ZVxuICAgIG1lc3NhZ2UgPSBlcnJvci5tZXNzYWdlXG4gICAgZm9yIHN1cHByZXNzSGdXYXJuaW5nIGluIHN1cHByZXNzSGdXYXJuaW5nc1xuICAgICAgaWYgbWVzc2FnZS5pbmRleE9mKHN1cHByZXNzSGdXYXJuaW5nKSA+IDBcbiAgICAgICAgbG9nTWVzc2FnZSA9IGZhbHNlXG4gICAgICAgIGJyZWFrXG4gICAgaWYgbG9nTWVzc2FnZVxuICAgICAgY29uc29sZS5lcnJvcignTWVyY3VyaWFsJywgJ2hnLXV0aWxzJywgZXJyb3IpXG5cbiAgIyBSZXR1cm5zIG9uIHN1Y2Nlc3MgdGhlIHZlcnNpb24gZnJvbSB0aGUgaGcgYmluYXJ5LiBPdGhlcndpc2UgbnVsbC5cbiAgI1xuICAjIFJldHVybnMgYSB7U3RyaW5nfSBjb250YWluaW5nIHRoZSBoZy1iaW5hcnkgdmVyc2lvblxuICBnZXRIZ1ZlcnNpb246ICgpIC0+XG4gICAgdHJ5XG4gICAgICB2ZXJzaW9uID0gQGhnQ29tbWFuZChbJy0tdmVyc2lvbicsICctLXF1aWV0J10pXG4gICAgICByZXR1cm4gdmVyc2lvbi50cmltKClcbiAgICBjYXRjaCBlcnJvclxuICAgICAgQGhhbmRsZUhnRXJyb3IoZXJyb3IpXG4gICAgICByZXR1cm4gbnVsbFxuXG4gICMgUmV0dXJucyBvbiBzdWNjZXNzIHRoZSBjdXJyZW50IHdvcmtpbmcgY29weSByZXZpc2lvbi4gT3RoZXJ3aXNlIG51bGwuXG4gICNcbiAgIyBSZXR1cm5zIGEge1Byb21pc2V9IG9mIGEge1N0cmluZ30gd2l0aCB0aGUgY3VycmVudCB3b3JraW5nIGNvcHkgcmV2aXNpb25cbiAgZ2V0SGdXb3JraW5nQ29weVJldmlzaW9uQXN5bmM6ICgpID0+XG4gICAgQGhnQ29tbWFuZEFzeW5jKFsnaWQnLCAnLWknLCBAcm9vdFBhdGhdKS5jYXRjaCAoZXJyb3IpID0+XG4gICAgICBAaGFuZGxlSGdFcnJvcihlcnJvcilcbiAgICAgIHJldHVybiBudWxsXG5cbiAgZ2V0UmVjdXJzaXZlSWdub3JlU3RhdHVzZXM6ICgpIC0+XG4gICAgcmV2aXNpb24gPSBAZGlmZlJldmlzaW9uUHJvdmlkZXIoKVxuICAgIEBoZ0NvbW1hbmRBc3luYyhbJ3N0YXR1cycsIEByb290UGF0aCwgXCItaVwiLCBcIi0tcmV2XCIsIHJldmlzaW9uXSlcbiAgICAudGhlbiAoZmlsZXMpID0+XG4gICAgICBpdGVtcyA9IFtdXG4gICAgICBlbnRyaWVzID0gZmlsZXMuc3BsaXQoJ1xcbicpXG4gICAgICBpZiBlbnRyaWVzXG4gICAgICAgIGZvciBlbnRyeSBpbiBlbnRyaWVzXG4gICAgICAgICAgcGFydHMgPSBlbnRyeS5zcGxpdCgnICcpXG4gICAgICAgICAgc3RhdHVzID0gcGFydHNbMF1cbiAgICAgICAgICBwYXRoUGFydCA9IHBhcnRzWzFdXG4gICAgICAgICAgaWYgcGF0aFBhcnQ/ICYmIHN0YXR1cz9cbiAgICAgICAgICAgIGlmIChzdGF0dXMgaXMgJ0knKSAjIHx8IHN0YXR1cyBpcyAnPycpXG4gICAgICAgICAgICAgIGl0ZW1zLnB1c2gocGF0aFBhcnQucmVwbGFjZSgnLi4nLCAnJykpXG4gICAgICAocGF0aC5qb2luIEByb290UGF0aCwgaXRlbSBmb3IgaXRlbSBpbiBpdGVtcylcbiAgICAuY2F0Y2ggKGVycm9yKSA9PlxuICAgICAgQGhhbmRsZUhnRXJyb3IgZXJyb3JcbiAgICAgIFtdXG5cbiAgZ2V0SGdTdGF0dXNBc3luYzogKCkgLT5cbiAgICByZXZpc2lvbiA9IEBkaWZmUmV2aXNpb25Qcm92aWRlcigpXG4gICAgQGhnQ29tbWFuZEFzeW5jKFsnc3RhdHVzJywgQHJvb3RQYXRoLCAnLS1yZXYnLCByZXZpc2lvbl0pLnRoZW4gKGZpbGVzKSA9PlxuICAgICAgaXRlbXMgPSBbXVxuICAgICAgZW50cmllcyA9IGZpbGVzLnNwbGl0KCdcXG4nKVxuICAgICAgaWYgZW50cmllc1xuICAgICAgICBmb3IgZW50cnkgaW4gZW50cmllc1xuICAgICAgICAgIHBhcnRzID0gZW50cnkuc3BsaXQoJyAnKVxuICAgICAgICAgIHN0YXR1cyA9IHBhcnRzWzBdXG4gICAgICAgICAgcGF0aFBhcnQgPSBwYXJ0c1sxXVxuICAgICAgICAgIGlmIHBhdGhQYXJ0PyAmJiBzdGF0dXM/XG4gICAgICAgICAgICBpdGVtcy5wdXNoKHtcbiAgICAgICAgICAgICAgJ3BhdGgnOiBwYXRoLmpvaW4gQHJvb3RQYXRoLCBwYXRoUGFydFxuICAgICAgICAgICAgICAnc3RhdHVzJzogQG1hcEhnU3RhdHVzKHN0YXR1cylcbiAgICAgICAgICAgIH0pXG5cbiAgICAgIHJldHVybiBpdGVtc1xuICAgIC5jYXRjaCAoZXJyb3IpID0+XG4gICAgICBAaGFuZGxlSGdFcnJvcihlcnJvcilcbiAgICAgIHJldHVybiBudWxsXG5cbiAgIyBSZXR1cm5zIG9uIHN1Y2Nlc3MgdGhlIGxpc3Qgb2YgdGFncyBmb3IgdGhpcyByZXZpc2lvbi4gT3RoZXJ3aXNlIG51bGwuXG4gICNcbiAgIyBSZXR1cm5zIGEge1ByaW1pc2V9IG9mIGFuIHtBcnJheX0gb2Yge1N0cmluZ31zIHJlcHJlc2VudGluZyB0aGUgc3RhdHVzXG4gIGdldEhnVGFnc0FzeW5jOiAoKSAtPlxuICAgIEBoZ0NvbW1hbmRBc3luYyhbJ2lkJywgJy10JywgQHJvb3RQYXRoXSkudGhlbiAodGFncykgLT5cbiAgICAgIHRhZ3MgPSB0YWdzLnRyaW0oKVxuICAgICAgcmV0dXJuIHRhZ3Muc3BsaXQoJyAnKS5zb3J0KCkgaWYgdGFnc1xuICAgIC5jYXRjaCAoZXJyb3IpID0+XG4gICAgICBAaGFuZGxlSGdFcnJvcihlcnJvcilcbiAgICAgIHJldHVybiBudWxsXG5cbiAgIyBSZXR1cm5zIG9uIHN1Y2Nlc3MgYSBzdGF0dXMgYml0bWFzay4gT3RoZXJ3aXNlIG51bGwuXG4gICNcbiAgIyAqIGBoZ1BhdGhgIFRoZSBwYXRoIHtTdHJpbmd9IGZvciB0aGUgc3RhdHVzIGlucXVpcnlcbiAgI1xuICAjIFJldHVybnMgYSB7TnVtYmVyfSByZXByZXNlbnRpbmcgdGhlIHN0YXR1c1xuICBnZXRIZ1BhdGhTdGF0dXM6IChoZ1BhdGgpIC0+XG4gICAgcmV0dXJuIG51bGwgdW5sZXNzIGhnUGF0aFxuXG4gICAgdHJ5XG4gICAgICByZXZpc2lvbiA9IEBkaWZmUmV2aXNpb25Qcm92aWRlcigpXG4gICAgICBmaWxlcyA9IEBoZ0NvbW1hbmQoWydzdGF0dXMnLCBoZ1BhdGgsICctLXJldicsIHJldmlzaW9uXSlcbiAgICBjYXRjaCBlcnJvclxuICAgICAgQGhhbmRsZUhnRXJyb3IoZXJyb3IpXG4gICAgICByZXR1cm4gbnVsbFxuXG4gICAgaXRlbXMgPSBbXVxuICAgIGVudHJpZXMgPSBmaWxlcy5zcGxpdCgnXFxuJylcbiAgICBpZiBlbnRyaWVzXG4gICAgICBwYXRoX3N0YXR1cyA9IDBcbiAgICAgIGZvciBlbnRyeSBpbiBlbnRyaWVzXG4gICAgICAgIHBhcnRzID0gZW50cnkuc3BsaXQoJyAnKVxuICAgICAgICBzdGF0dXMgPSBwYXJ0c1swXVxuICAgICAgICBwYXRoUGFydCA9IHBhcnRzWzFdXG4gICAgICAgIGlmIHN0YXR1cz9cbiAgICAgICAgICBwYXRoX3N0YXR1cyB8PSBAbWFwSGdTdGF0dXMoc3RhdHVzKVxuICAgICAgcmV0dXJuIHBhdGhfc3RhdHVzXG4gICAgZWxzZVxuICAgICAgcmV0dXJuIG51bGxcblxuICAjIFRyYW5zbGF0ZXMgdGhlIHN0YXR1cyB7U3RyaW5nfSBmcm9tIGBoZyBzdGF0dXNgIGNvbW1hbmQgaW50byBhXG4gICMgc3RhdHVzIHtOdW1iZXJ9LlxuICAjXG4gICMgKiBgc3RhdHVzYCBUaGUgc3RhdHVzIHtTdHJpbmd9IGZyb20gYGhnIHN0YXR1c2AgY29tbWFuZFxuICAjXG4gICMgUmV0dXJucyBhIHtOdW1iZXJ9IHJlcHJlc2VudGluZyB0aGUgc3RhdHVzXG4gIG1hcEhnU3RhdHVzOiAoc3RhdHVzKSAtPlxuICAgIHJldHVybiAwIHVubGVzcyBzdGF0dXNcbiAgICBzdGF0dXNCaXRtYXNrID0gMFxuXG4gICAgIyBzdGF0dXMgd29ya2luZ2RpclxuICAgIGlmIHN0YXR1cyA9PSAnTSdcbiAgICAgIHN0YXR1c0JpdG1hc2sgPSBzdGF0dXNXb3JraW5nRGlyTW9kaWZpZWRcbiAgICBpZiBzdGF0dXMgPT0gJz8nXG4gICAgICBzdGF0dXNCaXRtYXNrID0gc3RhdHVzV29ya2luZ0Rpck5ld1xuICAgIGlmIHN0YXR1cyA9PSAnISdcbiAgICAgIHN0YXR1c0JpdG1hc2sgPSBzdGF0dXNXb3JraW5nRGlyRGVsZXRlXG4gICAgaWYgc3RhdHVzID09ICdJJ1xuICAgICAgc3RhdHVzQml0bWFzayA9IHN0YXR1c0lnbm9yZWRcbiAgICBpZiBzdGF0dXMgPT0gJ00nXG4gICAgICBzdGF0dXNCaXRtYXNrID0gc3RhdHVzV29ya2luZ0RpclR5cGVDaGFuZ2VcblxuICAgICMgc3RhdHVzIGluZGV4XG4gICAgaWYgc3RhdHVzID09ICdBJ1xuICAgICAgc3RhdHVzQml0bWFzayA9IHN0YXR1c0luZGV4TmV3XG4gICAgaWYgc3RhdHVzID09ICdSJ1xuICAgICAgc3RhdHVzQml0bWFzayA9IHN0YXR1c0luZGV4RGVsZXRlZFxuXG4gICAgcmV0dXJuIHN0YXR1c0JpdG1hc2tcblxuICAjIFRoaXMgcmV0cmlldmVzIHRoZSBjb250ZW50cyBvZiB0aGUgaGdwYXRoIGZyb20gdGhlIGRpZmYgcmV2aXNpb24gb24gc3VjY2Vzcy5cbiAgIyBPdGhlcndpc2UgbnVsbC5cbiAgI1xuICAjICogYGhnUGF0aGAgVGhlIHBhdGgge1N0cmluZ31cbiAgI1xuICAjIFJldHVybnMge1Byb21pc2V9IG9mIGEge1N0cmluZ30gd2l0aCB0aGUgZmlsZWNvbnRlbnRcbiAgZ2V0SGdDYXRBc3luYzogKGhnUGF0aCkgLT5cbiAgICByZXZpc2lvbiA9IEBkaWZmUmV2aXNpb25Qcm92aWRlcigpXG4gICAgcGFyYW1zID0gWydjYXQnLCBoZ1BhdGgsICctLXJldicsIHJldmlzaW9uXVxuICAgIHJldHVybiBAaGdDb21tYW5kQXN5bmMocGFyYW1zKS5jYXRjaCAoZXJyb3IpID0+XG4gICAgICBpZiAvbm8gc3VjaCBmaWxlIGluIHJldi8udGVzdChlcnJvcilcbiAgICAgICAgcmV0dXJuIG51bGxcblxuICAgICAgQGhhbmRsZUhnRXJyb3IgZXJyb3JcbiAgICAgIHJldHVybiBudWxsXG5cbiAgIyBUaGlzIGNoZWNrcyB0byBzZWUgaWYgdGhlIGN1cnJlbnQgcGFyYW1zIGluZGljYXRlIHdoZXRoZXIgd2UgYXJlIHdvcmtpbmdcbiAgIyB3aXRoIHRoZSBjdXJyZW50IHJlcG9zaXRvcnkuXG4gICNcbiAgIyAqIGBwYXJhbXNgIFRoZSBwYXJhbXMgdGhhdCBhcmUgZ29pbmcgdG8gYmUgc2VudCB0byB0aGUgaGcgY29tbWFuZCB7QXJyYXl9XG4gICNcbiAgIyBSZXR1cm5zIGEge0Jvb2xlYW59IGluZGljYXRpbmcgaWYgdGhlIHJvb3RQYXRoIHdhcyBmb3VuZCBpbiB0aGUgcGFyYW1zXG4gIGlzQ29tbWFuZEZvclJlcG86IChwYXJhbXMpIC0+XG4gICAgcm9vdFBhdGggPSBAcm9vdFBhdGhcblxuICAgIHBhdGhzID0gcGFyYW1zLmZpbHRlciAocGFyYW0pIC0+XG4gICAgICBub3JtYWxpemVkUGF0aCA9IHBhdGgubm9ybWFsaXplKChwYXJhbSB8fCAnJykpXG4gICAgICByZXR1cm4gbm9ybWFsaXplZFBhdGguc3RhcnRzV2l0aChyb290UGF0aClcblxuICAgIHJldHVybiBwYXRocy5sZW5ndGggPiAwXG5cblxuZXhwb3J0cy5pc1N0YXR1c01vZGlmaWVkID0gKHN0YXR1cykgLT5cbiAgcmV0dXJuIChzdGF0dXMgJiBtb2RpZmllZFN0YXR1c0ZsYWdzKSA+IDBcblxuZXhwb3J0cy5pc1N0YXR1c05ldyA9IChzdGF0dXMpIC0+XG4gIHJldHVybiAoc3RhdHVzICYgbmV3U3RhdHVzRmxhZ3MpID4gMFxuXG5leHBvcnRzLmlzU3RhdHVzRGVsZXRlZCA9IChzdGF0dXMpIC0+XG4gIHJldHVybiAoc3RhdHVzICYgZGVsZXRlZFN0YXR1c0ZsYWdzKSA+IDBcblxuZXhwb3J0cy5pc1N0YXR1c0lnbm9yZWQgPSAoc3RhdHVzKSAtPlxuICByZXR1cm4gKHN0YXR1cyAmIHN0YXR1c0lnbm9yZWQpID4gMFxuXG5leHBvcnRzLmlzU3RhdHVzU3RhZ2VkID0gKHN0YXR1cykgLT5cbiAgcmV0dXJuIChzdGF0dXMgJiBzdGF0dXNXb3JraW5nRGlyTmV3KSA9PSAwXG5cblxuIyBjcmVhdGVzIGFuZCByZXR1cm5zIGEgbmV3IHtSZXBvc2l0b3J5fSBvYmplY3QgaWYgaGctYmluYXJ5IGNvdWxkIGJlIGZvdW5kXG4jIGFuZCBzZXZlcmFsIGluZm9zIGZyb20gYXJlIHN1Y2Nlc3NmdWxseSByZWFkLiBPdGhlcndpc2UgbnVsbC5cbiNcbiMgKiBgcmVwb3NpdG9yeVBhdGhgIFRoZSBwYXRoIHtTdHJpbmd9IHRvIHRoZSByZXBvc2l0b3J5IHJvb3QgZGlyZWN0b3J5XG4jXG4jIFJldHVybnMgYSBuZXcge1JlcG9zaXRvcnl9IG9iamVjdFxub3BlblJlcG9zaXRvcnkgPSAocmVwb3NpdG9yeVBhdGgsIGRpZmZSZXZpc2lvblByb3ZpZGVyKSAtPlxuICByZXBvc2l0b3J5ID0gbmV3IFJlcG9zaXRvcnkocmVwb3NpdG9yeVBhdGgpXG4gIGlmIHJlcG9zaXRvcnkuY2hlY2tCaW5hcnlBdmFpbGFibGUoKSBhbmQgcmVwb3NpdG9yeS5leGlzdHMoKVxuICAgIHJlcG9zaXRvcnkuZGlmZlJldmlzaW9uUHJvdmlkZXIgPSBkaWZmUmV2aXNpb25Qcm92aWRlclxuICAgIHJldHVybiByZXBvc2l0b3J5XG4gIGVsc2VcbiAgICByZXR1cm4gbnVsbFxuXG5cbmV4cG9ydHMub3BlbiA9IChyZXBvc2l0b3J5UGF0aCwgZGlmZlJldmlzaW9uUHJvdmlkZXIpIC0+XG4gIHJldHVybiBvcGVuUmVwb3NpdG9yeShyZXBvc2l0b3J5UGF0aCwgZGlmZlJldmlzaW9uUHJvdmlkZXIpXG5cbiMgVmVyaWZpZXMgaWYgZ2l2ZW4gcGF0aCBpcyBhIHN5bWJvbGljIGxpbmsuXG4jIFJldHVybnMgb3JpZ2luYWwgcGF0aCBvciBudWxsIG90aGVyd2lzZS5cbnJlc29sdmVTeW1saW5rID0gKHJlcG9zaXRvcnlQYXRoKSAtPlxuICBsc3RhdCA9IGZzLmxzdGF0U3luYyhyZXBvc2l0b3J5UGF0aClcbiAgdW5sZXNzIGxzdGF0LmlzU3ltYm9saWNMaW5rKClcbiAgICByZXR1cm4gbnVsbFxuXG4gIHJldHVybiBmcy5yZWFscGF0aFN5bmMocmVwb3NpdG9yeVBhdGgpXG5cbmV4cG9ydHMucmVzb2x2ZVN5bWxpbmsgPSAocmVwb3NpdG9yeVBhdGgpIC0+XG4gIHJldHVybiByZXNvbHZlU3ltbGluayhyZXBvc2l0b3J5UGF0aClcbiJdfQ==
