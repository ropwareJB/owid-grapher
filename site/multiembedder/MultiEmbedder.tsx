import {
    getSelectedEntityNamesParam,
    GLOBAL_ENTITY_SELECTOR_DEFAULT_COUNTRY,
    GLOBAL_ENTITY_SELECTOR_ELEMENT,
    Grapher,
    GrapherProgrammaticInterface,
    GRAPHER_EMBEDDED_FIGURE_ATTR,
    GRAPHER_EMBEDDED_FIGURE_CONFIG_ATTR,
    hydrateGlobalEntitySelectorIfAny,
    migrateSelectedEntityNamesParam,
    SelectionArray,
    migrateGrapherConfigToLatestVersion,
    GRAPHER_VIEW_EMBEDDED_FIGURE_CONFIG_ATTR,
} from "@ourworldindata/grapher"
import {
    fetchText,
    getWindowUrl,
    isPresent,
    Url,
    GRAPHER_TAB_OPTIONS,
    merge,
    MultiDimDataPageConfig,
    extractMultiDimChoicesFromQueryStr,
    fetchWithRetry,
    NarrativeViewInfo,
} from "@ourworldindata/utils"
import { action } from "mobx"
import React from "react"
import ReactDOM from "react-dom"
import {
    Explorer,
    ExplorerProps,
    EXPLORER_EMBEDDED_FIGURE_SELECTOR,
    buildExplorerProps,
    isEmpty,
} from "@ourworldindata/explorer"
import { GRAPHER_PREVIEW_CLASS } from "../SiteConstants.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
    MULTI_DIM_DYNAMIC_CONFIG_URL,
} from "../../settings/clientSettings.js"
import Bugsnag from "@bugsnag/js"
import { embedDynamicCollectionGrapher } from "../collections/DynamicCollection.js"
import { match } from "ts-pattern"

type EmbedType = "grapher" | "explorer" | "multiDim" | "grapherView"

const figuresFromDOM = (
    container: HTMLElement | Document = document,
    selector: string
) =>
    Array.from(
        container.querySelectorAll<HTMLElement>(`*[${selector}]`)
    ).filter(isPresent)

// Determine whether this device is powerful enough to handle
// loading a bunch of inline interactive charts
// 680px is also used in CSS – keep it in sync if you change this
export const shouldProgressiveEmbed = () => true
// disabling this behaviour for now until we have a better way to detect low power devices
// https://github.com/owid/owid-grapher/issues/3661
// !isMobile() || window.screen.width > 680 || pageContainsGlobalEntitySelector()

// const pageContainsGlobalEntitySelector = () =>
//     globalEntitySelectorElement() !== null

const globalEntitySelectorElement = () =>
    document.querySelector(GLOBAL_ENTITY_SELECTOR_ELEMENT)

class MultiEmbedder {
    private figuresObserver: IntersectionObserver | undefined
    selection: SelectionArray = new SelectionArray()
    graphersAndExplorersToUpdate: Set<SelectionArray> = new Set()

    constructor() {
        if (typeof window !== "undefined" && "IntersectionObserver" in window) {
            this.figuresObserver = new IntersectionObserver(
                this.onIntersecting.bind(this),
                {
                    rootMargin: "200%",
                }
            )
        } else if (
            typeof window === "object" &&
            typeof document === "object" &&
            !navigator.userAgent.includes("jsdom")
        ) {
            // only show the warning when we're in something that roughly resembles a browser
            console.warn(
                "IntersectionObserver not available; interactive embeds won't load on this page"
            )
            Bugsnag?.notify("IntersectionObserver not available")
        }
    }

    /**
     * Finds all <figure data-grapher-src="..."> and <figure
     * data-explorer-src="..."> elements in the document and loads the
     * iframeless interactive charts when the user's viewport approaches them.
     * Uses an IntersectionObserver (see constructor).
     *
     * BEWARE: this method is hardcoded in some scripts, make sure to check
     * thoroughly before making any changes.
     */
    embedAll() {
        this.observeFigures()
    }

    /**
     * Make the embedder aware of new <figure> elements that are injected into the DOM.
     *
     * Use this when you programmatically create/replace charts.
     */
    observeFigures(container: HTMLElement | Document = document) {
        const figures = figuresFromDOM(container, GRAPHER_EMBEDDED_FIGURE_ATTR)
            .concat(
                figuresFromDOM(container, EXPLORER_EMBEDDED_FIGURE_SELECTOR)
            )
            .concat(
                figuresFromDOM(
                    container,
                    GRAPHER_VIEW_EMBEDDED_FIGURE_CONFIG_ATTR
                )
            )

        figures.forEach((figure) => {
            this.figuresObserver?.observe(figure)
        })
    }

    async onIntersecting(entries: IntersectionObserverEntry[]) {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                void this.renderInteractiveFigure(entry.target)
            }
        })
    }

    async renderExplorerIntoFigure(figure: Element) {
        const explorerUrl = figure.getAttribute(
            EXPLORER_EMBEDDED_FIGURE_SELECTOR
        )

        if (!explorerUrl) return

        const { fullUrl, queryStr } = Url.fromURL(explorerUrl)

        const html = await fetchText(fullUrl)
        const props: ExplorerProps = await buildExplorerProps(
            html,
            queryStr,
            this.selection
        )
        if (props.selection)
            this.graphersAndExplorersToUpdate.add(props.selection)
        ReactDOM.render(<Explorer {...props} />, figure)
    }

    private async _renderGrapherComponentIntoFigure(
        figure: Element,
        {
            configUrl,
            embedUrl,
            additionalConfig,
        }: {
            configUrl: string
            embedUrl?: Url
            additionalConfig?: Partial<GrapherProgrammaticInterface>
        }
    ) {
        const { queryStr, queryParams } = embedUrl ?? {}

        figure.classList.remove(GRAPHER_PREVIEW_CLASS)
        const common: GrapherProgrammaticInterface = {
            isEmbeddedInAnOwidPage: true,
            queryStr,
            adminBaseUrl: ADMIN_BASE_URL,
            bakedGrapherURL: BAKED_GRAPHER_URL,
            dataApiUrl: DATA_API_URL,
        }

        const fetchedGrapherPageConfig = await fetchWithRetry(configUrl).then(
            (res) => res.json()
        )
        const grapherPageConfig = migrateGrapherConfigToLatestVersion(
            fetchedGrapherPageConfig
        )

        const figureConfigAttr = figure.getAttribute(
            GRAPHER_EMBEDDED_FIGURE_CONFIG_ATTR
        )
        const localConfig = figureConfigAttr ? JSON.parse(figureConfigAttr) : {}

        // make sure the tab of the active pane is visible
        if (figureConfigAttr && !isEmpty(localConfig)) {
            const activeTab = queryParams?.tab || grapherPageConfig.tab
            if (activeTab === GRAPHER_TAB_OPTIONS.chart)
                localConfig.hideChartTabs = false
            if (activeTab === GRAPHER_TAB_OPTIONS.map)
                localConfig.hasMapTab = true
            if (activeTab === GRAPHER_TAB_OPTIONS.table)
                localConfig.hasTableTab = true
        }

        const config = merge(
            {}, // merge mutates the first argument
            grapherPageConfig,
            common,
            additionalConfig,
            localConfig,
            {
                manager: {
                    selection: new SelectionArray(
                        this.selection.selectedEntityNames
                    ),
                },
            }
        )
        if (config.manager?.selection)
            this.graphersAndExplorersToUpdate.add(config.manager.selection)

        const grapherRef = Grapher.renderGrapherIntoContainer(config, figure)

        // Special handling for shared collections
        if (window.location.pathname.startsWith("/collection/custom")) {
            embedDynamicCollectionGrapher(grapherRef, figure)
        }
    }
    async renderGrapherIntoFigure(figure: Element) {
        const embedUrlRaw = figure.getAttribute(GRAPHER_EMBEDDED_FIGURE_ATTR)
        if (!embedUrlRaw) return
        const embedUrl = Url.fromURL(embedUrlRaw)

        const configUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/${embedUrl.slug}.config.json`

        await this._renderGrapherComponentIntoFigure(figure, {
            configUrl,
            embedUrl,
        })
    }
    async renderMultiDimIntoFigure(figure: Element) {
        const embedUrlRaw = figure.getAttribute(GRAPHER_EMBEDDED_FIGURE_ATTR)
        if (!embedUrlRaw) return
        const embedUrl = Url.fromURL(embedUrlRaw)

        const { queryStr, slug } = embedUrl

        const mdimConfigUrl = `${MULTI_DIM_DYNAMIC_CONFIG_URL}/${slug}.json`
        const mdimJsonConfig = await fetchWithRetry(mdimConfigUrl).then((res) =>
            res.json()
        )
        const mdimConfig = MultiDimDataPageConfig.fromObject(mdimJsonConfig)
        const dimensions = extractMultiDimChoicesFromQueryStr(
            queryStr,
            mdimConfig
        )
        const view = mdimConfig.findViewByDimensions(dimensions)
        if (!view) {
            throw new Error(
                `No view found for dimensions ${JSON.stringify(dimensions)}`
            )
        }

        const configUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${view.fullConfigId}.config.json`

        await this._renderGrapherComponentIntoFigure(figure, {
            configUrl,
            embedUrl,
        })
    }
    async renderGrapherViewIntoFigure(figure: Element) {
        const viewConfigRaw = figure.getAttribute(
            GRAPHER_VIEW_EMBEDDED_FIGURE_CONFIG_ATTR
        )
        if (!viewConfigRaw) return
        const viewConfig: NarrativeViewInfo = JSON.parse(viewConfigRaw)
        if (!viewConfig) return

        const configUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${viewConfig.chartConfigId}.config.json`

        await this._renderGrapherComponentIntoFigure(figure, {
            configUrl,
            additionalConfig: {},
        })
    }

    @action.bound
    async renderInteractiveFigure(figure: Element) {
        const isExplorer = figure.hasAttribute(
            EXPLORER_EMBEDDED_FIGURE_SELECTOR
        )
        const isMultiDim = figure.hasAttribute("data-is-multi-dim")
        const isGrapherView = figure.hasAttribute(
            GRAPHER_VIEW_EMBEDDED_FIGURE_CONFIG_ATTR
        )

        const embedType: EmbedType = isExplorer
            ? "explorer"
            : isMultiDim
              ? "multiDim"
              : isGrapherView
                ? "grapherView"
                : "grapher"

        const hasPreview = isExplorer ? false : !!figure.querySelector("img")
        if (!shouldProgressiveEmbed() && hasPreview) return

        // Stop observing visibility as soon as possible, that is not before
        // shouldProgressiveEmbed gets a chance to reevaluate a possible change
        // in screen size on mobile (i.e. after a rotation). Stopping before
        // shouldProgressiveEmbed would prevent rendering interactive charts
        // when going from portrait to landscape mode (without page reload).
        this.figuresObserver?.unobserve(figure)

        await match(embedType)
            .with("explorer", () => this.renderExplorerIntoFigure(figure))
            .with("multiDim", () => this.renderMultiDimIntoFigure(figure))
            .with("grapherView", () => this.renderGrapherViewIntoFigure(figure))
            .with("grapher", () => this.renderGrapherIntoFigure(figure))
            .exhaustive()
    }

    setUpGlobalEntitySelectorForEmbeds() {
        const element = globalEntitySelectorElement()
        if (!element) return

        const embeddedDefaultCountriesParam = element.getAttribute(
            GLOBAL_ENTITY_SELECTOR_DEFAULT_COUNTRY
        )

        const [defaultEntityNames, windowEntityNames] = [
            Url.fromQueryParams({
                country: embeddedDefaultCountriesParam || undefined,
            }),
            getWindowUrl(),
        ]
            .map(migrateSelectedEntityNamesParam)
            .map(getSelectedEntityNamesParam)

        this.selection = new SelectionArray(
            windowEntityNames ?? defaultEntityNames
        )

        hydrateGlobalEntitySelectorIfAny(
            this.selection,
            this.graphersAndExplorersToUpdate
        )
    }
}

export const MultiEmbedderSingleton = new MultiEmbedder()
