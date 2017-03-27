'use strict';

var fs = require('fs');
var path = require('path');
var test = require('tape').test;

var Decorator = require('../');

var buf = fs.readFileSync(path.join(__dirname, 'fixtures/test.pbf'));
var buf2 = fs.readFileSync(path.join(__dirname, 'fixtures/streets.pbf'));
var decorated = fs.readFileSync(path.join(__dirname, 'fixtures/test-decorated.pbf'));

// Looks up for a feature's attribute
// See: mapbox/vector-tile-spec/tree/master/2.1#44-feature-attributes
function getAttribute(layer, feature, attribute) {
    // Check if attribute exists in layer
    var attributeKeyIndex = layer.keys.indexOf(attribute);
    if (attributeKeyIndex === -1) return null;

    // Scan feature's tags to find a matching key and return its value
    for (var i = 0, j = feature.tags.length; i < j; i += 2) {
        if (feature.tags[i] === attributeKeyIndex) {
            return layer.values[feature.tags[i + 1]];
        }
    }

    return null;
}

test('getAttribute', function (t) {
    var layer = {
        keys: ['id', 'type', 'foo', 'bar'],
        values: [148, 1, 'bar=foo', 149, 'foo=bar', 150, 151, 0, 152, 153],
        features: [
            {
                tags: [0, 0, 1, 1, 2, 4]
            },
            {
                tags: [0, 3, 1, 1, 3, 2]
            }
        ]
    };

    t.equal(getAttribute(layer, layer.features[0], 'foo'), 'foo=bar');
    t.equal(getAttribute(layer, layer.features[0], 'bar'), null);
    t.equal(getAttribute(layer, layer.features[1], 'bar'), 'bar=foo');
    t.equal(getAttribute(layer, layer.features[1], 'foo'), null);

    t.end();
});

test('reads vector tiles into JSON and writes from JSON back to vector tiles', function (t) {
    var tile = Decorator.read(buf);
    var newBuf = Decorator.write(tile);
    var tile2 = Decorator.read(newBuf);
    t.deepEqual(tile, tile2);

    tile = Decorator.read(buf2);
    newBuf = Decorator.write(tile);
    tile2 = Decorator.read(newBuf);
    t.deepEqual(tile, tile2);

    t.end();
});

test('getLayerValues', function (t) {
    var tile = Decorator.read(buf);
    var ids = Decorator.getLayerValues(tile.layers[0], 'id');
    t.equal(ids.reduce(function (a, b) { return a + b; }), 74083218916);
    t.end();
});

test('decorateLayer, mergeLayer', function (t) {
    var tile = Decorator.read(buf);

    var props = tile.layers[0].features.map(function () {
        return {foo: 'bar'};
    });

    Decorator.decorateLayer(tile.layers[0], ['type', 'offset', 'glitter'], props);
    Decorator.mergeLayer(tile.layers[0]);

    t.deepEqual(tile, Decorator.read(decorated));

    t.end();
});

test('decorateLayer filtering half of the features', function (t) {
    var tile = Decorator.read(buf);
    var layer = tile.layers[0];

    // Check initial values

    var featureCount = layer.features.length;
    t.equal(featureCount, 10031);
    t.equal(getAttribute(layer, layer.features[0], 'id'), 14869990);
    t.equal(getAttribute(layer, layer.features[1], 'id'), 14869996);

    // Decorate with 50% of 'foo'

    var keys = ['id', 'type'];
    var props = layer.features.map(function (feature, index) {
        return index % 2 === 1 ? {foo: 'bar'} : {color: 'red'};
    });
    Decorator.decorateLayer(layer, keys, props);
    Decorator.mergeLayer(layer);

    t.true(layer.values.indexOf('bar') > 0);
    t.true(layer.values.indexOf('red') > 0);
    t.equal(getAttribute(layer, layer.features[0], 'color'), 'red');
    t.equal(getAttribute(layer, layer.features[0], 'foo'), null);
    t.equal(getAttribute(layer, layer.features[1], 'foo'), 'bar');
    t.equal(getAttribute(layer, layer.features[1], 'color'), null);

    // Filter some features and redecorate

    keys = ['id', 'type', 'color', 'foo'];
    t.deepEqual(layer.keys, keys);
    var required = ['foo'];
    Decorator.filterByKeys(layer, required);
    Decorator.decorateLayer(layer, keys, null);

    t.equal(layer.features.length, Math.floor(featureCount / 2));
    t.equal(getAttribute(layer, layer.features[0], 'id'), 14869996);
    t.true(layer.keys.indexOf('foo') > 0);
    t.true(layer.keys.indexOf('color') === -1);
    t.true(layer.values.indexOf('bar') > 0);
    t.true(layer.values.indexOf('red') === -1);
    t.equal(getAttribute(layer, layer.features[0], 'foo'), 'bar');
    t.equal(getAttribute(layer, layer.features[1], 'foo'), 'bar');

    t.end();
});
