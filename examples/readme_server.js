// Note, currently to run this server your table must have a column called the_geom_webmercator with SRID of 3857
// to view the tiles, open ./viewer/index.html and set the fields
//
// If you want to get something running quickly, follow the instructions for a seed DB in test/windshaft.test.sql

var Server = require('./http/server');
var _         = require('underscore');

// Force 'development' environment
var ENV = 'development';
var PORT = 4000;

// set environment specific variables
global.settings     = require('../config/settings');
global.environment  = require('../config/environments/' + ENV);
_.extend(global.settings, global.environment);

var config = {
    base_url: '/database/:dbname/table/:table',
    base_url_mapconfig: '/database/:dbname/layergroup',
    redis: {host: '127.0.0.1', port: 6379},
    enable_cors: true,
    req2params: function(req, callback){

        // no default interactivity. to enable specify the database column you'd like to interact with
        req.params.interactivity = null;

        // this is in case you want to test sql parameters eg ...png?sql=select * from my_table limit 10
        req.params =  _.extend({}, req.params);
        _.extend(req.params, req.query);

        // send the finished req object on
        callback(null,req);
    }
};

// Initialize tile server
var server = new Server(config);
server.listen(PORT, function() {
    console.log("map tiles are now being served out of: http://localhost:" + PORT + config.base_url_mapconfig);
});
