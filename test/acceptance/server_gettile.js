require('../support/test_helper');

var assert = require('../support/assert');
//var mapnik = require('mapnik');
//var semver = require('semver');
var TestClient = require('../support/test_client');
var SphericalMercator = require('sphericalmercator');
var sm = new SphericalMercator();

var queryFilter = {
    spatialFilter: {
        // RELATION_WITHIN
        relation: 5,
        geometry: {
            type: 'Polygon',
            coordinates: [
                [ [-120.0, 84.0], [120.0, 84.0], [120.0, -84.0], [-120.0, -84.0], [-120.0, 84.0] ]
            ]
        }
    },
    resultCrs: {
        type: 'cnCoordinateType',
        properties: {
            name: 'gcj02'
        }
    },
    resultFields: ['*'],
    returnGeometry: true
};

describe('server_gettile', function() {

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 25;

    function imageCompareFn(fixture, done) {
        return function(err, tile) {
            if (err) {
                return done(err);
            }
            assert.imageEqualsFile(tile, './test/fixtures/' + fixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        };
    }


    ////////////////////////////////////////////////////////////////////
    //
    // GET TILE
    // --{
    ////////////////////////////////////////////////////////////////////

    it("get'ing a tile with default style should return an expected tile", function(done) {
        var bbox = sm.bbox(4011, 3088, 13, false, '900913');
        var z = 13;
        var res = TestClient.mercatorResolutions[z];
        var xmin = bbox[0], ymin = bbox[1];
        new TestClient(TestClient.defaultTableMapConfig(JSON.stringify(queryFilter)))
            .getTile(z, res, xmin, ymin, imageCompareFn('test_table_13_4011_3088.png', done));
    });

    it("response of get tile can be served by renderer cache",  function(done) {
        var lastXwc;
        var bbox = sm.bbox(4011, 3088, 13, false, '900913');
        var z = 13;
        var res = TestClient.mercatorResolutions[z];
        var xmin = bbox[0], ymin = bbox[1];
        var testClient = new TestClient(TestClient.defaultTableMapConfig(JSON.stringify(queryFilter)));
        testClient.getTile(z, res, xmin, ymin, function(err, tile, img, headers) {
            var xwc = headers['X-Windshaft-Cache'];
            assert.ok(!xwc);

            testClient.getTile(z, res, xmin, ymin, function (err, tile, img, headers) {
                var xwc = headers['X-Windshaft-Cache'];
                assert.ok(xwc);
                assert.ok(xwc > 0);
                lastXwc = xwc;

                testClient.getTile(z, res, xmin, ymin, function (err, tile, img, headers) {
                    var xwc = headers['X-Windshaft-Cache'];
                    assert.ok(xwc);
                    assert.ok(xwc > 0);
                    assert.ok(xwc >= lastXwc);

                    testClient.getTile(z, res, xmin, ymin, {cache_buster: 'wadus'}, function (err, tile, img, headers) {
                        var xwc = headers['X-Windshaft-Cache'];
                        assert.ok(!xwc);

                        done();
                    });
                });
            });
        });
    });

    it("getting two tiles with same configuration uses renderer cache",  function(done) {

        var imageFixture = './test/fixtures/test_table_13_4011_3088_styled.png';
        var mapConfig = TestClient.defaultTableMapConfig(
            JSON.stringify(queryFilter),
            '#test_table{marker-fill: blue;marker-line-color: black;}'
        );

        var bbox = sm.bbox(4011, 3088, 13, false, '900913');
        var z = 13;
        var res = TestClient.mercatorResolutions[z];
        var xmin = bbox[0], ymin = bbox[1];

        var testClient = new TestClient(mapConfig);
        testClient.getTile(z, res, xmin, ymin, function(err, tile, img, headers) {
            assert.ok(!headers.hasOwnProperty('X-Windshaft-Cache'), "Did hit renderer cache on first time");

            testClient.getTile(z, res, xmin, ymin, function(err, tile, img, headers) {
                assert.ok(headers.hasOwnProperty('X-Windshaft-Cache'), "Did not hit renderer cache on second time");
                assert.ok(headers['X-Windshaft-Cache'] >= 0);

                assert.imageEqualsFile(tile, imageFixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
            });
        });
    });

    var test_style_black_200 = "#test_table{marker-fill:black;marker-line-color:black;marker-width:5}";
    var test_style_black_210 = "#test_table{marker-fill:black;marker-line-color:black;marker-width:10}";

    it("get'ing a tile with url specified 2.0.0 style should return an expected tile",  function(done) {
        var bbox = sm.bbox(4011, 3088, 13, false, '900913');
        var z = 13;
        var res = TestClient.mercatorResolutions[z];
        var xmin = bbox[0], ymin = bbox[1];

        new TestClient(TestClient.defaultTableMapConfig(JSON.stringify(queryFilter), test_style_black_200, '2.0.0'))
            .getTile(z, res, xmin, ymin, imageCompareFn('test_table_13_4011_3088_styled_black.png', done));
    });

    it("get'ing a tile with url specified 2.1.0 style should return an expected tile",  function(done) {
        var bbox = sm.bbox(4011, 3088, 13, false, '900913');
        var z = 13;
        var res = TestClient.mercatorResolutions[z];
        var xmin = bbox[0], ymin = bbox[1];

        new TestClient(TestClient.defaultTableMapConfig(JSON.stringify(queryFilter), test_style_black_210, '2.1.0'))
            .getTile(z, res, xmin, ymin, imageCompareFn('test_table_13_4011_3088_styled_black.png', done));
    });

    it('should fail for non-cartocss options', function(done) {
        var mapConfig = {
            "version": "1.4.0",
            "layers": [
                {
                    "type": 'maptalks',
                    "options": {
                        "cartocss_version": '2.3.0',
                        "query": JSON.stringify(queryFilter)
                    }
                }
            ]
        };

        new TestClient(mapConfig).createLayergroup(function(err) {
            assert.ok(err);
            assert.equal(err.message, 'Missing cartocss for layer 0 options');
            done();
        });
    });

});
