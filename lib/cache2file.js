var fs = require('fs'),
    path = require('path'),
    Funk = require('funk');

/**
 * @constructor
 * Manage key - value caching into files.
 *
 * @param {String} path
 *   Path to the cache directory.
 * @param {Number} timeout
 *   Timeout of cache in milliseconds.
 */
function Cache2File(path, timeout) {
  // Only allow calling as a constructor.
  if (!(this instanceof Cache2File)) return new Cache2File(path, timeout);
  this.path = path || './cache';
  this.timeout = timeout || 6e5;
  this.keyCache = {};
}

/**
 * Function placeholder.
 */
function noop() {}

/**
 * Remove the files specified cache files.
 *
 * If `expired` is true, only the expired cache files will be unlinked.
 *
 * @param {Array} files
 *   List of files to delete.
 * @param {Boolean} expired
 *   Only delete the files, if it has expired.
 * @param {Function} callback
 *   The callback function will be called, when all files are processed.
 *   It will be called with passing in an object keyed by the file's name,
 *   if any errors occured, or null otherwise.
 */
function removeFiles(files, expired, callback, timeout) {
  var funk = new Funk;
  if (expired) {
    funk.set('files', []);
  }
  else {
    funk.set('errors', {});
  }

  // Go through the files.
  files.forEach(function (cacheFile) {
    if (expired) {
      // Need to check for expired files.
      fs.stat(cacheFile, funk.add(function (err, stats) {
        if (!err && Date.now() - Date.parse(stats.ctime) > timeout) {
          this.files.push(cacheFile);
        }
      }));
    }
    else {
      // Remove all the files, and keep track of the errors.
      fs.unlink(cacheFile, funk.add(function (err) {
        if (err) {
          this.errors[cacheFile] = err;
        }
      }));
    }
  });

  // Run the callbacks parallel
  funk.parallel(function () {
    if (expired) {
      // There is a list of files, that are expired delete them.
      removeFiles(this.files, false, callback, timeout);
    }
    else {
      // Deletion completed, call the callback passing the errors.
      callback(Object.keys(this.errors).length ? this.errors : null);
    }
  });
}

/**
 * Generate a hash from the key that will serve as the base for the generated file.
 *
 * @param {String} key
 *   The key to generate hash for.
 * @returns {String}
 *   Hashed value.
 */
Cache2File.generateKey = function (key) {
  return (new Buffer(key.toString())).toString('base64')
            .slice(0, -2).replace(/\+/g, '-').replace(/\//g, '_');
};

Cache2File.prototype = {
  /**
   * Generate a hash key / return one from the already generated key cache, if exists.
   *
   * @param {String} key
   *   The key to generate the hash for.
   * @returns {String}
   *   Hashed value of string. @see Cache2File.generateKey().
   */
  generateKey: function (key) {
    if (!(key in this.keyCache)) {
      this.keyCache[key] = Cache2File.generateKey(key);
    }

    return this.keyCache[key];
  },

  /**
   * Get a value for the specified key.
   *
   * @param {String} key
   *   The key for the value to fetch.
   * @param {Function} callback
   *   The function to call with the fetched data with.
   *   The callback has 2 arguments: `err`, `data`,
   *   where `data` is the content if no errors occured and the cache hasn't expired.
   * @param {String} [encoding]
   *   The encoding to fetch the information in is optional.
   */
  get: function (key, callback, encoding_) {
    var encoding = typeof encoding_ === 'string' ? encoding_ : null,
        cacheFile = path.join(this.path, this.generateKey(key) + '.cache'),
        timeout = this.timeout;

    callback = (typeof callback === 'function' ? callback : noop);

    // Check for file cache
    fs.stat(cacheFile, function (err, stats) {
      var date, expired = true;
      if (!err) {
        // File exists, check if it expired
        if (Date.now() - Date.parse(stats.ctime) < timeout) {
          expired = false;
        }
      }

      if (expired) {
        // File has expired call it with error.
        callback(true, null);
      } else {
        // Load the cache file...
        fs.readFile(cacheFile, encoding, function (err, data) {
          callback(err, data && data.toString());
        });
      }
    });
  },

  /**
   * Get a value for the specified key.
   *
   * @param {String} key
   *   The key for the value to fetch.
   * @param {String|Buffer} data
   *   Data to write to the cache.
   * @param {String} [encoding]
   *   The encoding to fetch the information in is optional.
   * @param {Function} [callback]
   *   The function to call with when the setting finished is optional.
   *   The callback has an `err` argument and stores the errors if any occured.
   */
  set: function (key, data, encoding_, callback) {
    var encoding = typeof encoding_ === 'string' ? encoding_ : null,
        cacheFile = path.join(this.path, this.generateKey(key) + '.cache');

    if (typeof data !== 'string' && !(data instanceof Buffer)) {
      data = data.toString();
    }


    callback = arguments[arguments.length - 1];
    callback = (typeof callback === 'function' ? callback : noop);

    fs.writeFile(cacheFile, data, encoding, callback);
  },

  /**
   * Remove a cache file.
   *
   * @param {String} key
   *   The key to remove the cache for.
   * @param {Function} callback
   *   The callback will be called after the file is unlinked
   *   passing the error if present. @see fs.unlink()
   */
  remove: function (key, callback) {
    var cacheFile = path.join(this.path, this.generateKey(key) + '.cache');

    callback = (typeof callback === 'function' ? callback : noop);

    fs.unlink(cacheFile, callback);
  },

  /**
   * Remove all (or a subset of) cache files.
   *
   * The parameters `keyCached` and `expired` can be combined in any ways,
   * they filter the set of removed files.
   *
   * @param {Function} [callback]
   *   The callback function will be called, when all files are processed.
   *   It will be called with passing in an object keyed by the file's name,
   *   if any errors occured, or null otherwise.
   * @param {Boolean} [keyCached]
   *   Only remove the files, whose key is already cached
   *   (aka used in this Cache2File object already). Optional, default is false.
   * @param {Boolean} [expired]
   *   Only remove those that files are already expired. Optional, default is false.
   */
  removeAll: function (callback, keyCached, expired) {
    var timeout = this.timeout,
        cache = this;
    callback = (typeof callback === 'function' ? callback : noop);

    if (keyCached) {
      removeFiles(Object.keys(this.keyCache).map(function (key) {
        return this[key];
      }, this.keyCache), expired, callback, timeout);
    }
    else {
      fs.readdir(this.path, function (err, files) {
        var fileTest;
        if (!err) {
          fileTest = /\.cache$/;
          removeFiles(
            files.filter(function (file) {
              return fileTest.test(file);
            }).map(function (file) {
              return path.join(cache.path, file);
            }),
            expired,
            callback,
            timeout);
        }
        else {
          callback([err]);
        }
      });
    }
  }
};

module.exports = Cache2File;