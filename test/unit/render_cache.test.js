require('../support/test_helper.js');

var _ = require('underscore');
var assert = require('assert');
var RendererCache = require('../../lib/windshaft/cache/renderer_cache');
var MapStore = require('../../lib/windshaft/storages/mapstore');
var MapConfig = require('../../lib/windshaft/models/mapconfig');
var MapStoreMapConfigProvider = require('../../lib/windshaft/models/providers/mapstore_mapconfig_provider');
var RendererFactory = require('../../lib/windshaft/renderers/renderer_factory');
var RedisPool = require('redis-mpool');
var serverOptions = require('../support/server_options');

describe('render_cache', function() {

    var redisPool = new RedisPool(serverOptions.redis);

    var rendererFactory = new RendererFactory({
        maptalks: {
            talkstore: serverOptions.talkstore
        }
    });

    var queryFilter = {
        spatialFilter: {
            // RELATION_CONTAIN
            relation: 1,
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [ [-120.0, 84.0], [120.0, 84.0], [120.0, -84.0], [-120.0, -84.0], [-120.0, 84.0] ]
                ]
            }
        },
        resultCrs: {
            type: 'cnCoordinateType',
            properties: {
                name: 'gcj02'
            }
        },
        resultFields: ['*'],
        returnGeometry: true
    };

    var mapConfig = MapConfig.create({
        layers: [
            {
                type: 'maptalks',
                options: {
                    dbname: "testdb",
                    layer: 'ne_10m_admin_0_countries',
                    filter: JSON.stringify(queryFilter),
                    page_num: 0,
                    page_size: 10,
                    cartocss: '#layer { }',
                    cartocss_version: '2.3.0'
                }
            }
        ]
    });

    var mapConfig2 = MapConfig.create({
        layers: [
            {
                type: 'maptalks',
                options: {
                    dbname: "testdb",
                    layer: 'ne_10m_admin_0_countries',
                    filter: JSON.stringify(queryFilter),
                    page_num: 1,
                    page_size: 10,
                    cartocss: '#layer { }',
                    cartocss_version: '2.3.0'
                }
            }
        ]
    });

    var mapStore = new MapStore({pool: redisPool});

    function requestParams(params) {
        return _.extend({
            dbname: "testdb-not-used",
            token: mapConfig.id(),
            format: 'png',
            layer: undefined,
            scale_factor: 1
        }, params);
    }

    function createMapConfigProvider(extendParams) {
        return new MapStoreMapConfigProvider(mapStore, requestParams(extendParams));
    }

    function makeRenderCache(opts) {
        opts = opts || { timeout: 10000 };
        return new RendererCache(rendererFactory, opts);
    }


    beforeEach(function(done) {
        mapStore.save(mapConfig, function(err) {
            if (err) {
                return done(err);
            }
            mapStore.save(mapConfig2, done);
        });
    });

    afterEach(function(done) {
        mapStore.del(mapConfig.id(), function() {
            mapStore.del(mapConfig2.id(), function() {
                done();
            });
        });
    });

    it('has a cache of render objects', function(){
        var render_cache = makeRenderCache();
        assert.ok(_.isObject(render_cache.renderers));
    });

    /**
     * THE FOLLOWING TESTS NEED SOME DB SETUP
     * They need a database setup as below with the table test_table defined
     */

    it('can generate a tilelive object', function(done){
        var render_cache = makeRenderCache();

        render_cache.getRenderer(createMapConfigProvider(), function(err, renderer){
            assert.ok(renderer, err);
            assert.ok(renderer.get(), err);
            assert.equal(renderer.get()._uri.protocol, 'mapnik:');
            done();
        });
    });


    it('can generate > 1 tilelive object', function(done){
        var render_cache = makeRenderCache();

        render_cache.getRenderer(createMapConfigProvider(), function(err, renderer){
            assert.ok(renderer, err);
            render_cache.getRenderer(createMapConfigProvider({ token: mapConfig2.id() }), function(/*err, renderer2*/) {
                assert.equal(_.keys(render_cache.renderers).length, 2);
                done();
            });
        });
    });


    it('can reuse tilelive object', function(done){
        var render_cache = makeRenderCache();

        var provider = createMapConfigProvider();
        render_cache.getRenderer(provider, function(err, renderer){
            assert.ok(renderer, err);
            render_cache.getRenderer(provider, function(/*err, renderer*/) {
                assert.equal(_.keys(render_cache.renderers).length, 1);
                done();
            });
        });
    });

    it('can delete all tilelive objects when reset', function(done){
        var render_cache = makeRenderCache();

        var provider = createMapConfigProvider();
        render_cache.getRenderer(provider, function(err, renderer){
            assert.ok(renderer, err);
            assert.equal(_.keys(render_cache.renderers).length, 1);
            render_cache.getRenderer(createMapConfigProvider({ scale_factor: 2}), function(/*err, renderer*/) {
                assert.equal(_.keys(render_cache.renderers).length, 2);
                render_cache.reset(provider);
                assert.equal(_.keys(render_cache.renderers).length, 0);
                done();
            });
        });
    });


    it('can delete only related tilelive objects when reset', function(done){
        var render_cache = makeRenderCache();

        var provider = createMapConfigProvider();
        render_cache.getRenderer(provider, function(err, renderer){
            assert.ok(renderer, err);
            provider = createMapConfigProvider({ scale_factor: 2 });
            render_cache.getRenderer(provider, function(/*err, renderer*/) {
                provider = createMapConfigProvider({ token: mapConfig2.id() });
                render_cache.getRenderer(provider, function(/*err, renderer*/) {
                    assert.equal(_.keys(render_cache.renderers).length, 3);

                    provider = createMapConfigProvider({ token: mapConfig.id() });
                    render_cache.reset(provider);

                    assert.equal(_.keys(render_cache.renderers).length, 1);

                    done();
                });
            });
        });
    });

    it('can purge all tilelive objects', function(done){
        var render_cache = makeRenderCache();

        var provider = createMapConfigProvider();
        render_cache.getRenderer(provider, function(err, renderer){
            assert.ok(renderer, err);
            provider = createMapConfigProvider({scale_factor: 2});

            render_cache.getRenderer(provider, function(/*err, renderer*/) {
                provider = createMapConfigProvider({ token: mapConfig2.id() });

                render_cache.getRenderer(provider, function(/*err, renderer*/) {
                    assert.equal(_.keys(render_cache.renderers).length, 3);

                    render_cache.purge();

                    assert.equal(_.keys(render_cache.renderers).length, 0);

                    done();
                });
            });
        });
    });

    it('automatically deletes tilelive only after timeout', function(done){
        var render_cache = makeRenderCache({timeout: 100});

        var provider = createMapConfigProvider();
        render_cache.getRenderer(provider, function(err, renderer){
            assert.ok(renderer, err);
            assert.equal(_.keys(render_cache.renderers).length, 1);

            setTimeout(function() {
                assert.equal(_.keys(render_cache.renderers).length, 0);
                done();
            },200);
        });
    });

    // Remove from cache renderers erroing out
    // See https://github.com/CartoDB/Windshaft/issues/171
    it('does not keep erroring renderers in cache', function(done){
        var render_cache = makeRenderCache();
        assert.equal(_.keys(render_cache.renderers).length, 0);
        var provider = createMapConfigProvider({ token: 'nonexistant' });
        render_cache.getRenderer(provider, function(err/*, renderer*/) {
            assert.ok(err);
            // Need next tick as the renderer is removed from
            // the cache after the callback is invoked
            setTimeout(function() {
              err = null;
              try {
                assert.equal(_.keys(render_cache.renderers).length, 0);
              }
              catch (e) { err = e; }
              done(err);
            }, 0);
        });
    });

    it('does not keep renderers in cache for unexistent tokes', function(done) {
        var renderCache = makeRenderCache();
        assert.equal(Object.keys(renderCache.renderers).length, 0);
        var provider = createMapConfigProvider({ token: "wadus" });
        renderCache.getRenderer(provider, function(err/*, renderer*/) {
            assert.ok(err);
            assert.equal(Object.keys(renderCache.renderers).length, 0);
            done();
        });
    });

});
