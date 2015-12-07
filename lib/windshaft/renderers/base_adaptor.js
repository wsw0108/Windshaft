/**
 * Base adaptor
 * Wraps any renderer that does not require adapting its interface
 * @param {Object} renderer
 * @param {String} format
 * @param {Function} onTileErrorStrategy optional function that will be called in case of error when requesting a tile
 * @constructor
 */
function BaseAdaptor(renderer, format, onTileErrorStrategy) {
    this.renderer = renderer;
    if (onTileErrorStrategy) {
        this.getTile = function(z, res, xmin, ymin, callback) {
            renderer.getTile(z, res, xmin, ymin, function(err, tile, headers, stats) {
                if (err) {
                    return onTileErrorStrategy(err, tile, headers, stats, format, callback);
                } else {
                    return callback(err, tile, headers, stats);
                }
            });
        };
    } else {
        this.getTile = function(z, res, xmin, ymin, callback) {
            renderer.getTile(z, res, xmin, ymin, callback);
        };
    }
    this.getMetadata = !!this.renderer.getMetadata ?
        this.renderer.getMetadata.bind(this.renderer) :
        function(callback) {
            return callback(null, {});
        };
    this.get = function() {
        return renderer;
    };
    this.close = function(callback) {
        if (renderer.close) {
            renderer.close(callback);
        }
    };
    this.getStats = function() {
        return (renderer.getStats && renderer.getStats()) || {
            pool: {
                count: 0,
                unused: 0,
                waiting: 0
            },
            cache: {
                png: 0,
                grid: 0
            }
        };
    };
}

module.exports = BaseAdaptor;
