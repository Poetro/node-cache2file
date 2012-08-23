[![build status](https://secure.travis-ci.org/Poetro/node-cache2file.png)](http://travis-ci.org/Poetro/node-cache2file)
#Cache to File module for Node.js

It stores cache data in files that can expire. Stored data can be in any format
`Buffer` supports (`utf8` [default], `ascii`, `binary`).

#Install

    npm install cache2file

#Usage

    var Cache2File = require('cache2file'),
        // Path to store the cache files
        cachePath = './cache',
        // Timeout in milliseconds
        timeout = 60000,
        // Generate a new cache
        cache = new Cache2File(cachePath, timeout);

    cache.set('cacheKey', doIntensiveStuff());

    // ... some time later
    cache.get('cacheKey', function (err, data) {
      if (!err) {
        // We have the data, do whatever we want.
      }
      else {
        // Cache timed out, or removed, so store it again.
        data = doIntensiveStuff();
        cache.set('cacheKey', data);
      }

      processData(data);
    });

    // Remove cached data.
    cache.remove('cacheKey');

Cache2File uses it's own function `Cache2File.generateKey` to generate a hash
for the filename to store data in. It can be replaced with your own filename
generating algorithm if you wish. Hashing was generally required to only have
ascii characters in filenames and no `/` characters, as there is no restriction
for the characters in the `key`.

`key`'s string value should be less then 200 characters so the filesystem can
handle the filename.

To remove multiple cache files, use
    cache.removeAll(callback, keyCached, expired)

Where if `keyCached` is set to `true`, remove those whose key was touched in the
lifetime of the cache object. If it is `false` (default) all cache files in the
cache directory will be removed (those that has the extension `.cache`).<br>
If `expired` is set to `true` (default is `false`) it will only remove expired
cache files.<br>
These filters can be combined.

## TODO
Handle cache read / write concurrency.