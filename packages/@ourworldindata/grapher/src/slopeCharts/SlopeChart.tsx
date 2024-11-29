import React, { SVGProps } from "react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    domainExtent,
    exposeInstanceOnWindow,
    PointVector,
    clamp,
    makeIdForHumanConsumption,
    guid,
    excludeUndefined,
    partition,
    max,
    getRelativeMouse,
    minBy,
    dyFromAlign,
} from "@ourworldindata/utils"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    BASE_FONT_SIZE,
    GRAPHER_BACKGROUND_DEFAULT,
    GRAPHER_DARK_TEXT,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import {
    ScaleType,
    SeriesName,
    ColorSchemeName,
    ColumnSlug,
    MissingDataStrategy,
    Time,
    SeriesStrategy,
    EntityName,
    RenderMode,
    VerticalAlign,
} from "@ourworldindata/types"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { scaleLinear, ScaleLinear } from "d3-scale"
import { select } from "d3-selection"
import {
    PlacedSlopeChartSeries,
    RawSlopeChartSeries,
    SlopeChartSeries,
} from "./SlopeChartConstants"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { AxisConfig } from "../axis/AxisConfig"
import { VerticalAxis } from "../axis/Axis"
import { VerticalAxisComponent } from "../axis/AxisViews"
import { NoDataSection } from "../scatterCharts/NoDataSection"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"
import { LineLabelSeries, LineLegend } from "../lineLegend/LineLegend"
import {
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
    Tooltip,
    TooltipState,
    TooltipValueRange,
} from "../tooltip/Tooltip"
import { TooltipFooterIcon } from "../tooltip/TooltipProps"
import {
    AnnotationsMap,
    getAnnotationsForSeries,
    getAnnotationsMap,
    getColorKey,
    getSeriesName,
} from "../lineCharts/LineChartHelpers"

type SVGMouseOrTouchEvent =
    | React.MouseEvent<SVGGElement>
    | React.TouchEvent<SVGGElement>

export interface SlopeChartManager extends ChartManager {
    canSelectMultipleEntities?: boolean // used to pick an appropriate series name
    hasTimeline?: boolean // used to filter the table for the entity selector
}

const TOP_PADDING = 6 // leave room for overflowing dots
const BOTTOM_PADDING = 20 // leave room for the x-axis

const LINE_LEGEND_PADDING = 4

@observer
export class SlopeChart
    extends React.Component<{
        bounds?: Bounds
        manager: SlopeChartManager
    }>
    implements ChartInterface
{
    slopeAreaRef: React.RefObject<SVGGElement> = React.createRef()
    defaultBaseColorScheme = ColorSchemeName.OwidDistinctLines

    @observable hoveredSeriesName?: string
    @observable tooltipState = new TooltipState<{
        series: SlopeChartSeries
    }>({ fade: "immediate" })

    transformTable(table: OwidTable) {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        return table
    }

    transformTableForSelection(table: OwidTable): OwidTable {
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        // if time selection is disabled, then filter all entities that
        // don't have data for the current time period
        if (!this.manager.hasTimeline && this.startTime !== this.endTime) {
            table = table
                .filterByTargetTimes([this.startTime, this.endTime])
                .dropEntitiesThatHaveSomeMissingOrErrorValueInAllColumns(
                    this.yColumnSlugs
                )
        }

        // if entities with partial data are not plotted,
        // make sure they don't show up in the entity selector
        if (this.missingDataStrategy === MissingDataStrategy.hide) {
            table = table.dropEntitiesThatHaveNoDataInSomeColumn(
                this.yColumnSlugs
            )
        }

        return table
    }

    @computed get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher
        // The % growth transform cannot be applied in transformTable() because it will filter out
        // any rows before startTime and change the timeline bounds.
        const { isRelativeMode, startTime } = this.manager
        if (isRelativeMode && startTime !== undefined) {
            table = table.toTotalGrowthForEachColumnComparedToStartTime(
                startTime,
                this.yColumnSlugs ?? []
            )
        }
        return table
    }

    @computed private get manager(): SlopeChartManager {
        return this.props.manager
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    private sidebarMargin = 10
    @computed private get innerBounds(): Bounds {
        return this.bounds.padRight(this.sidebarWidth + 8)
    }

    @computed get fontSize() {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get isLogScale(): boolean {
        return this.yScaleType === ScaleType.log
    }

    @computed private get missingDataStrategy(): MissingDataStrategy {
        return this.manager.missingDataStrategy || MissingDataStrategy.auto
    }

    @computed private get selectionArray() {
        return makeSelectionArray(this.manager.selection)
    }

    @computed private get formatColumn() {
        return this.yColumns[0]
    }

    @computed private get lineStrokeWidth(): number {
        return this.manager.isStaticAndSmall ? 3 : 1.5
    }

    @computed private get backgroundColor(): string {
        return this.manager.backgroundColor ?? GRAPHER_BACKGROUND_DEFAULT
    }

    @computed private get isFocusModeActive(): boolean {
        return this.hoveredSeriesName !== undefined
    }

    @computed private get yColumns(): CoreColumn[] {
        return this.yColumnSlugs.map((slug) => this.transformedTable.get(slug))
    }

    @computed protected get yColumnSlugs(): ColumnSlug[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed private get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes.get(this.manager.baseColorScheme)
                : null) ?? ColorSchemes.get(this.defaultBaseColorScheme)
        )
    }

    @computed private get startTime(): Time {
        return this.transformedTable.minTime ?? 0
    }

    @computed private get endTime(): Time {
        return this.transformedTable.maxTime ?? 0
    }

    @computed private get startX(): number {
        return this.xScale(this.startTime)
    }

    @computed private get endX(): number {
        return this.xScale(this.endTime)
    }

    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager, true)
    }

    @computed private get categoricalColorAssigner(): CategoricalColorAssigner {
        return new CategoricalColorAssigner({
            colorScheme: this.colorScheme,
            invertColorScheme: this.manager.invertColorScheme,
            colorMap:
                this.seriesStrategy === SeriesStrategy.entity
                    ? this.inputTable.entityNameColorIndex
                    : this.inputTable.columnDisplayNameToColorMap,
            autoColorMapCache: this.manager.seriesColorMap,
        })
    }

    @computed private get annotationsMap(): AnnotationsMap | undefined {
        return getAnnotationsMap(this.inputTable, this.yColumnSlugs[0])
    }

    private constructSingleSeries(
        entityName: EntityName,
        column: CoreColumn
    ): RawSlopeChartSeries {
        const { startTime, endTime, seriesStrategy } = this
        const { canSelectMultipleEntities = false } = this.manager

        const { availableEntityNames } = this.transformedTable
        const columnName = column.nonEmptyDisplayName
        const seriesName = getSeriesName({
            entityName,
            columnName,
            seriesStrategy,
            availableEntityNames,
            canSelectMultipleEntities,
        })

        const owidRowByTime = column.owidRowByEntityNameAndTime.get(entityName)
        const start = owidRowByTime?.get(startTime)
        const end = owidRowByTime?.get(endTime)

        const colorKey = getColorKey({
            entityName,
            columnName,
            seriesStrategy,
            availableEntityNames,
        })
        const color = this.categoricalColorAssigner.assign(colorKey)

        const annotation = getAnnotationsForSeries(
            this.annotationsMap,
            seriesName
        )

        return {
            column,
            seriesName,
            entityName,
            color,
            start,
            end,
            annotation,
        }
    }

    private isSeriesValid(
        series: RawSlopeChartSeries
    ): series is SlopeChartSeries {
        const {
            start,
            end,
            column: { tolerance },
        } = series

        // if the start or end value is missing, we can't draw the slope
        if (start?.value === undefined || end?.value === undefined) return false

        // sanity check (might happen if tolerance is enabled)
        if (start.originalTime >= end.originalTime) return false

        const isToleranceAppliedToStartValue =
            start.originalTime !== this.startTime
        const isToleranceAppliedToEndValue = end.originalTime !== this.endTime

        // if tolerance has been applied to one of the values, then we require
        // a minimal distance between the original times
        if (isToleranceAppliedToStartValue || isToleranceAppliedToEndValue) {
            return end.originalTime - start.originalTime >= tolerance
        }

        return true
    }

    // Usually we drop rows with missing data in the transformTable function.
    // But if we did that for slope charts, we wouldn't know whether a slope
    // has been dropped because it actually had no data or a sibling slope had
    // no data. But we need that information for the "No data" section. That's
    // why the filtering happens here, so that the noDataSeries can be populated
    // correctly.
    private shouldSeriesBePlotted(
        series: RawSlopeChartSeries
    ): series is SlopeChartSeries {
        if (!this.isSeriesValid(series)) return false

        // when the missing data strategy is set to "hide", we might
        // choose not to plot a valid series
        if (
            this.seriesStrategy === SeriesStrategy.column &&
            this.missingDataStrategy === MissingDataStrategy.hide
        ) {
            const allSeriesForEntity = this.rawSeriesByEntityName.get(
                series.entityName
            )
            return !!allSeriesForEntity?.every((series) =>
                this.isSeriesValid(series)
            )
        }

        return true
    }

    @computed private get rawSeries(): RawSlopeChartSeries[] {
        return this.yColumns.flatMap((column) =>
            this.selectionArray.selectedEntityNames.map((entityName) =>
                this.constructSingleSeries(entityName, column)
            )
        )
    }

    @computed private get rawSeriesByEntityName(): Map<
        SeriesName,
        RawSlopeChartSeries[]
    > {
        const map = new Map<SeriesName, RawSlopeChartSeries[]>()
        this.rawSeries.forEach((series) => {
            const { entityName } = series
            if (!map.has(entityName)) map.set(entityName, [])
            map.get(entityName)!.push(series)
        })
        return map
    }

    @computed get series(): SlopeChartSeries[] {
        return this.rawSeries.filter((series) =>
            this.shouldSeriesBePlotted(series)
        )
    }

    @computed private get placedSeries(): PlacedSlopeChartSeries[] {
        const { yAxis, startX, endX } = this

        return this.series.map((series) => {
            const startY = yAxis.place(series.start.value)
            const endY = yAxis.place(series.end.value)

            const startPoint = new PointVector(startX, startY)
            const endPoint = new PointVector(endX, endY)

            return { ...series, startPoint, endPoint }
        })
    }

    @computed
    private get noDataSeries(): RawSlopeChartSeries[] {
        return this.rawSeries.filter((series) => !this.isSeriesValid(series))
    }

    @computed private get showNoDataSection(): boolean {
        // nothing to show if there are no series with missing data
        if (this.noDataSeries.length === 0) return false

        // we usually don't show the no data section if columns are plotted
        // (since columns don't appear in the entity selector there is no need
        // to explain that a column is missing – it just adds noise). but if
        // the missing data strategy is set to hide, then we do want to give
        // feedback as to why a slope is currently not rendered
        return (
            this.seriesStrategy === SeriesStrategy.entity ||
            this.missingDataStrategy === MissingDataStrategy.hide
        )
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed get allYValues(): number[] {
        return this.series.flatMap((series) => [
            series.start.value,
            series.end.value,
        ])
    }

    @computed private get yScaleType(): ScaleType {
        return this.yAxisConfig.scaleType ?? ScaleType.linear
    }

    @computed private get yDomainDefault(): [number, number] {
        return domainExtent(this.allYValues, this.yScaleType)
    }

    @computed private get yDomain(): [number, number] {
        const domain = this.yAxisConfig.domain || [Infinity, -Infinity]
        const domainDefault = this.yDomainDefault
        return [
            Math.min(domain[0], domainDefault[0]),
            Math.max(domain[1], domainDefault[1]),
        ]
    }

    @computed private get yRange(): [number, number] {
        return this.bounds
            .padTop(TOP_PADDING)
            .padBottom(BOTTOM_PADDING)
            .yRange()
    }

    @computed get yAxis(): VerticalAxis {
        const axis = this.yAxisConfig.toVerticalAxis()
        axis.domain = this.yDomain
        axis.range = this.yRange
        axis.formatColumn = this.yColumns[0]
        axis.label = ""
        return axis
    }

    @computed private get yAxisWidth(): number {
        return this.yAxis.width + 5 // 5px account for the tick marks
    }

    @computed private get xScale(): ScaleLinear<number, number> {
        const { xDomain, xRange } = this
        return scaleLinear().domain(xDomain).range(xRange)
    }

    @computed private get xDomain(): [number, number] {
        return [this.startTime, this.endTime]
    }

    @computed private get sidebarWidth(): number {
        return this.showNoDataSection
            ? clamp(this.bounds.width * 0.125, 60, 140)
            : 0
    }

    @computed get maxLineLegendWidth(): number {
        return this.bounds.width / 6
    }

    @computed get lineLegendWidthLeft(): number {
        if (!this.manager.showLegend) return 0
        return LineLegend.width({
            labelSeries: this.lineLegendSeriesLeft,
            yAxis: this.yAxis,
            maxWidth: this.maxLineLegendWidth,
            connectorLineWidth: this.lineLegendConnectorLinesWidth,
            showValueLabelsInline: false,
            fontSize: this.fontSize,
            isStatic: this.manager.isStatic,
        })
    }

    @computed get lineLegendWidthRight(): number {
        if (!this.manager.showLegend) return 0
        return LineLegend.width({
            labelSeries: this.lineLegendSeriesRight,
            yAxis: this.yAxis,
            maxWidth: this.maxLineLegendWidth,
            connectorLineWidth: this.lineLegendConnectorLinesWidth,
            showValueLabelsInline: false,
            fontSize: this.fontSize,
            isStatic: this.manager.isStatic,
        })
    }

    @computed get xRange(): [number, number] {
        const lineLegendWidthLeft =
            this.lineLegendWidthLeft + LINE_LEGEND_PADDING
        const lineLegendWidthRight =
            this.lineLegendWidthRight + LINE_LEGEND_PADDING

        // pick a reasonable max width based on an ideal aspect ratio
        const idealAspectRatio = 0.6
        const chartAreaWidth = this.innerBounds.width
        const availableWidth =
            chartAreaWidth -
            this.yAxisWidth -
            lineLegendWidthLeft -
            lineLegendWidthRight
        const idealWidth = idealAspectRatio * this.bounds.height
        const maxSlopeWidth = Math.min(idealWidth, availableWidth)

        let startX: number, endX: number
        if (this.manager.isSemiNarrow) {
            startX = this.bounds.x + this.yAxisWidth + 4 + lineLegendWidthLeft
            endX = this.bounds.x + chartAreaWidth - lineLegendWidthRight
        } else {
            startX =
                this.bounds.x +
                Math.max(
                    0.25 * chartAreaWidth,
                    this.yAxisWidth + 4 + lineLegendWidthLeft
                )
            endX =
                this.bounds.x +
                chartAreaWidth -
                Math.max(0.25 * chartAreaWidth, lineLegendWidthRight)
        }

        const currentSlopeWidth = endX - startX
        if (currentSlopeWidth > maxSlopeWidth) {
            const padding = currentSlopeWidth - maxSlopeWidth
            startX += padding / 2
            endX -= padding / 2
        }

        return [startX, endX]
    }

    @computed get lineLegendX(): number {
        return this.xRange[1] + LINE_LEGEND_PADDING
    }

    @computed get useCompactLineLegend(): boolean {
        return !!this.manager.isSemiNarrow
    }

    // used by LineLegend
    @computed get focusedSeriesNames(): SeriesName[] {
        return this.hoveredSeriesName ? [this.hoveredSeriesName] : []
    }

    @computed get lineLegendSeriesLeft(): LineLabelSeries[] {
        return this.series.map((series) => {
            const { seriesName, color, start, annotation } = series
            const formattedValue = this.formatColumn.formatValueShort(
                start.value
            )
            return {
                color,
                seriesName,
                label: formattedValue,
                annotation,
                yValue: start.value,
            }
        })
    }

    @computed get lineLegendSeriesRight(): LineLabelSeries[] {
        return this.series.map((series) => {
            const { seriesName, color, end, annotation } = series
            const formattedValue = this.formatColumn.formatValueShort(end.value)
            return {
                color,
                seriesName,
                label: seriesName,
                annotation,
                formattedValue,
                yValue: end.value,
            }
        })
    }

    @computed private get lineLegendConnectorLinesWidth(): number {
        return this.useCompactLineLegend ? 15 : 25
    }

    private playIntroAnimation() {
        // Nice little intro animation
        select(this.slopeAreaRef.current)
            .selectAll(".slope")
            .attr("stroke-dasharray", "100%")
            .attr("stroke-dashoffset", "100%")
            .transition()
            .attr("stroke-dashoffset", "0%")
    }

    componentDidMount() {
        exposeInstanceOnWindow(this)

        if (!this.manager.disableIntroAnimation) {
            this.playIntroAnimation()
        }
    }

    private updateTooltipPosition(event: SVGMouseOrTouchEvent) {
        const ref = this.manager.base?.current
        if (ref) this.tooltipState.position = getRelativeMouse(ref, event)
    }

    private detectHoveredSlope(event: SVGMouseOrTouchEvent) {
        const ref = this.slopeAreaRef.current
        if (!ref) return

        const mouse = getRelativeMouse(ref, event)
        this.mouseFrame = requestAnimationFrame(() => {
            if (this.placedSeries.length === 0) return

            const distanceMap = new Map<PlacedSlopeChartSeries, number>()
            for (const series of this.placedSeries) {
                distanceMap.set(
                    series,
                    PointVector.distanceFromPointToLineSegmentSq(
                        mouse,
                        series.startPoint,
                        series.endPoint
                    )
                )
            }

            const closestSlope = minBy(this.placedSeries, (s) =>
                distanceMap.get(s)
            )!
            const distanceSq = distanceMap.get(closestSlope)!
            const tolerance = 10
            const toleranceSq = tolerance * tolerance

            if (closestSlope && distanceSq < toleranceSq) {
                this.onSlopeMouseOver(closestSlope)
            } else {
                this.onSlopeMouseLeave()
            }
        })
    }

    private hoverTimer?: NodeJS.Timeout
    @action.bound onLineLegendMouseOver(seriesName: SeriesName): void {
        clearTimeout(this.hoverTimer)
        this.hoveredSeriesName = seriesName
    }

    @action.bound onLineLegendMouseLeave(): void {
        clearTimeout(this.hoverTimer)
        this.hoverTimer = setTimeout(() => {
            // wait before clearing selection in case the mouse is moving quickly over neighboring labels
            this.hoveredSeriesName = undefined
        }, 200)
    }

    @action.bound onSlopeMouseOver(series: SlopeChartSeries) {
        this.hoveredSeriesName = series.seriesName
        this.tooltipState.target = { series }
    }

    @action.bound onSlopeMouseLeave() {
        this.hoveredSeriesName = undefined
        this.tooltipState.target = null
    }

    mouseFrame?: number
    @action.bound onMouseMove(event: SVGMouseOrTouchEvent) {
        this.updateTooltipPosition(event)
        this.detectHoveredSlope(event)
    }

    @action.bound onMouseLeave() {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        this.onSlopeMouseLeave()
    }

    @computed get failMessage(): string {
        const message = getDefaultFailMessage(this.manager)
        if (message) return message
        else if (this.startTime === this.endTime)
            return "No data to display for the selected time period"
        return ""
    }

    @computed get helpMessage(): string | undefined {
        if (
            this.failMessage ===
            "No data to display for the selected time period"
        )
            return "Try dragging the time slider to display data."
        return undefined
    }

    @computed get renderUid(): number {
        return guid()
    }

    @computed get tooltip(): React.ReactElement | undefined {
        const {
            manager: { isRelativeMode },
            tooltipState: { target, position, fading },
            formatColumn,
            startTime,
            endTime,
        } = this

        const { series } = target || {}
        if (!series) return

        const formatTime = (time: Time) => formatColumn.formatTime(time)

        const actualStartTime = series.start.originalTime
        const actualEndTime = series.end.originalTime
        const timeRange = `${formatTime(actualStartTime)} to ${formatTime(actualEndTime)}`
        const timeLabel = isRelativeMode
            ? `% change between ${formatColumn.formatTime(actualStartTime)} and ${formatColumn.formatTime(actualEndTime)}`
            : timeRange

        const constructTargetYearForToleranceNotice = () => {
            const isStartValueOriginal = series.start.originalTime === startTime
            const isEndValueOriginal = series.end.originalTime === endTime

            if (!isStartValueOriginal && !isEndValueOriginal) {
                return `${formatTime(startTime)} and ${formatTime(endTime)}`
            } else if (!isStartValueOriginal) {
                return formatTime(startTime)
            } else if (!isEndValueOriginal) {
                return formatTime(endTime)
            } else {
                return undefined
            }
        }

        const targetYear = constructTargetYearForToleranceNotice()
        const toleranceNotice = targetYear
            ? {
                  icon: TooltipFooterIcon.notice,
                  text: makeTooltipToleranceNotice(targetYear),
              }
            : undefined
        const roundingNotice = series.column.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.none,
                  text: makeTooltipRoundingNotice(
                      [series.column.numSignificantFigures],
                      { plural: !isRelativeMode }
                  ),
              }
            : undefined
        const footer = excludeUndefined([toleranceNotice, roundingNotice])

        const values = isRelativeMode
            ? [series.end.value]
            : [series.start.value, series.end.value]

        return (
            <Tooltip
                id={this.renderUid}
                tooltipManager={this.props.manager}
                x={position.x}
                y={position.y}
                offsetX={20}
                offsetY={-16}
                style={{ maxWidth: "250px" }}
                title={series.seriesName}
                subtitle={timeLabel}
                subtitleFormat={targetYear ? "notice" : undefined}
                dissolve={fading}
                footer={footer}
                dismiss={() => (this.tooltipState.target = null)}
            >
                <TooltipValueRange column={this.formatColumn} values={values} />
            </Tooltip>
        )
    }

    private makeMissingDataLabel(series: RawSlopeChartSeries): string {
        const { seriesName, start, end } = series

        const startTime = this.formatColumn.formatTime(this.startTime)
        const endTime = this.formatColumn.formatTime(this.endTime)

        // mention the start or end value if they're missing
        if (start?.value === undefined && end?.value === undefined) {
            return `${seriesName} (${startTime} & ${endTime})`
        } else if (start?.value === undefined) {
            return `${seriesName} (${startTime})`
        } else if (end?.value === undefined) {
            return `${seriesName} (${endTime})`
        }

        // if both values are given but the series shows up in the No Data
        // section, then tolerance has been applied to one of the values
        // in such a way that we decided not to render the slope after all
        // (e.g. when the original times are too close to each other)
        const isToleranceAppliedToStartValue =
            start.originalTime !== this.startTime
        const isToleranceAppliedToEndValue = end.originalTime !== this.endTime
        if (isToleranceAppliedToStartValue && isToleranceAppliedToEndValue) {
            return `${seriesName} (${startTime} & ${endTime})`
        } else if (isToleranceAppliedToStartValue) {
            return `${seriesName} (${startTime})`
        } else if (isToleranceAppliedToEndValue) {
            return `${seriesName} (${endTime})`
        }

        return seriesName
    }

    private renderNoDataSection(): React.ReactElement | void {
        if (!this.showNoDataSection) return

        const bounds = new Bounds(
            this.innerBounds.right + this.sidebarMargin,
            this.bounds.top,
            this.sidebarWidth,
            this.bounds.height
        )
        const seriesNames = this.noDataSeries.map((series) =>
            this.makeMissingDataLabel(series)
        )

        return (
            <NoDataSection
                seriesNames={seriesNames}
                bounds={bounds}
                baseFontSize={this.fontSize}
            />
        )
    }

    private renderSlope(
        series: PlacedSlopeChartSeries,
        mode?: RenderMode
    ): React.ReactElement {
        return (
            <Slope
                key={series.seriesName}
                series={series}
                color={series.color}
                mode={mode}
                strokeWidth={this.lineStrokeWidth}
                outlineWidth={0.5}
                outlineStroke={this.backgroundColor}
            />
        )
    }

    private renderSlopes() {
        if (!this.isFocusModeActive) {
            return this.placedSeries.map((series) => this.renderSlope(series))
        }

        const [focusedSeries, backgroundSeries] = partition(
            this.placedSeries,
            (series) => series.seriesName === this.hoveredSeriesName
        )

        return (
            <>
                {backgroundSeries.map((series) =>
                    this.renderSlope(series, RenderMode.mute)
                )}
                {focusedSeries.map((series) =>
                    this.renderSlope(series, RenderMode.focus)
                )}
            </>
        )
    }

    private renderChartArea() {
        const { bounds, xDomain, yRange, startX, endX } = this

        const [bottom, top] = yRange

        return (
            <g>
                <GridLines
                    bounds={this.bounds}
                    yAxis={this.yAxis}
                    endX={this.innerBounds.right}
                />
                <VerticalAxisComponent
                    bounds={bounds}
                    verticalAxis={this.yAxis}
                    showTickMarks={true}
                    labelColor={this.manager.secondaryColorInStaticCharts}
                />
                <MarkX
                    label={this.formatColumn.formatTime(xDomain[0])}
                    x={startX}
                    top={top}
                    bottom={bottom}
                    fontSize={this.yAxis.tickFontSize}
                />
                <MarkX
                    label={this.formatColumn.formatTime(xDomain[1])}
                    x={endX}
                    top={top}
                    bottom={bottom}
                    fontSize={this.yAxis.tickFontSize}
                />
                <g
                    id={makeIdForHumanConsumption("slopes")}
                    ref={this.slopeAreaRef}
                    onMouseMove={this.onMouseMove}
                    onTouchMove={this.onMouseMove}
                    onTouchStart={this.onMouseMove}
                    onMouseLeave={this.onMouseLeave}
                >
                    <rect
                        x={this.startX}
                        y={bounds.y}
                        width={this.endX - this.startX}
                        height={bounds.height}
                        fillOpacity={0}
                    />
                    {this.renderSlopes()}
                </g>
            </g>
        )
    }

    private renderLineLegendRight(): React.ReactElement {
        return (
            <LineLegend
                labelSeries={this.lineLegendSeriesRight}
                yAxis={this.yAxis}
                x={this.xRange[1] + LINE_LEGEND_PADDING}
                yRange={[this.bounds.top, this.bounds.bottom]}
                maxWidth={this.maxLineLegendWidth}
                lineLegendAnchorX="start"
                showValueLabelsInline={!this.useCompactLineLegend}
                connectorLineWidth={this.lineLegendConnectorLinesWidth}
                fontSize={this.fontSize}
                fontWeight={700}
                isStatic={this.manager.isStatic}
                focusedSeriesNames={this.focusedSeriesNames}
                onMouseLeave={this.onLineLegendMouseLeave}
                onMouseOver={this.onLineLegendMouseOver}
            />
        )
    }

    private renderLineLegendLeft(): React.ReactElement {
        // in relative mode, all slopes start from 0%
        if (this.manager.isRelativeMode)
            return (
                <text
                    x={this.startX}
                    y={this.yAxis.place(0)}
                    textAnchor="end"
                    dx={-LINE_LEGEND_PADDING - 4}
                    dy={dyFromAlign(VerticalAlign.middle)}
                    fontSize={GRAPHER_FONT_SCALE_12 * this.fontSize}
                >
                    {this.formatColumn.formatValueShort(0)}
                </text>
            )

        return (
            <LineLegend
                labelSeries={this.lineLegendSeriesLeft}
                yAxis={this.yAxis}
                x={this.xRange[0] - LINE_LEGEND_PADDING}
                yRange={[this.bounds.top, this.bounds.bottom]}
                maxWidth={this.maxLineLegendWidth}
                lineLegendAnchorX="end"
                showValueLabelsInline={!this.useCompactLineLegend}
                connectorLineWidth={this.lineLegendConnectorLinesWidth}
                fontSize={this.fontSize}
                isStatic={this.manager.isStatic}
                focusedSeriesNames={this.focusedSeriesNames}
                onMouseLeave={this.onLineLegendMouseLeave}
                onMouseOver={this.onLineLegendMouseOver}
            />
        )
    }

    private renderLineLegends(): React.ReactElement | void {
        if (!this.manager.showLegend) return

        return (
            <>
                {this.renderLineLegendLeft()}
                {this.renderLineLegendRight()}
            </>
        )
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                    helpText={this.helpMessage}
                />
            )

        return (
            <g>
                {this.renderChartArea()}
                {this.renderLineLegends()}
                {this.renderNoDataSection()}
                {this.tooltip}
            </g>
        )
    }
}

interface SlopeProps {
    series: PlacedSlopeChartSeries
    color: string
    mode?: RenderMode
    dotRadius?: number
    strokeWidth?: number
    outlineWidth?: number
    outlineStroke?: string
    onMouseOver?: (series: SlopeChartSeries) => void
    onMouseLeave?: () => void
}

function Slope({
    series,
    color,
    mode = RenderMode.default,
    dotRadius = 3.5,
    strokeWidth = 2,
    outlineWidth = 0.5,
    outlineStroke = "#fff",
    onMouseOver,
    onMouseLeave,
}: SlopeProps) {
    const { seriesName, startPoint, endPoint } = series

    const opacity = {
        [RenderMode.default]: 1,
        [RenderMode.focus]: 1,
        [RenderMode.mute]: 0.3,
        [RenderMode.background]: 0.3,
    }[mode]

    return (
        <g
            id={makeIdForHumanConsumption("slope", seriesName)}
            className="slope"
            onMouseOver={() => onMouseOver?.(series)}
            onMouseLeave={() => onMouseLeave?.()}
        >
            <HaloLine
                startPoint={startPoint}
                endPoint={endPoint}
                stroke={color}
                strokeWidth={strokeWidth}
                outlineWidth={outlineWidth}
                outlineStroke={outlineStroke}
                opacity={opacity}
            />
            <circle
                cx={startPoint.x}
                cy={startPoint.y}
                r={dotRadius}
                fill={color}
                fillOpacity={opacity}
                stroke={outlineStroke}
                strokeWidth={outlineWidth}
            />
            <circle
                cx={endPoint.x}
                cy={endPoint.y}
                r={dotRadius}
                fill={color}
                fillOpacity={opacity}
                stroke={outlineStroke}
                strokeWidth={outlineWidth}
            />
        </g>
    )
}

interface HaloLineProps extends SVGProps<SVGLineElement> {
    startPoint: PointVector
    endPoint: PointVector
    strokeWidth?: number
    outlineWidth?: number
    outlineStroke?: string
}

function HaloLine(props: HaloLineProps): React.ReactElement {
    const {
        startPoint,
        endPoint,
        outlineWidth = 0.5,
        outlineStroke = "#fff",
        ...styleProps
    } = props
    return (
        <>
            <line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={endPoint.x}
                y2={endPoint.y}
                {...styleProps}
                stroke={outlineStroke}
                strokeWidth={(props.strokeWidth ?? 1) + 2 * outlineWidth}
            />
            <line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={endPoint.x}
                y2={endPoint.y}
                {...styleProps}
            />
        </>
    )
}

interface GridLinesProps {
    bounds: Bounds
    yAxis: VerticalAxis
    endX: number
}

function GridLines({ bounds, yAxis, endX }: GridLinesProps) {
    return (
        <g id={makeIdForHumanConsumption("grid-lines")}>
            {yAxis.tickLabels.map((tick) => {
                const y = yAxis.place(tick.value)
                return (
                    <g
                        id={makeIdForHumanConsumption(
                            "grid-line",
                            tick.formattedValue
                        )}
                        key={tick.formattedValue}
                    >
                        <line
                            x1={bounds.left + yAxis.width + 8}
                            y1={y}
                            x2={endX}
                            y2={y}
                            stroke="#ddd"
                            strokeDasharray="3,2"
                        />
                    </g>
                )
            })}
        </g>
    )
}

function MarkX({
    label,
    x,
    top,
    bottom,
    fontSize,
}: {
    label: string
    x: number
    top: number
    bottom: number
    fontSize: number
}) {
    return (
        <>
            <line x1={x} y1={top} x2={x} y2={bottom} stroke="#999" />
            <text
                x={x}
                y={bottom + BOTTOM_PADDING - 2}
                textAnchor="middle"
                fill={GRAPHER_DARK_TEXT}
                fontSize={fontSize}
                fontWeight={600}
            >
                {label}
            </text>
        </>
    )
}
