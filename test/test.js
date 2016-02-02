'use strict';

var fs = require('fs');
var path = require('path');
var test = require('tap').test;

var Decorator = require('../');

var buf = fs.readFileSync(path.join(__dirname, 'fixtures/test.pbf'));
var buf2 = fs.readFileSync(path.join(__dirname, 'fixtures/streets.pbf'));
var decorated = fs.readFileSync(path.join(__dirname, 'fixtures/test-decorated.pbf'));

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

test('getLayerValues', function (t) {
    var tile = Decorator.read(buf);

    var props = tile.layers[0].features.map(function () {
        return {foo: 'bar'};
    });

    Decorator.decorateLayer(tile.layers[0], ['type', 'offset', 'glitter', 'hedgehogs'], props);
    Decorator.mergeLayer(tile.layers[0]);

    t.deepEqual(tile, Decorator.read(decorated));

    t.end();
});
