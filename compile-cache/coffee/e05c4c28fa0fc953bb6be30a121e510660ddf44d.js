(function() {
  var HgRepository, HgRepositoryProvider, findRepositoryRoot;

  HgRepository = require('./hg-repository');

  findRepositoryRoot = function(directory) {
    var hgDir;
    hgDir = directory.getSubdirectory('.hg');
    if (typeof hgDir.existsSync === "function" ? hgDir.existsSync() : void 0) {
      return directory;
    } else if (directory.isRoot()) {
      return null;
    } else {
      return findRepositoryRoot(directory.getParent());
    }
  };

  module.exports = HgRepositoryProvider = (function() {
    function HgRepositoryProvider(project) {
      this.project = project;
      this.pathToRepository = {};
    }

    HgRepositoryProvider.prototype.repositoryForDirectory = function(directory) {
      return Promise.resolve(this.repositoryForDirectorySync(directory));
    };

    HgRepositoryProvider.prototype.repositoryForDirectorySync = function(directory) {
      var repo, repositoryPath, repositoryRoot;
      repositoryRoot = findRepositoryRoot(directory);
      if (!repositoryRoot) {
        return null;
      }
      repositoryPath = repositoryRoot.getPath();
      if (!this.pathToRepository) {
        this.pathToRepository = {};
      }
      repo = this.pathToRepository[repositoryPath];
      if (!repo) {
        repo = HgRepository.open(repositoryPath, {
          project: this.project,
          diffRevisionProvider: function() {
            return atom.config.get('atom-hg.diffAgainstRevision');
          }
        });
        if (!repo) {
          return null;
        }
        repo.setWorkingDirectory(directory.getPath());
        repo.onDidDestroy((function(_this) {
          return function() {
            return delete _this.pathToRepository[repositoryPath];
          };
        })(this));
        this.pathToRepository[repositoryPath] = repo;
        repo.refreshIndex();
        repo.refreshStatus();
      }
      return repo;
    };

    return HgRepositoryProvider;

  })();

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvYXRvbS1oZy9saWIvaGctcmVwb3NpdG9yeS1wcm92aWRlci5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBOztFQUFBLFlBQUEsR0FBZSxPQUFBLENBQVEsaUJBQVI7O0VBRWYsa0JBQUEsR0FBcUIsU0FBQyxTQUFEO0FBQ25CLFFBQUE7SUFBQSxLQUFBLEdBQVEsU0FBUyxDQUFDLGVBQVYsQ0FBMEIsS0FBMUI7SUFDUiw2Q0FBRyxLQUFLLENBQUMscUJBQVQ7QUFDRSxhQUFPLFVBRFQ7S0FBQSxNQUVLLElBQUcsU0FBUyxDQUFDLE1BQVYsQ0FBQSxDQUFIO0FBQ0gsYUFBTyxLQURKO0tBQUEsTUFBQTthQUdILGtCQUFBLENBQW1CLFNBQVMsQ0FBQyxTQUFWLENBQUEsQ0FBbkIsRUFIRzs7RUFKYzs7RUFTckIsTUFBTSxDQUFDLE9BQVAsR0FDUTtJQUNTLDhCQUFDLE9BQUQ7TUFBQyxJQUFDLENBQUEsVUFBRDtNQUNaLElBQUMsQ0FBQSxnQkFBRCxHQUFvQjtJQURUOzttQ0FHYixzQkFBQSxHQUF3QixTQUFDLFNBQUQ7YUFDdEIsT0FBTyxDQUFDLE9BQVIsQ0FBZ0IsSUFBQyxDQUFBLDBCQUFELENBQTRCLFNBQTVCLENBQWhCO0lBRHNCOzttQ0FHeEIsMEJBQUEsR0FBNEIsU0FBQyxTQUFEO0FBQzFCLFVBQUE7TUFBQSxjQUFBLEdBQWlCLGtCQUFBLENBQW1CLFNBQW5CO01BQ2pCLElBQUEsQ0FBTyxjQUFQO0FBQ0UsZUFBTyxLQURUOztNQUdBLGNBQUEsR0FBaUIsY0FBYyxDQUFDLE9BQWYsQ0FBQTtNQUNqQixJQUFHLENBQUMsSUFBQyxDQUFBLGdCQUFMO1FBQ0UsSUFBQyxDQUFBLGdCQUFELEdBQW9CLEdBRHRCOztNQUdBLElBQUEsR0FBTyxJQUFDLENBQUEsZ0JBQWlCLENBQUEsY0FBQTtNQUN6QixJQUFBLENBQU8sSUFBUDtRQUNFLElBQUEsR0FBTyxZQUFZLENBQUMsSUFBYixDQUFrQixjQUFsQixFQUNMO1VBQUEsT0FBQSxFQUFTLElBQUMsQ0FBQSxPQUFWO1VBQ0Esb0JBQUEsRUFBc0IsU0FBQTttQkFDcEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFaLENBQWdCLDZCQUFoQjtVQURvQixDQUR0QjtTQURLO1FBS1AsSUFBQSxDQUFtQixJQUFuQjtBQUFBLGlCQUFPLEtBQVA7O1FBR0EsSUFBSSxDQUFDLG1CQUFMLENBQXlCLFNBQVMsQ0FBQyxPQUFWLENBQUEsQ0FBekI7UUFDQSxJQUFJLENBQUMsWUFBTCxDQUFrQixDQUFBLFNBQUEsS0FBQTtpQkFBQSxTQUFBO21CQUFHLE9BQU8sS0FBQyxDQUFBLGdCQUFpQixDQUFBLGNBQUE7VUFBNUI7UUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWxCO1FBQ0EsSUFBQyxDQUFBLGdCQUFpQixDQUFBLGNBQUEsQ0FBbEIsR0FBb0M7UUFDcEMsSUFBSSxDQUFDLFlBQUwsQ0FBQTtRQUNBLElBQUksQ0FBQyxhQUFMLENBQUEsRUFiRjs7QUFlQSxhQUFPO0lBekJtQjs7Ozs7QUFuQmhDIiwic291cmNlc0NvbnRlbnQiOlsiSGdSZXBvc2l0b3J5ID0gcmVxdWlyZSAnLi9oZy1yZXBvc2l0b3J5J1xuXG5maW5kUmVwb3NpdG9yeVJvb3QgPSAoZGlyZWN0b3J5KSAtPlxuICBoZ0RpciA9IGRpcmVjdG9yeS5nZXRTdWJkaXJlY3RvcnkoJy5oZycpXG4gIGlmIGhnRGlyLmV4aXN0c1N5bmM/KClcbiAgICByZXR1cm4gZGlyZWN0b3J5XG4gIGVsc2UgaWYgZGlyZWN0b3J5LmlzUm9vdCgpXG4gICAgcmV0dXJuIG51bGxcbiAgZWxzZVxuICAgIGZpbmRSZXBvc2l0b3J5Um9vdChkaXJlY3RvcnkuZ2V0UGFyZW50KCkpXG5cbm1vZHVsZS5leHBvcnRzID1cbiAgY2xhc3MgSGdSZXBvc2l0b3J5UHJvdmlkZXJcbiAgICBjb25zdHJ1Y3RvcjogKEBwcm9qZWN0KSAtPlxuICAgICAgQHBhdGhUb1JlcG9zaXRvcnkgPSB7fVxuXG4gICAgcmVwb3NpdG9yeUZvckRpcmVjdG9yeTogKGRpcmVjdG9yeSkgLT5cbiAgICAgIFByb21pc2UucmVzb2x2ZShAcmVwb3NpdG9yeUZvckRpcmVjdG9yeVN5bmMoZGlyZWN0b3J5KSlcblxuICAgIHJlcG9zaXRvcnlGb3JEaXJlY3RvcnlTeW5jOiAoZGlyZWN0b3J5KSAtPlxuICAgICAgcmVwb3NpdG9yeVJvb3QgPSBmaW5kUmVwb3NpdG9yeVJvb3QoZGlyZWN0b3J5KVxuICAgICAgdW5sZXNzIHJlcG9zaXRvcnlSb290XG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICAgIHJlcG9zaXRvcnlQYXRoID0gcmVwb3NpdG9yeVJvb3QuZ2V0UGF0aCgpXG4gICAgICBpZiAhQHBhdGhUb1JlcG9zaXRvcnlcbiAgICAgICAgQHBhdGhUb1JlcG9zaXRvcnkgPSB7fVxuXG4gICAgICByZXBvID0gQHBhdGhUb1JlcG9zaXRvcnlbcmVwb3NpdG9yeVBhdGhdXG4gICAgICB1bmxlc3MgcmVwb1xuICAgICAgICByZXBvID0gSGdSZXBvc2l0b3J5Lm9wZW4gcmVwb3NpdG9yeVBhdGgsXG4gICAgICAgICAgcHJvamVjdDogQHByb2plY3RcbiAgICAgICAgICBkaWZmUmV2aXNpb25Qcm92aWRlcjogLT5cbiAgICAgICAgICAgIGF0b20uY29uZmlnLmdldCgnYXRvbS1oZy5kaWZmQWdhaW5zdFJldmlzaW9uJylcblxuICAgICAgICByZXR1cm4gbnVsbCB1bmxlc3MgcmVwb1xuXG4gICAgICAgICMgVE9ETzogdGFrZXMgZmlyc3QgcmVwb3NpdG9yeSBvbmx5XG4gICAgICAgIHJlcG8uc2V0V29ya2luZ0RpcmVjdG9yeShkaXJlY3RvcnkuZ2V0UGF0aCgpKVxuICAgICAgICByZXBvLm9uRGlkRGVzdHJveSg9PiBkZWxldGUgQHBhdGhUb1JlcG9zaXRvcnlbcmVwb3NpdG9yeVBhdGhdKVxuICAgICAgICBAcGF0aFRvUmVwb3NpdG9yeVtyZXBvc2l0b3J5UGF0aF0gPSByZXBvXG4gICAgICAgIHJlcG8ucmVmcmVzaEluZGV4KClcbiAgICAgICAgcmVwby5yZWZyZXNoU3RhdHVzKClcblxuICAgICAgcmV0dXJuIHJlcG9cbiJdfQ==
