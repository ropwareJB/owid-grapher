#! /usr/bin/env jest

import { AxisConfig } from "../axis/AxisConfig"
import { LineLegend, LineLegendProps } from "./LineLegend"

const props: LineLegendProps = {
    labelSeries: [
        {
            seriesName: "Canada",
            label: "Canada",
            color: "red",
            yValue: 50,
            annotation: "A country in North America",
        },
        {
            seriesName: "Mexico",
            label: "Mexico",
            color: "green",
            yValue: 20,
            annotation: "Below Canada",
        },
    ],
    x: 200,
    yAxis: new AxisConfig({ min: 0, max: 100 }).toVerticalAxis(),
}

it("can create a new legend", () => {
    const legend = new LineLegend(props)

    expect(legend.sizedLabels.length).toEqual(2)
})
