var version = require('../../package.json').version;
var talkstore = require('talkstore');
var mapnik = require('mapnik');
var tilelive = require('tilelive');

module.exports = {
    tilelive: tilelive,
    talkstore: talkstore,
    mapnik: mapnik,
    model: {
        Datasource: require('./models/datasource'),
        MapConfig: require('./models/mapconfig'),
        provider: {
            MapStoreMapConfig: require('./models/providers/mapstore_mapconfig_provider')
        }
    },
    storage: {
        MapStore: require('./storages/mapstore')
    },
    cache: {
        RendererCache: require('./cache/renderer_cache')
    },
    renderer: {
        Factory: require('./renderers/renderer_factory')
    },
    backend: {
        Map: require('./backends/map'),
        MapValidator: require('./backends/map_validator'),
        Preview: require('./backends/preview'),
        Tile: require('./backends/tile')
    },
    version: version,
    versions: {
        windshaft: version,
        talkstore: talkstore.version(),
        node_mapnik: mapnik.version,
        mapnik: mapnik.versions.mapnik
    }
};
