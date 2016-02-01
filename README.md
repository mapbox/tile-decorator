## tile-decorator

A JavaScript module for decoding [Mapbox vector tiles](https://github.com/mapbox/vector-tile-spec),
doing various modifications in JS and reencoding back. It can:

- remove specific properties in a layer (`decorateLayer`)
- merge features with the same properties and type into one (`mergeLayer`)
- sort parts of a geometry by z-order curve to optimize compression
- get all values of a specific property in a layer (`getLayerValues`)
