'use strict';

exports.readTile = readTile;
exports.writeTile = writeTile;

function readTile(pbf, end) {
    return pbf.readFields(readTileField, {layers: []}, end);
}
function readTileField(tag, tile, pbf) {
    if (tag === 3) tile.layers.push(readLayer(pbf, pbf.readVarint() + pbf.pos));
}

function writeTile(tile, pbf) {
    for (var i = 0; i < tile.layers.length; i++) pbf.writeMessage(3, writeLayer, tile.layers[i]);
}

// Value ========================================

function readValue(pbf, end) {
    var value;
    while (pbf.pos < end) {
        var tag = pbf.readVarint() >> 3;
        if (tag === 1) value = pbf.readString();
        else if (tag === 2) value = pbf.readFloat();
        else if (tag === 3) value = pbf.readDouble();
        else if (tag === 4) value = pbf.readVarint64();
        else if (tag === 5) value = pbf.readVarint();
        else if (tag === 6) value = pbf.readSVarint();
        else if (tag === 7) value = pbf.readBoolean();
    }
    return value;
}

function writeValue(value, pbf) {
    var type = typeof value;
    if (type === 'string') pbf.writeStringField(1, value);
    else if (type === 'boolean') pbf.writeBooleanField(7, value);
    else if (type === 'number') {
        if (value % 1 !== 0) pbf.writeDoubleField(3, value);
        else if (value >= 0) pbf.writeVarintField(5, value);
        else pbf.writeSVarintField(6, value);
    }
}

// Geometry =======================================

function readGeometry(pbf, end) {
    var length = 0;
    var x = 0;
    var y = 0;
    var cmd, line;
    var lines = [];

    while (pbf.pos < end) {
        if (length === 0) {
            var cmdLen = pbf.readVarint();
            cmd = cmdLen & 0x7;
            length = cmdLen >> 3;
        }

        if (cmd === 1 || cmd === 2) {
            if (cmd === 1) {
                if (line) lines.push(line);
                line = [];
            }

            x += pbf.readSVarint();
            y += pbf.readSVarint();
            line.push(x);
            line.push(y);

        } else if (cmd === 7) {
            line.push(line[0]);
            line.push(line[1]);

        } else {
            throw new Error('Unknown command ' + cmd);
        }

        length--;
    }

    if (line) lines.push(line);

    return lines;
}

function writeGeometry(feature, pbf) {
    var x = 0;
    var y = 0;

    for (var i = 0; i < feature.geometry.length; i++) {
        var line = feature.geometry[i];
        pbf.writeVarint(9);

        var len = line.length;

        var closed = feature.type === 3 && line[len - 2] === line[0] && line[len - 1] === line[1];

        if (closed) len -= 2;

        for (var j = 0; j < len; j += 2) {
            if (j === 2) pbf.writeVarint(2 + ((len / 2 - 1) << 3)); // lineTo

            var dx = line[j] - x;
            var dy = line[j + 1] - y;
            pbf.writeSVarint(dx);
            pbf.writeSVarint(dy);
            x += dx;
            y += dy;
        }

        if (closed) pbf.writeVarint(15); // closePath
    }
}

// Feature ========================================

function readFeature(pbf, end) {
    return pbf.readFields(readFeatureField, {}, end);
}
function readFeatureField(tag, feature, pbf) {
    if (tag === 1) feature.id = pbf.readVarint();
    else if (tag === 2) feature.tags = pbf.readPackedVarint();
    else if (tag === 3) feature.type = pbf.readVarint();
    else if (tag === 4) feature.geometry = readGeometry(pbf, pbf.readVarint() + pbf.pos);
}

function writeFeature(feature, pbf) {
    if (feature.id !== undefined) pbf.writeVarintField(1, feature.id);
    if (feature.tags !== undefined) pbf.writePackedVarint(2, feature.tags);
    pbf.writeVarintField(3, feature.type);
    pbf.writeMessage(4, writeGeometry, feature);
}

// Layer ========================================

function readLayer(pbf, end) {
    return pbf.readFields(readLayerField, {features: [], keys: [], values: []}, end);
}
function readLayerField(tag, layer, pbf) {
    if (tag === 15) layer.version = pbf.readVarint();
    else if (tag === 1) layer.name = pbf.readString();
    else if (tag === 2) layer.features.push(readFeature(pbf, pbf.readVarint() + pbf.pos));
    else if (tag === 3) layer.keys.push(pbf.readString());
    else if (tag === 4) layer.values.push(readValue(pbf, pbf.readVarint() + pbf.pos));
    else if (tag === 5) layer.extent = pbf.readVarint();
}

function writeLayer(layer, pbf) {
    if (layer.version !== undefined) pbf.writeVarintField(15, layer.version);
    pbf.writeStringField(1, layer.name);
    var i;
    if (layer.features !== undefined) for (i = 0; i < layer.features.length; i++) pbf.writeMessage(2, writeFeature, layer.features[i]);
    for (i = 0; i < layer.keys.length; i++) pbf.writeStringField(3, layer.keys[i]);
    for (i = 0; i < layer.values.length; i++) pbf.writeMessage(4, writeValue, layer.values[i]);
    if (layer.extent !== undefined) pbf.writeVarintField(5, layer.extent);
}
