var assert = require('assert');

var step = require('step');
var debug = require('debug')('windshaft:backend:map');

var Timer = require('../stats/timer');

/**
 * @param {RendererCache} rendererCache
 * @param {MapStore} mapStore
 * @param {MapValidatorBackend} mapValidatorBackend
 * @constructor
 */
function MapBackend(rendererCache, mapStore, mapValidatorBackend) {
    this._rendererCache = rendererCache;
    this._mapStore = mapStore;
    this._mapValidatorBackend = mapValidatorBackend;
}

module.exports = MapBackend;

MapBackend.prototype.createLayergroup = function(mapConfig, params, validatorMapConfigProvider, callback) {
    var self = this;

    var timer = new Timer();
    timer.start('createLayergroup');

    var response = {};

    step(
        function initLayergroup() {
            timer.start('mapSave');
            // will save only if successful
            self._mapStore.save(mapConfig, this);
        },
        function handleMapConfigSave(err, mapConfigId, known) {
            timer.end('mapSave');

            assert.ifError(err);

            response.layergroupid = mapConfig.id();

            if (known) {
                return true;
            } else {
                var next = this;
                timer.start('validate');
                self._mapValidatorBackend.validate(validatorMapConfigProvider, function(err, isValid) {
                    timer.end('validate');
                    if (isValid) {
                        return next(err);
                    }
                    self._mapStore.del(mapConfig.id(), function(delErr) {
                        if (delErr) {
                            debug("Failed to delete MapConfig '" + mapConfig.id() + "' after: " + err);
                        }
                        return next(err);
                    });
                });
            }
        },
        function fetchLayersMetadata(err) {
            assert.ifError(err);

            var next = this;

            getLayersMetadata(self._rendererCache, params, mapConfig, function(err, layersMetadata) {
                if (err) {
                    self._mapStore.del(mapConfig.id(), function(delErr) {
                        if (delErr) {
                            debug("Failed to delete MapConfig '" + mapConfig.id() + " after: " + err);
                        }
                        return next(err);
                    });
                } else {
                    if (layersMetadata) {
                        response.metadata = response.metadata || {};
                        response.metadata.layers = layersMetadata;
                    }
                    return next();
                }
            });
        },
        function finish(err) {
            timer.end('createLayergroup');
            callback(err, response, timer.getTimes());
        }
    );
};

function getLayersMetadata(rendererCache, params, mapConfig, callback) {
    var metadata = [];

    mapConfig.getLayers().forEach(function(layer, layerId) {
        var layerType = mapConfig.layerType(layerId);
        metadata[layerId] = {
            type: layerType,
            meta: {}
        };
    });

    callback(null, metadata);
}
