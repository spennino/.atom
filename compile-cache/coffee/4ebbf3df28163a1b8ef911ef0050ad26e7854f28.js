(function() {
  var HgRepositoryProvider;

  HgRepositoryProvider = require('./hg-repository-provider');

  module.exports = {
    config: {
      diffAgainstRevision: {
        type: 'string',
        description: 'Revision that Mercurial will diff against.',
        "default": '.'
      }
    },
    activate: function() {
      return console.log('Activating atom-hg...');
    },
    deactivate: function() {
      return console.log('Deactivating atom-hg...');
    },
    getRepositoryProviderService: function() {
      return new HgRepositoryProvider(atom.project);
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3Blbm5pbm8vLmF0b20vcGFja2FnZXMvYXRvbS1oZy9saWIvYXRvbS1oZy5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBOztFQUFBLG9CQUFBLEdBQXVCLE9BQUEsQ0FBUSwwQkFBUjs7RUFFdkIsTUFBTSxDQUFDLE9BQVAsR0FDRTtJQUFBLE1BQUEsRUFDRTtNQUFBLG1CQUFBLEVBQ0U7UUFBQSxJQUFBLEVBQU0sUUFBTjtRQUNBLFdBQUEsRUFBYSw0Q0FEYjtRQUVBLENBQUEsT0FBQSxDQUFBLEVBQVMsR0FGVDtPQURGO0tBREY7SUFNQSxRQUFBLEVBQVUsU0FBQTthQUNSLE9BQU8sQ0FBQyxHQUFSLENBQVksdUJBQVo7SUFEUSxDQU5WO0lBU0EsVUFBQSxFQUFZLFNBQUE7YUFDVixPQUFPLENBQUMsR0FBUixDQUFZLHlCQUFaO0lBRFUsQ0FUWjtJQVlBLDRCQUFBLEVBQThCLFNBQUE7YUFDNUIsSUFBSSxvQkFBSixDQUF5QixJQUFJLENBQUMsT0FBOUI7SUFENEIsQ0FaOUI7O0FBSEYiLCJzb3VyY2VzQ29udGVudCI6WyJIZ1JlcG9zaXRvcnlQcm92aWRlciA9IHJlcXVpcmUgJy4vaGctcmVwb3NpdG9yeS1wcm92aWRlcidcblxubW9kdWxlLmV4cG9ydHMgPVxuICBjb25maWc6XG4gICAgZGlmZkFnYWluc3RSZXZpc2lvbjpcbiAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICBkZXNjcmlwdGlvbjogJ1JldmlzaW9uIHRoYXQgTWVyY3VyaWFsIHdpbGwgZGlmZiBhZ2FpbnN0LidcbiAgICAgIGRlZmF1bHQ6ICcuJ1xuXG4gIGFjdGl2YXRlOiAtPlxuICAgIGNvbnNvbGUubG9nICdBY3RpdmF0aW5nIGF0b20taGcuLi4nXG5cbiAgZGVhY3RpdmF0ZTogLT5cbiAgICBjb25zb2xlLmxvZyAnRGVhY3RpdmF0aW5nIGF0b20taGcuLi4nXG5cbiAgZ2V0UmVwb3NpdG9yeVByb3ZpZGVyU2VydmljZTogLT5cbiAgICBuZXcgSGdSZXBvc2l0b3J5UHJvdmlkZXIoYXRvbS5wcm9qZWN0KVxuIl19
