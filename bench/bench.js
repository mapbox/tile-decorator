'use strict';

var fs = require('fs');
var path = require('path');
var Decorator = require('../');

var buf = fs.readFileSync(path.join(__dirname, '../test/fixtures/test.pbf'));

console.time('total');

console.time('read tile');
var tile = Decorator.read(buf);
var layer = tile.layers[0];
console.timeEnd('read tile');

console.time('get keys');
var ids = Decorator.getLayerValues(layer, 'id');
console.timeEnd('get keys');

var newProps = ids.map(function () {
    return {foo: 'bar'};
});

console.time('decorate');
Decorator.decorateLayer(layer, ['type', 'offset', 'glitter', 'hedgehogs'], newProps);
console.timeEnd('decorate');

console.time('merge');
var numFeatures = layer.features.length;
Decorator.mergeLayer(layer);
var numMerged = layer.features.length;
console.timeEnd('merge');

console.time('write tile');
var newBuf = Decorator.write(tile);
console.timeEnd('write tile');

console.timeEnd('total');

console.log('merged %d features into %d', numFeatures, numMerged);
console.log('size went from %d to %d', buf.length, newBuf.length);

fs.writeFileSync(path.join(__dirname, 'decorated.pbf'), newBuf);
