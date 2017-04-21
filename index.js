'use strict';

var Pbf = require('pbf');
var VT = require('./vector-tile.js');

exports.read = readTile;
exports.write = writeTile;
exports.getLayerValues = getLayerValues;
exports.updateLayerProperties = updateLayerProperties;
exports.mergeLayer = mergeLayer;
exports.filterLayerByKeys = filterLayerByKeys;
exports.selectLayerKeys = selectLayerKeys;

function readTile(buf) {
    return VT.readTile(new Pbf(buf));
}

function writeTile(tile) {
    var pbf = new Pbf();
    VT.writeTile(tile, pbf);
    return pbf.finish();
}

function getLayerValues(layer, key) {
    var keyIndex = layer.keys.indexOf(key);
    var values = [];

    for (var i = 0; i < layer.features.length; i++) {
        var tags = layer.features[i].tags;
        for (var j = 0; j < tags.length; j += 2) {
            if (tags[j] === keyIndex) {
                var value = layer.values[tags[j + 1]];
                if (value !== undefined) values.push(value);
                else throw new Error(key + ' not found');
                break;
            }
        }
    }

    return values;
}

function filterLayerByKeys(layer, requiredKeys) {
    var keys = layer.keys;
    var requiredLookup = {};
    var requiredCount = requiredKeys.length;

    for (var i = 0; i < requiredCount; i++) {
        requiredLookup[keys.indexOf(requiredKeys[i])] = true;
    }

    layer.features = layer.features.filter(function (feature) {
        return hasAllKeys(feature.tags, requiredLookup, requiredCount);
    });

    return layer;
}

function selectLayerKeys(layer, keysToKeep) {
    var keys = layer.keys;
    var values = layer.values;
    var keepLookup = {};
    layer.keyLookup = {};
    layer.valLookup = {};
    layer.keys = [];
    layer.values = [];

    for (var i = 0; i < keysToKeep.length; i++) {
        keepLookup[keys.indexOf(keysToKeep[i])] = true;
    }

    for (i = 0; i < layer.features.length; i++) {
        var feature = layer.features[i];
        var tags = feature.tags;
        feature.tags = [];

        for (var j = 0; j < tags.length; j += 2) {
            if (keepLookup[tags[j]]) {
                addKey(keys[tags[j]], layer.keyLookup, layer.keys, feature.tags);
                addValue(values[tags[j + 1]], layer.valLookup, layer.values, feature.tags);
            }
        }
    }

    return layer;
}

function updateLayerProperties(layer, newProps) {
    if (!newProps || (newProps.length !== layer.features.length)) {
        throw new Error('The length of newProps array does not match the number of features');
    }

    if (!layer.keyLookup || !layer.valLookup) buildKeyValueLookups(layer);

    for (var i = 0; i < layer.features.length; i++) {
        var feature = layer.features[i];
        for (var id in newProps[i]) {
            addKey(id, layer.keyLookup, layer.keys, feature.tags);
            addValue(newProps[i][id], layer.valLookup, layer.values, feature.tags);
        }
    }

    return layer;
}

function mergeLayer(layer) {
    layer.features.sort(compareTags);

    var features = layer.features;
    layer.features = [];

    var lastFeature;

    for (var i = 0; i < features.length; i++) {
        if (!lastFeature || compareTags(features[i], lastFeature) !== 0) {
            layer.features.push(features[i]);
            lastFeature = features[i];
        } else {
            var geom = features[i].geometry;
            for (var j = 0; j < geom.length; j++) {
                lastFeature.geometry.push(geom[j]);
            }
        }
    }

    for (i = 0; i < layer.features.length; i++) {
        var feature = layer.features[i];
        if (feature.type === 2) { // lines
            feature.geometry.sort(compareLines);
            feature.geometry = mergeLines(feature.geometry);
        }
    }

    return layer;
}

function mergeLines(geom) {
    var starts = {};
    var ends = {};
    var newGeom = [];

    var iters = 0;
    for (var i = 0; i < geom.length; i++) {
        var ring = geom[i];
        var len = ring.length;
        var startKey = zOrder(ring[0], ring[1]);
        var endKey = zOrder(ring[len - 2], ring[len - 1]);
        console.log('----hi')
        console.log(starts)
        console.log(ends)
        console.log(ring, startKey, endKey);
        var checked = 0;



        // if (ends[startKey] || starts[endKey]) {
        //     while (true) {
        //         iters++;
                if (ends[startKey]) { // found line that ends where current start
                    for (var j = 2; j < len; j++) ends[startKey].push(ring[j]);
                    ends[endKey] = ends[startKey];
                    delete ends[startKey];

                    ring = ends[endKey];
                    startKey = zOrder(ring[0], ring[1]);
                    console.log('new startKey', startKey);
                } else if (starts[endKey]) { // found line that starts where current ends
                    for (j = len - 3; j >= 0; j--) starts[endKey].unshift(ring[j]);
                    starts[startKey] = starts[endKey];
                    delete starts[endKey];

                    ring = starts[startKey];
                    len = ring.length;
                    endKey = zOrder(ring[len - 2], ring[len - 1]);
                    console.log('new endKey', endKey);
                // } else {
                //     break;
                // }
                console.log('checking again', ++checked);
            // }
        } else {
            iters++;
            starts[startKey] = ring;
            ends[endKey] = ring;
            // newGeom.push(ring);
        }
        console.log(newGeom);


        console.log('-----------');
    }

    for (var key in starts) {
        newGeom.push(starts[key]);
    }

    console.log('steps', iters);
    return newGeom;
}

function addKey(key, keyLookup, keys, tags) {
    var keyTag = keyLookup[key];
    if (keyTag === undefined) {
        keyTag = keys.length;
        keyLookup[key] = keys.length;
        keys.push(key);
    }
    tags.push(keyTag);
}

function getValueKey(val) {
    var valType = typeof val;
    return valType !== 'number' ? valType + ':' + val : val;
}


function addValue(val, valLookup, values, tags) {
    var valKey = getValueKey(val);
    var valTag = valLookup[valKey];
    if (valTag === undefined) {
        valTag = values.length;
        valLookup[valKey] = values.length;
        values.push(val);
    }
    tags.push(valTag);
}

function compareTags(a, b) {
    if (a.type !== b.type) return a.type - b.type;
    var tags1 = a.tags;
    var tags2 = b.tags;
    if (!tags1 && tags2) return -1;
    if (tags1 && !tags2) return 1;
    if (!tags1 && !tags2) return 0;
    if (tags1.length < tags2.length) return -1;
    if (tags1.length > tags2.length) return 1;
    for (var i = 0; i < tags1.length; i++) {
        var d = tags1[i] - tags2[i];
        if (d !== 0) return d;
    }
    return 0;
}

function compareLines(a, b) {
    return zOrder(a[0], a[1]) - zOrder(b[0], b[1]);
}

function zOrder(x, y) {
    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;

    y = (y | (y << 8)) & 0x00FF00FF;
    y = (y | (y << 4)) & 0x0F0F0F0F;
    y = (y | (y << 2)) & 0x33333333;
    y = (y | (y << 1)) & 0x55555555;

    return x | (y << 1);
}

function hasAllKeys(tags, requiredLookup, requiredCount) {
    var found = 0;
    for (var i = 0; i < tags.length; i += 2) {
        if (requiredLookup[tags[i]]) found++;
    }
    return found === requiredCount;
}

function buildKeyValueLookups(layer) {
    layer.keyLookup = {};
    layer.valLookup = {};
    for (var k = 0; k < layer.keys.length; k++) {
        layer.keyLookup[layer.keys[k]] = k;
    }
    for (var v = 0; v < layer.values.length; v++) {
        var val = layer.values[v];
        layer.valLookup[getValueKey(val)] = v;
    }
}
