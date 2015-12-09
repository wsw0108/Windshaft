module.exports.name = 'development';
module.exports.maptalks = {
    srid: 4326
};
module.exports.millstone = {
    cache_basedir: '/tmp/windshaft-dev/millstone'
};
module.exports.redis = {
    host: '127.0.0.1',
    port: 6379,
    idleTimeoutMillis: 1,
    reapIntervalMillis: 1
};
module.exports.renderer = {
    mapnik: {
        poolSize: 4,//require('os').cpus().length,
        metatile: 1,
        bufferSize: 1,
        scale_factors: [1, 2],
        limits: {
            render: 0,
            cacheOnTimeout: true
        }
    }
};
module.exports.mapnik_version = undefined; // will be looked up at runtime if undefined
module.exports.windshaft_port = 8080;
module.exports.enable_cors = true;
