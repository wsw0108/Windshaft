function TilesourceAdaptor(renderer, format, onTileErrorStrategy) {
    this.renderer = renderer;
    this.close = this.renderer.close.bind(this.renderer);
    this.get = function() { return renderer; };
    if ( format === 'png' || format === 'png32' ) {
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
    } else if ( format === 'grid.json' ) {
        this.getTile = function(z, res, xmin, ymin, callback) {
            renderer.getGrid(z, res, xmin, ymin, callback);
        };
    } else {
        throw new Error("Unsupported format " + format);
    }
    this.getMetadata = function(callback) {
        return callback(null, {});
    };
    this.getStats = function() {
        return {
            pool: {
                count: renderer._pool.getPoolSize(),
                unused: renderer._pool.availableObjectsCount(),
                waiting: renderer._pool.waitingClientsCount()
            },
            cache: Object.keys(renderer._tileCache.results).reduce(
                function(cacheStats, key) {
                    if (key.match(/^utf/)) {
                        cacheStats.grid += 1;
                    } else {
                        cacheStats.png += 1;
                    }
                    return cacheStats;
                },
                {
                    png: 0,
                    grid: 0
                }
            )
        };
    };
}

module.exports = TilesourceAdaptor;
