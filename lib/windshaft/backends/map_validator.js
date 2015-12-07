var queue = require('queue-async');
var _ = require('underscore');

var MapConfigProviderProxy = require('../models/providers/mapconfig_provider_proxy');

/**
 * @param {TileBackend} tileBackend
 * @constructor
 * @type {MapValidatorBackend}
 */
function MapValidatorBackend(tileBackend) {
    this.tileBackend = tileBackend;
}

module.exports = MapValidatorBackend;

MapValidatorBackend.prototype.validate = function(mapConfigProvider, callback) {

    var self = this;

    mapConfigProvider.getMapConfig(function(err, mapConfig, params) {
        if (err) {
            return callback(err, false);
        }

        var token = mapConfig.id();

        var validateFnList = [];

        function validateMapnikTile() {
            return function(done) {
                self.tryFetchTileOrGrid(mapConfigProvider, _.clone(params), token, 'png', undefined, done);
            };
        }

        function validateMapnikGridJson(layerId) {
            return function(done) {
                self.tryFetchTileOrGrid(mapConfigProvider, _.clone(params), token, 'grid.json', layerId, done);
            };
        }

        var hasMapnikLayers = false;

        mapConfig.getLayers().forEach(function(layer, layerId) {

            var lyropt = layer.options;

            var layerType = mapConfig.layerType(layerId);

            if (layerType === 'maptalks') {

                if (!hasMapnikLayers) {
                    validateFnList.push(validateMapnikTile());
                    hasMapnikLayers = true;
                }

                if ( lyropt.interactivity ) {
                    validateFnList.push(validateMapnikGridJson(layerId));
                }
            }
        });

        var validationQueue = queue(validateFnList.length);

        validateFnList.forEach(function(validateFn) {
            validationQueue.defer(validateFn);
        });

        function validationQueueFinish(err) {
            return callback(err, !err);
        }

        validationQueue.awaitAll(validationQueueFinish);
    });
};

MapValidatorBackend.prototype.tryFetchTileOrGrid = function (mapConfigProvider, params, token, format, layerId,
                                                             callback) {
    params.token = token;
    params.format = format;
    params.layer = layerId;
    // XXX: values to pass
    params.z = 30;
    params.res = 1;
    params.xmin = 0;
    params.ymin = 0;

    this.tileBackend.getTile(new MapConfigProviderProxy(mapConfigProvider, params), params, callback);
};
