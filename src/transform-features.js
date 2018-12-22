const { PointSymbolType, LineSymbolType } = require('./ocad-reader/symbol-types')

const defaultOptions = {
  assignIds: true,
  applyCrs: true,
  generateSymbolElements: true,
  exportHidden: false,
  coordinatePrecision: 6
}

module.exports = function (ocadFile, createObject, createElement, options) {
  options = { ...defaultOptions, ...options }

  const symbols = ocadFile.symbols.reduce((ss, s) => {
    ss[s.symNum] = s
    return ss
  }, {})

  let features = ocadFile.objects
    .map(createObject.bind(null, options, symbols))
    .filter(f => f)

  if (options.generateSymbolElements) {
    const elementFeatures = features
      .map(generateSymbolElements.bind(null, createElement, options, symbols))
      .filter(f => f)

    features = features.concat(Array.prototype.concat.apply([], elementFeatures))
  }

  return features
}

const generateSymbolElements = (createElement, options, symbols, feature) => {
  const symbol = symbols[feature.properties.sym]
  let elements = []

  if (!options.exportHidden && (!symbol || symbol.isHidden())) return elements

  switch (symbol.type) {
    case PointSymbolType:
      const angle = feature.properties.ang ? feature.properties.ang / 10 / 180 * Math.PI : 0
      elements = symbol.elements
        .map((e, i) => createElement(symbol, 'element', i, feature, e, feature.geometry.coordinates, angle))
      break
    case LineSymbolType:
      if (symbol.primSymElements.length > 0) {
        const coords = feature.geometry.coordinates
        const endLength = symbol.endLength
        const mainLength = symbol.mainLength
        const spotDist = symbol.primSymDist

        let d = endLength

        for (let i = 1; i < coords.length; i++) {
          const c0 = coords[i - 1]
          const c1 = coords[i]
          const v = c1.sub(c0)
          const angle = Math.atan2(v[1], v[0])
          const u = v.unit()
          const segmentLength = v.vLength()

          let c = c0.add(u.mul(d))
          let j = 0
          while (d < segmentLength) {
            elements = elements.concat(symbol.primSymElements
              .map((e, i) => createElement(symbol, 'prim', i, feature, e, c, angle)))

            j++
            const step = (spotDist && j % symbol.nPrimSym) ? spotDist : mainLength

            c = c.add(u.mul(step))
            d += step
          }

          d -= segmentLength
        }
      }
  }

  return elements
}