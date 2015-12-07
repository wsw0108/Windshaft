var _ = require('underscore');

function MapStoreMapConfigProvider(mapStore, params) {
    this.mapStore = mapStore;
    this.params = params;
    this.token = params.token;
    this.cacheBuster = params.cache_buster || 0;
}

module.exports = MapStoreMapConfigProvider;

MapStoreMapConfigProvider.prototype.getMapConfig = function(callback) {
    var self = this;
    this.mapStore.load(this.token, function(err, mapConfig) {
        return callback(err, mapConfig, self.params, {});
    });
};

MapStoreMapConfigProvider.prototype.getKey = function() {
    return createKey(this.params);
};

MapStoreMapConfigProvider.prototype.getCacheBuster = function() {
    return this.cacheBuster;
};

MapStoreMapConfigProvider.prototype.filter = function(key) {
    var regex = new RegExp('^' + createKey(this.params, true) + '.*');
    return key && key.match(regex);
};

// Configure bases for cache keys suitable for string interpolation
var baseKey   = '<%= token %>';
var renderKey = baseKey + ':<%= format %>:<%= layer %>:<%= scale_factor %>';
// Create a string ID/key from a set of params
function createKey(params, base) {
    return _.template(base ? baseKey : renderKey, _.defaults({}, params, {
        token: '',
        format: '',
        layer: '',
        scale_factor: 1
    }));
}

module.exports.createKey = createKey;
