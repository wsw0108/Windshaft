var _ = require('underscore');
var mapnik = require('mapnik');
var RedisPool = require('redis-mpool');

var windshaft = require('../../lib/windshaft');
var DummyMapConfigProvider = require('../../lib/windshaft/models/providers/dummy_mapconfig_provider');

var redisClient = require('redis').createClient(global.environment.redis.port);

mapnik.register_system_fonts();
mapnik.register_default_fonts();
var cartoEnv = {
    validation_data: {
        fonts: _.keys(mapnik.fontFiles())
    }
};

var rendererOptions = global.environment.renderer;
var talkstoreOptions = {
    carto_env: cartoEnv,
    datasource: global.environment.maptalks,
    cachedir: global.environment.millstone.cache_basedir,
    mapnik_version: global.environment.mapnik_version || mapnik.versions.mapnik
};
var rendererFactoryOptions = {
    maptalks: {
        talkstore: talkstoreOptions,
        mapnik: rendererOptions.mapnik
    }
};

function TestClient(mapConfig, overrideOptions, onTileErrorStrategy) {
    var options = _.extend({}, rendererFactoryOptions);
    overrideOptions = overrideOptions || {};
    _.each(overrideOptions, function(overrideConfig, key) {
        options[key] = _.extend({}, options[key], overrideConfig);
    });

    if (onTileErrorStrategy) {
        options.onTileErrorStrategy = onTileErrorStrategy;
    }

    this.config = windshaft.model.MapConfig.create(mapConfig);

    this.rendererFactory = new windshaft.renderer.Factory(options);
    this.rendererCache = new windshaft.cache.RendererCache(this.rendererFactory);

    this.tileBackend = new windshaft.backend.Tile(this.rendererCache);

    var mapValidatorBackend = new windshaft.backend.MapValidator(this.tileBackend);
    var mapStore = new windshaft.storage.MapStore({
        pool: new RedisPool(global.settings.redis)
    });
    this.mapBackend = new windshaft.backend.Map(this.rendererCache, mapStore, mapValidatorBackend);
}

module.exports = TestClient;

TestClient.prototype.getTile = function(z, res, xmin, ymin, options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    var params = _.extend({
        dbname: 'testdb-not-used',
        layer: 'all',
        format: 'png',
        z: z,
        res: res,
        xmin: xmin,
        ymin: ymin
    }, options);

    var provider = new DummyMapConfigProvider(this.config, params);
    this.tileBackend.getTile(provider, params, function(err, tile, headers, stats) {
        var img;
        if (!err && tile && params.format === 'png') {
            img = mapnik.Image.fromBytesSync(new Buffer(tile, 'binary'));
        }
        return callback(err, tile, img, headers, stats);
    });
};

TestClient.prototype.createLayergroup = function(options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    var params = _.extend({
        dbname: 'testdb-not-used'
    }, options);

    var validatorProvider = new DummyMapConfigProvider(this.config, params);
    this.mapBackend.createLayergroup(this.config, params, validatorProvider, function(err, layergroup) {
        if (layergroup) {
            var redisKey = 'map_cfg|' + layergroup.layergroupid;
            redisClient.del(redisKey, function () {
                return callback(err, layergroup);
            });
        } else {
            return callback(err);
        }
    });
};


var DEFAULT_POLYGON_STYLE = [
    '#layer {',
    '  polygon-fill: #0000FF;',
    '  [name="Korea"] { polygon-fill: #00FF00; }',
    '  line-color: #FF0000;',
    '}'
].join('');

function singleLayerMapConfig(filter, cartocss, cartocssVersion, interactivity) {
    return {
        version: '1.3.0',
        layers: [
            {
                type: 'maptalks',
                options: {
                    engine_home: '/home/wsw/repos/profile-node-java',
                    dbname: 'testdb',
                    layer: 'ne_10m_admin_0_countries',
                    filter: filter,
                    page_num: 0,
                    page_size: 10,
                    cartocss: cartocss || DEFAULT_POLYGON_STYLE,
                    cartocss_version: cartocssVersion || '2.3.0',
                    interactivity: interactivity
                }
            }
        ]
    };
}

function defaultTableMapConfig(filter, cartocss, cartocssVersion, interactivity) {
    return singleLayerMapConfig(filter, cartocss, cartocssVersion, interactivity);
}

module.exports.singleLayerMapConfig = singleLayerMapConfig;
module.exports.defaultTableMapConfig = defaultTableMapConfig;

module.exports.talkstoreOptions = talkstoreOptions;
module.exports.mapnikOptions = rendererOptions.mapnik;

var resolutions = [
    156543.0339,
    78271.51695,
    39135.758475,
    19567.8792375,
    9783.93961875,
    4891.969809375,
    2445.9849046875,
    1222.99245234375,
    611.496226171875,
    305.7481130859375,
    152.87405654296876,
    76.43702827148438,
    38.21851413574219,
    19.109257067871095,
    9.554628533935547,
    4.777314266967774,
    2.388657133483887,
    1.1943285667419434,
    0.5971642833709717
];

module.exports.mercatorResolutions = resolutions;
