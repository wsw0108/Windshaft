var tilesource = require('tilesource');
var talkstore = require('talkstore');
var step = require('step');
var _ = require('underscore');
var assert = require('assert');

var MaptalksAdaptor = require('./adaptor');

require('tilesource-mapnik').registerProtocols(tilesource);

var DEFAULT_TILE_SIZE = 256;

function MaptalksFactory(options) {
    options.talkstore = options.talkstore || {};

    this.supportedFormats = {
        'png': true,
        'png32': true,
        'grid.json': true
    };

    this._mmlStore = new talkstore.MMLStore(options.talkstore);
    this._options = options;

    // Set default mapnik options
    this._mapnik_opts = _.defaults(options.mapnik || {}, {

        // Metatile is the number of tiles-per-side that are going
        // to be rendered at once. If all of them will be requested
        // we'd have saved time. If only one will be used, we'd have
        // wasted time.
        //
        // Defaults to 2 as of tilelive-mapnik@0.3.2
        //
        // We'll assume an average of a 4x4 viewport
        metatile: 1,

        // tilelive-mapnik uses an internal cache to store tiles/grids
        // generated when using metatile. This options allow to tune
        // the behaviour for that internal cache.
        metatileCache: {
            // Time an object must stay in the cache until is removed
            ttl: 0,
            // Whether an object must be removed after the first hit
            // Usually you want to use `true` here when ttl>0.
            deleteOnHit: false
        },

        // Override metatile behaviour depending on the format
        formatMetatile: {
            png: 1,
            'grid.json': 1
        },

        // Buffer size is the tickness in pixel of a buffer
        // around the rendered (meta?)tile.
        //
        // This is important for labels and other marker that overlap tile boundaries.
        // Setting to 128 ensures no render artifacts.
        // 64 may have artifacts but is faster.
        // Less important if we can turn metatiling on.
        //
        // defaults to 128 as of tilelive-mapnik@0.3.2
        //
        bufferSize: 64,

        // retina support, which scale factors are supported
        scale_factors: [1, 2],

        limits: {
            // Time in milliseconds a render request can take before it fails, some notes:
            //  - 0 means no render limit
            //  - it considers metatiling, it naive implementation: (render timeout) * (number of tiles in metatile)
            render: 0,
            // As the render request will finish even if timed out, whether it should be placed in the internal
            // cache or it should be fully discarded. When placed in the internal cache another attempt to retrieve
            // the same tile will result in an immediate response, however that will use a lot of more application
            // memory. If we want to enforce this behaviour we have to implement a cache eviction policy for the
            // internal cache.
            cacheOnTimeout: true
        }
    });

    this.tile_scale_factors = this._mapnik_opts.scale_factors.reduce(function(previousValue, currentValue) {
        previousValue[currentValue] = DEFAULT_TILE_SIZE * currentValue;
        return previousValue;
    }, {});
}

module.exports = MaptalksFactory;

MaptalksFactory.prototype.getName = function() {
    return 'maptalks';
};

MaptalksFactory.prototype.supportsFormat = function(format) {
    return !!this.supportedFormats[format];
};

MaptalksFactory.prototype.getAdaptor = function(renderer, format, onTileErrorStrategy) {
    return new MaptalksAdaptor(renderer, format, onTileErrorStrategy);
};

MaptalksFactory.prototype.getRenderer = function(mapConfig, format, options, callback) {
    var self = this;

    var params = options.params;
    var limits = _.defaults({}, options.limits, this._mapnik_opts.limits);

    params = _.defaults(params, this.mapConfigToMMLBuilderConfig(mapConfig));

    // fix layer index
    // see https://github.com/CartoDB/Windshaft/blob/0.43.0/lib/windshaft/backends/map_validator.js#L69-L81
    if (!!params.layer) {
        params.layer = this.getMaptalksLayer(mapConfig, params.layer);
    }

    var scaleFactor = _.isUndefined(params.scale_factor) ? 1 : +params.scale_factor,
        tileSize = this.tile_scale_factors[scaleFactor];

    if (!tileSize) {
        var err = new Error('Tile with specified resolution not found');
        err.http_status = 404;
        return callback(err);
    }

    step(
        function initBuilder() {
            var mmlBuilderOptions = {};
            if (format === 'png32') {
                mmlBuilderOptions.mapnik_tile_format = 'png';
            }

            self._mmlStore.mml_builder(params, mmlBuilderOptions).toXML(this);
        },
        function loadMapnik(err, xml) {
            assert.ifError(err);

            var metatile = self._mapnik_opts.metatile;
            if (Number.isFinite(self._mapnik_opts.formatMetatile[format])) {
                metatile = self._mapnik_opts.formatMetatile[format];
            }

            var query = {
                metatile: metatile,
                metatileCache: self._mapnik_opts.metatileCache,
                bufferSize: self._mapnik_opts.bufferSize,
                poolSize: self._mapnik_opts.poolSize,
                scale: scaleFactor,
                tileSize: tileSize,
                autoLoadFonts: false,
                internal_cache: false,
                limits: limits
            };

            // build full document to pass to tilesource
            var uri = {
                query: query,
                protocol: 'mapnik:',
                xml: xml,
                strict: !!params.strict
            };

            // hand off to tilesource to create a renderer
            tilesource.load(uri, this);
        },
        function returnCallback(err, source) {
            callback(err, source);
        }
    );
};

MaptalksFactory.prototype.getMaptalksLayer = function(mapConfig, mapConfigLayerIdx) {
    var maptalksLayerIndex = 0;
    var mapConfigToMaptalksLayers = {};

    mapConfig.getLayers().forEach(function(layer, layerIdx) {
        if (mapConfig.layerType(layerIdx) === 'maptalks') {
            mapConfigToMaptalksLayers[layerIdx] = maptalksLayerIndex++;
        }
    });

    return mapConfigToMaptalksLayers[mapConfigLayerIdx];
};

// jshint maxcomplexity:7
MaptalksFactory.prototype.mapConfigToMMLBuilderConfig = function(mapConfig) {
    var cfg = mapConfig.obj();
    var query = [];
    var style = [];
    var datasource_extend = [];
    var interactivity = [];
    var style_version = [];
    for ( var i=0; i<cfg.layers.length; ++i ) {

        if ( mapConfig.layerType(i) !== 'maptalks' ) {
            continue;
        }

        validateLayer(cfg.layers, i);

        var lyr = cfg.layers[i];

        var lyropt = lyr.options;

        style.push(lyropt.cartocss);
        style_version.push(lyropt.cartocss_version);

        var q = {
            dbname: lyropt.dbname,
            layer: lyropt.layer,
            filter: lyropt.filter
        };
        query.push(q);

        // NOTE: interactivity used to be a string as of version 1.0.0
        if ( _.isArray(lyropt.interactivity) ) {
            lyropt.interactivity = lyropt.interactivity.join(',');
        }
        interactivity.push(lyropt.interactivity);

        datasource_extend.push(mapConfig.getLayerDatasource(i));
    }
    if ( ! query.length ) {
        throw new Error("No 'maptalks' layers in MapConfig");
    }
    var opts = {
        query: query,
        style: style,
        style_version: style_version,
        interactivity: interactivity,
        ttl: 0,
        datasource_extend: datasource_extend
    };

    return opts;
};

function validateLayer(layers, layerIdx) {
    var layer = layers[layerIdx];

    var layerOptions = layer.options;

    if ( ! layerOptions.hasOwnProperty('cartocss') ) {
        throw new Error("Missing cartocss for layer " + layerIdx + " options");
    }
    if ( ! layerOptions.hasOwnProperty('cartocss_version') ) {
        throw new Error("Missing cartocss_version for layer " + layerIdx + " options");
    }
    if ( ! layerOptions.hasOwnProperty('layer') ) {
        throw new Error("Missing layer for layer " + layerIdx + " options");
    }
    if ( ! layerOptions.hasOwnProperty('filter') ) {
        throw new Error("Missing filter for layer " + layerIdx + " options");
    }
}
