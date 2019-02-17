module.exports = {
  extend: 'apostrophe-widgets',
  label: 'Arguments form',
  addFields: [],
  construct: function(self, options) {
     var superPushAssets = self.pushAssets;
     self.pushAssets = function() {
       superPushAssets();
       self.pushAsset('stylesheet', 'main', { when: 'always' });
     };
  }
};