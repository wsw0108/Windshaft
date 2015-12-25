var os = require('os');
var path = require('path');
var _ = require('underscore');

var development = require('./development');
var test = _.extend(development, {
    name: 'test',
    millstone: {
        cache_basedir: path.join(os.tmpdir(), 'windshaft-test', 'millstone')
    },
    redis: _.extend(development.redis, {
        port: 6379 // 6379 is the default, 6333 is used by grainstore
    }),
    windshaft_port: 8083
});

module.exports = test;
