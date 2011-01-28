var assert = require('assert'),
    Funk = require('funk'),
    C2F = require('../lib/cache2file');

function generateNum(max, min) {
  min = min || 0;
  max -= min;
  return Math.floor(Math.random() * max) + min;
}

function generateString(length) {
  var output = [], i;
  for (i = length; i > 0; i -= 1) {
    output[output.length] = generateNum(120, 32);
  }
  return String.fromCharCode.apply(String, output);
}

(function () {
  var data = {}, i,
      c2f = new C2F('cache'),
      key, val,
      setFunk = new Funk;

  for (i = 100; i > 0; i -= 1) {
    key = generateString(generateNum(100, 10));
    val = generateString(generateNum(1e4, 10));
    data[key] = val;
    c2f.set(key, val, setFunk.result('error' + i, 0));
  }
  setFunk.parallel(function () {
    var errors, getFunk = new Funk;

    errors = Object.keys(this).filter(function (value) {
      return !value;
    });

    Object.keys(data).forEach(function (key) {
      var val = this[key];
      c2f.get(key, getFunk.result(key));
    }, data);

    getFunk.parallel(function () {
      Object.keys(this).forEach(function (key) {
        var val = this[key];
        assert.notEqual(typeof data[key], 'undefined', 'Key does not exist in stored values');
        assert.strictEqual(val.toString(), data[key], 'The stored value is not the same as the retrieved');
      }, this);

      c2f.removeAll(function (err) {
        assert.strictEqual(err, null, 'Failed to delete some cache files');
      }, false, false);
    });

    assert.strictEqual(errors.length, 0, "Cache set errors happened");

  });

}());