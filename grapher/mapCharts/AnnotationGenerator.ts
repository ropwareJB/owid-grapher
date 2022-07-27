import { PointVector } from "../../clientUtils/PointVector.js"
import pixelWidth from "string-pixel-width"
import {
    ChoroplethSeries,
    GeoFeature,
    RenderFeature,
} from "./MapChartConstants.js"
import { MapProjectionName, MapProjectionGeos } from "./MapProjections.js"
import { geoPath } from "d3-geo"
import polylabel from "polylabel"
import { Position } from "geojson"

interface internalLabel {
    id: string
    position: PointVector
    value?: any
    size: number
}

export function generateAnnotations(
    featureData: RenderFeature[],
    choroplethData: Map<string, ChoroplethSeries>,
    viewportScale: number,
    projection: MapProjectionName
): internalLabel[] {
    const minSize = 8
    const maxSize = 16
    const projectionGeo = MapProjectionGeos[projection]
    var retVal = featureData.map(function (country) {
        let fontSize = minSize
        let value = choroplethData.get(country.id)?.value
        let textWidth
        let regionPoints: Position[] = []
        if (typeof value === "number") value = Math.round(value * 10) / 10
        if (value) {
            textWidth = pixelWidth(value.toString(), {
                size: fontSize / viewportScale,
                font: "arial",
            })
        }
        const labelPos = getLabelInfo(country.geo.geometry)
        const projectionPath = projectionGeo({
            type: "Point",
            coordinates: [labelPos[0], labelPos[1]],
        })
        const p1 = Number(
            projectionPath?.substring(1, projectionPath.indexOf(","))
        )
        const p2 = Number(
            projectionPath?.substring(
                projectionPath.indexOf(",") + 1,
                projectionPath.indexOf(",", projectionPath.indexOf(",") + 1) - 2
            )
        )
        const centerpoint = new PointVector(p1, p2)
        if (country.geo.geometry.type === "Polygon") {
            let regionPath = country.path.slice(1, -1).split("L")
            regionPoints = regionPath.map((temp) => [
                Number(temp.substring(0, temp.indexOf(","))),
                Number(temp.substring(temp.indexOf(",") + 1)),
            ])
        } else {
            let countryPaths = country.path.slice(1, -1).split("ZM")
            for (const region of countryPaths) {
                regionPoints = []
                let regionPath = region.split("L")
                regionPoints = regionPath.map((temp) => [
                    Number(temp.substring(0, temp.indexOf(","))),
                    Number(temp.substring(temp.indexOf(",") + 1)),
                ])
                if (insideCheck([p1, p2], regionPoints)) break
            }
        }
        if (p1 && p2 && textWidth) {
            if (
                rectCheck(
                    centerpoint,
                    fontSize / viewportScale,
                    textWidth,
                    regionPoints
                )
            ) {
                while (fontSize < maxSize) {
                    if (value) {
                        textWidth = pixelWidth(value.toString(), {
                            size: (fontSize + 1) / viewportScale,
                            font: "arial",
                        })
                    }
                    if (
                        rectCheck(
                            centerpoint,
                            (fontSize + 1) / viewportScale,
                            textWidth,
                            regionPoints
                        )
                    )
                        fontSize++
                    else break
                }
                return {
                    id: country.id,
                    position: new PointVector(
                        p1 - textWidth / 2,
                        p2 + fontSize / viewportScale / 2
                    ),
                    value: value,
                    size: fontSize / viewportScale,
                }
            }
        }
        return {
            id: country.id,
            position: new PointVector(labelPos[0], labelPos[1]),
            size: minSize / viewportScale,
        }
    })
    return retVal
}

function insideCheck(point: number[], vs: Position[]): boolean {
    var x = point[0],
        y = point[1]
    var inside = false
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0],
            yi = vs[i][1]
        var xj = vs[j][0],
            yj = vs[j][1]

        var intersect =
            yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        if (intersect) inside = !inside
    }

    return inside
}

function rectCheck(
    center: PointVector,
    fontSize: number,
    textWidth: number,
    regionPoints: Position[]
): boolean {
    let t1 = [center.x - textWidth / 2, center.y]
    let t2 = [center.x - textWidth / 2, center.y + fontSize / 2]
    let t3 = [center.x - textWidth / 2, center.y - fontSize / 2]
    let t4 = [center.x, center.y - fontSize / 2]
    let t5 = [center.x, center.y - fontSize / 2]
    let t6 = [center.x + textWidth / 2, center.y]
    let t7 = [center.x + textWidth / 2, center.y + fontSize / 2]
    let t8 = [center.x + textWidth / 2, center.y - fontSize / 2]
    if (
        insideCheck(t1, regionPoints) &&
        insideCheck(t2, regionPoints) &&
        insideCheck(t3, regionPoints) &&
        insideCheck(t4, regionPoints) &&
        insideCheck(t5, regionPoints) &&
        insideCheck(t6, regionPoints) &&
        insideCheck(t7, regionPoints) &&
        insideCheck(t8, regionPoints)
    )
        return true
    return false
}

function getRatio(coordinates: any): number {
    const bounds = geoPath().bounds({ type: "Polygon", coordinates })
    const dx = bounds[1][0] - bounds[0][0]
    const dy = bounds[1][1] - bounds[0][1]
    const ratio = dx / (dy || 1)
    const A = 12
    return Math.min(Math.max(ratio, 1 / A), A)
}

function getLabelInfo(geometry: GeoFeature["geometry"]): number[] {
    let pos, ratio
    if (geometry.type === "MultiPolygon") {
        let maxDist = 0 // for multipolygons, pick the polygon with most available space
        for (const polygon of geometry.coordinates) {
            const r = getRatio(polygon)
            const p = polylabelStretched(polygon, r)
            if (p.distance > maxDist) {
                pos = p
                maxDist = p.distance
                ratio = r
            }
        }
    } else if (geometry.type === "Polygon") {
        ratio = getRatio(geometry.coordinates)
        pos = polylabelStretched(geometry.coordinates, ratio)
    }
    return pos.slice(0, 2)
}

function polylabelStretched(rings: Position[][], ratio: number) {
    const polygon = []
    for (const ring of rings) {
        // stretch the input
        const newRing = []
        for (const [x, y] of ring) newRing.push([x / ratio, y])
        polygon.push(newRing)
    }
    //Type is marked as any because of incorrect type declaration in the polylabel library
    const result: any = polylabel(polygon, 0.5)
    result[0] *= ratio // stretch the result back
    result.distance *= ratio
    return result
}
