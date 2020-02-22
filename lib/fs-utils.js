const { join } = require('path');
const { stat } = require('fs');
const { promisify } = require('util');

const fsStat = promisify(stat);

exports.getExistingFileMap = async function __getExistingFileMap(fileMap, basePath) {
  const existingFiles = new Map();

  for (const path of fileMap.keys()) {
    try {
      await fsStat(join(basePath, path));

      const meta = fileMap.get(path);

      existingFiles.set(path, meta);
    } catch (e) {
      // Ignore error. It means that file just does not exists.
    }
  }

  return existingFiles;
}
