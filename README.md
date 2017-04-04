## tile-decorator [![Build Status](https://travis-ci.org/mapbox/tile-decorator.svg?branch=master)](https://travis-ci.org/mapbox/tile-decorator)

A JavaScript module for decoding [Mapbox vector tiles](https://github.com/mapbox/vector-tile-spec),
doing various modifications in JS and reencoding back. It can:

- add new properties to a layer (`decorateLayer`)
- filter out features that don't have specific properties (`filterByKeys`)
- select properties to keep on each feature (`selectKeys`)
- merge features with the same properties and type into one, and sort geometries within one feature by proximity for better compression (`mergeLayer`)
- get all values of a specific property in a layer (`getLayerValues`)
- rename layers (`layer.name = 'foo'`)
- rename keys (`layer.keys[2] = 'kittens'`)
