const updateNotifier = require('update-notifier');
const pkg = require('../package.json');

const notifier = updateNotifier({ pkg });

exports.printUpdates = function printUpdates () {
  notifier.notify();
}
