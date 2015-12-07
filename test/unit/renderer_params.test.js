require('../support/test_helper');

var assert = require('assert');
var MapStoreProvider = require('../../lib/windshaft/models/providers/mapstore_mapconfig_provider');
var _ = require('underscore');

describe('renderer_params', function() {

    var SUITE_COMMON_PARAMS = {
        token: 'test_token',
        res: 1,
        xmin: 4,
        ymin: 4,
        z: 4,
        format: 'png'
    };

    it('can create a unique key from request, stripping [z, res, xmin, ymin]/callback', function(){
        var params = _.extend({}, SUITE_COMMON_PARAMS);

        assert.equal(MapStoreProvider.createKey(params), 'test_token:png::1');
    });

    it('cache key includes layer', function(){
        var params = _.extend({}, SUITE_COMMON_PARAMS, { layer: 1 });

        assert.equal(MapStoreProvider.createKey(params), 'test_token:png:1:1');
    });

    it('cache key includes scale_factor', function(){
        var params = _.extend({}, SUITE_COMMON_PARAMS, { scale_factor: 2 });

        assert.equal(MapStoreProvider.createKey(params), 'test_token:png::2');
    });

});
