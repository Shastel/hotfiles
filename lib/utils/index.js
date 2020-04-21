const { join } = require('path');

const latestVersion = require('latest-version');

const packageJsonPath = join(
  process.cwd(),
  'package.json',
);

const { version: installedVersion } = require(packageJsonPath);

function printVersionBanner (newestVersion) {
  console.log(
    `
A newer version of hotfiles (${newestVersion}) is available.
For update run:
npm update -g horfiles
    `
  )
}


exports.checkAvailableVersion = async function () {
  try {
    const newestVersion = await latestVersion('hotfiles');

    if (installedVersion !== newestVersion) {
      printVersionBanner(newestVersion);
    }

  } catch (e) {
    // ignore
  }
}
