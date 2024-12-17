import React from "react"
import cx from "classnames"

import Callout from "./Callout.js"
import ChartStory from "./ChartStory.js"
import Scroller from "./Scroller.js"
import Chart from "./Chart.js"
import Donors from "./Donors.js"
import PullQuote from "./PullQuote.js"
import Recirc from "./Recirc.js"
import List from "./List.js"
import NumberedList from "./NumberedList.js"
import Image, { ImageParentContainer } from "./Image.js"
import {
    get,
    OwidEnrichedGdocBlock,
    spansToUnformattedPlainText,
    TocHeadingWithTitleSupertitle,
    Url,
} from "@ourworldindata/utils"
import { CodeSnippet, convertHeadingTextToId } from "@ourworldindata/components"
import SDGGrid from "./SDGGrid.js"
import { BlockErrorBoundary, BlockErrorFallback } from "./BlockErrorBoundary.js"
import { match } from "ts-pattern"
import { renderSpans } from "../utils.js"
import Paragraph from "./Paragraph.js"
import People from "./People.js"
import TableOfContents from "./TableOfContents.js"
import urlSlug from "url-slug"
import { MissingData } from "./MissingData.js"
import { AdditionalCharts } from "./AdditionalCharts.js"
import { ProminentLink } from "./ProminentLink.js"
import { ExpandableParagraph } from "../../blocks/ExpandableParagraph.js"
import { TopicPageIntro } from "./TopicPageIntro.js"
import { KeyInsights } from "./KeyInsights.js"
import { ResearchAndWriting } from "./ResearchAndWriting.js"
import { AllCharts } from "./AllCharts.js"
import Video from "./Video.js"
import { Table } from "./Table.js"
import { ExplorerTiles } from "./ExplorerTiles.js"
import KeyIndicator from "./KeyIndicator.js"
import KeyIndicatorCollection from "./KeyIndicatorCollection.js"
import { PillRow } from "./PillRow.js"
import { HomepageIntro } from "./HomepageIntro.js"
import { HomepageSearch } from "./HomepageSearch.js"
import LatestDataInsightsBlock from "./LatestDataInsightsBlock.js"
import { Socials } from "./Socials.js"
import Person from "./Person.js"

export type Container =
    | "default"
    | "sticky-right-left-column"
    | "sticky-right-left-heading-column"
    | "sticky-right-right-column"
    | "sticky-left-left-column"
    | "sticky-left-right-column"
    | "side-by-side"
    | "summary"
    | "datapage"
    | "key-insight"
    | "about-page"
    | "author-header"

// Each container must have a default layout, usually just full-width
type Layouts = { default: string; [key: string]: string }

// no line-wrapping for easier alphabetisation
// prettier-ignore
const layouts: { [key in Container]: Layouts} = {
    ["default"]: {
        ["align"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["all-charts"]: "col-start-2 span-cols-12",
        ["aside-left"]: "col-start-2 span-cols-3 span-md-cols-10 col-md-start-3",
        ["aside-right"]: "col-start-11 span-cols-3 span-md-cols-10 col-md-start-3",
        ["chart-story"]: "col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["chart"]: "col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["default"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["divider"]: "col-start-2 span-cols-12",
        ["explorer"]: "col-start-2 span-cols-12",
        ["explorer-tiles"]: "grid grid-cols-12 span-cols-12 col-start-2",
        ["gray-section"]: "span-cols-14 grid grid-cols-12-full-width",
        ["heading"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["homepage-search"]: "grid grid-cols-12-full-width span-cols-14",
        ["homepage-intro"]: "grid grid-cols-12-full-width span-cols-14",
        ["horizontal-rule"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["html"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["image--narrow"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12",
        ["image--wide"]: "col-start-4 span-cols-8 col-md-start-2 span-md-cols-12",
        ["image--widest"]: "col-start-2 span-cols-12 col-md-start-2 span-md-cols-12",
        ["image-caption"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["key-indicator"]: "col-start-2 span-cols-12",
        ["key-indicator-collection"]: "grid col-start-2 span-cols-12",
        ["key-insights"]: "col-start-2 span-cols-12",
        ["latest-data-insights"]: "grid grid-cols-12-full-width span-cols-14",
        ["list"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["numbered-list"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 grid-md-cols-10 span-sm-cols-12 col-sm-start-2 grid-sm-cols-12",
        ["pill-row"]: "grid span-cols-14 grid-cols-12-full-width",
        ["pull-quote"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["recirc"]: "col-start-11 span-cols-3 span-rows-3 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["research-and-writing"]: "col-start-2 span-cols-12",
        ["scroller"]: "grid span-cols-12 col-start-2",
        ["sdg-grid"]: "grid col-start-2 span-cols-12 col-lg-start-3 span-lg-cols-10 span-sm-cols-12 col-sm-start-2",
        ["side-by-side"]: "grid span-cols-12 col-start-2",
        ["sticky-left-left-column"]: "grid grid-cols-7 span-cols-7 span-md-cols-10 grid-md-cols-10",
        ["sticky-left-right-column"]: "grid grid-cols-5 span-cols-5 span-md-cols-10 grid-md-cols-10",
        ["sticky-left"]: "grid span-cols-12 col-start-2",
        ["sticky-right-left-column"]: "grid span-cols-5 grid grid-cols-5 span-md-cols-10 grid-md-cols-10 col-md-start-2 span-sm-cols-12 grid-sm-cols-12 col-sm-start-1",
        ["sticky-right-right-column"]: "span-cols-7 grid-cols-7 span-md-cols-10 grid-md-cols-10 col-md-start-2 span-sm-cols-12 grid-sm-cols-12 col-sm-start-1",
        ["sticky-right"]: "grid span-cols-12 col-start-2",
        ["table--narrow"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["table--wide"]: "col-start-2 span-cols-12",
        ["text"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["toc"]: "grid grid-cols-8 col-start-4 span-cols-8 grid-md-cols-10 col-md-start-3 span-md-cols-10 grid-sm-cols-12 span-sm-cols-12 col-sm-start-2",
        ["topic-page-intro"]: "grid col-start-2 span-cols-12",
        ["video"]: "col-start-4 span-cols-8 col-md-start-2 span-md-cols-12",
    },
    ["datapage"]: {
        ["default"]: "col-start-2 span-cols-6 col-lg-start-2 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12",
        ["chart"]: "span-cols-8 span-lg-cols-9 span-md-cols-12",
    },
    ["about-page"]: {
        ["default"]: "grid col-start-2 span-cols-12",
        ["people"]: "col-start-2 span-cols-8 col-md-start-2 span-md-cols-12",
        ["donors"]: "grid grid-cols-12-full-width col-start-1 col-end-limit",
        ["sticky-left-left-column"]: "grid grid-cols-7 span-cols-7 span-md-cols-10 grid-md-cols-10",
        ["sticky-left-right-column"]: "grid grid-cols-5 span-cols-5 span-md-cols-10 grid-md-cols-10",
        ["sticky-left"]: "grid span-cols-12 col-start-2",
        ["sticky-right-left-column"]: "grid span-cols-5 grid grid-cols-5 span-md-cols-10 grid-md-cols-10 col-md-start-2 span-sm-cols-12 grid-sm-cols-12 col-sm-start-1",
        ["sticky-right-right-column"]: "span-cols-7 grid-cols-7 span-md-cols-10 grid-md-cols-10 col-md-start-2 span-sm-cols-12 grid-sm-cols-12 col-sm-start-1",
        ["sticky-right"]: "grid span-cols-12 col-start-2",
    },
    ["author-header"]: {
        ["default"]: "span-cols-8",
        ["image"]: "span-cols-2 span-md-cols-3",
        ["text"]: "span-cols-6 span-md-cols-8 col-sm-start-2 span-sm-cols-12",
        ["socials"]: "span-cols-3 col-sm-start-2 span-sm-cols-12",
    },
    ["sticky-right-left-column"]: {
        ["chart"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-5 col-start-1 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-5 span-cols-5 span-md-cols-10 grid-md-cols-10 span-sm-cols-12 grid-sm-cols-12",
    },
    ["sticky-right-left-heading-column"]: {
        ["default"]: "span-cols-5 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1"
    },
    ["sticky-right-right-column"]: {
        ["chart"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-7 span-md-cols-10 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 span-md-cols-12 grid-md-cols-12",
    },
    ["sticky-left-left-column"]: {
        ["chart"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-7 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 span-md-cols-12 grid-md-cols-12",
    },
    ["sticky-left-right-column"]: {
        ["chart"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-5 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-5 span-cols-5 span-md-cols-10 grid-md-cols-10 span-sm-cols-12 grid-sm-cols-12",
    },
    ["side-by-side"]: {
        ["default"]: "span-cols-6 span-sm-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 grid-sm-cols-12 span-sm-cols-12 ",
    },
    ["summary"]: {
        ["default"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
    },
    ["key-insight"]: {
        ["default"]: "col-start-1 span-cols-5 col-md-start-1 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 span-md-cols-12 grid-md-cols-12",
    },
}

export function getLayout(
    blockType: string = "default",
    containerType: Container = "default"
): string {
    const layout = get(
        layouts,
        [containerType, blockType],
        // fallback to the default for the container
        get(layouts, [containerType, "default"])
    )
    return cx(`article-block__${blockType}`, layout)
}

export default function ArticleBlock({
    b: block,
    containerType = "default",
    toc,
    shouldRenderLinks = true,
}: {
    b: OwidEnrichedGdocBlock
    containerType?: Container
    toc?: TocHeadingWithTitleSupertitle[]
    shouldRenderLinks?: boolean
}) {
    block.type = block.type.toLowerCase() as any // this comes from the user and may not be all lowercase, enforce it here
    if (block.parseErrors.filter(({ isWarning }) => !isWarning).length > 0) {
        return (
            <BlockErrorFallback
                className={getLayout("default", containerType)}
                error={{
                    name: `Error in ${block.type}`,
                    message: block.parseErrors[0].message,
                }}
            />
        )
    }
    const content: any | null = match(block)
        .with({ type: "aside" }, ({ caption, position = "right" }) => (
            <figure
                className={cx(
                    "body-3-medium-italic",
                    getLayout(`aside-${position}`)
                )}
            >
                {caption ? (
                    <figcaption>
                        {renderSpans(caption, shouldRenderLinks)}
                    </figcaption>
                ) : null}
            </figure>
        ))
        .with({ type: "all-charts" }, (block) => (
            <AllCharts
                {...block}
                className={getLayout("all-charts", containerType)}
            />
        ))
        .with({ type: "chart" }, (block) => {
            const { isExplorer, queryStr } = Url.fromURL(block.url)
            const areControlsHidden = queryStr.includes("hideControls=true")
            const layoutSubtype =
                isExplorer && !areControlsHidden ? "explorer" : "chart"
            return (
                <Chart
                    className={getLayout(layoutSubtype, containerType)}
                    d={block}
                    fullWidthOnMobile={true}
                />
            )
        })
        .with({ type: "code" }, (block) => (
            <CodeSnippet
                className={getLayout("code-snippet", containerType)}
                code={block.text.map((text) => text.value).join("\n")}
            />
        ))
        .with({ type: "donors" }, (_block) => (
            <Donors className={getLayout("donors", containerType)} />
        ))
        .with({ type: "scroller" }, (block) => (
            <Scroller
                className={getLayout("scroller", containerType)}
                d={block}
            />
        ))
        .with({ type: "callout" }, (block) => (
            <Callout
                className={getLayout("callout", containerType)}
                block={block}
            />
        ))
        .with({ type: "chart-story" }, (block) => (
            <ChartStory
                d={block}
                className={getLayout("chart-story", containerType)}
            />
        ))
        .with({ type: "image" }, (block) => (
            <figure
                className={cx(
                    "article-block__image",
                    getLayout(`image--${block.size}`, containerType)
                )}
            >
                <Image
                    filename={block.filename}
                    smallFilename={block.smallFilename}
                    alt={block.alt}
                    hasOutline={block.hasOutline}
                    containerType={containerType as ImageParentContainer}
                />
                {block.caption ? (
                    <figcaption
                        className={getLayout("image-caption", containerType)}
                    >
                        {renderSpans(block.caption, shouldRenderLinks)}
                    </figcaption>
                ) : null}
            </figure>
        ))
        .with({ type: "video" }, (block) => (
            <Video
                className={getLayout("video", containerType)}
                url={block.url}
                shouldLoop={block.shouldLoop}
                shouldAutoplay={block.shouldAutoplay}
                caption={block.caption}
                filename={block.filename}
            />
        ))
        .with({ type: "people" }, (block) => (
            <People className={getLayout("people", containerType)}>
                {block.items.map((block, index) => (
                    <ArticleBlock key={index} b={block} />
                ))}
            </People>
        ))
        .with({ type: "people-rows" }, (block) => (
            <People
                className={getLayout("people-rows", containerType)}
                columns={block.columns}
            >
                {block.people.map((block, index) => (
                    <ArticleBlock key={index} b={block} />
                ))}
            </People>
        ))
        .with({ type: "person" }, (block) => <Person person={block} />)
        .with({ type: "pull-quote" }, (block) => (
            <PullQuote
                className={getLayout("pull-quote", containerType)}
                d={block}
            />
        ))
        .with({ type: "recirc" }, (block) => (
            <Recirc className={getLayout("recirc", containerType)} d={block} />
        ))
        .with({ type: "numbered-list" }, (block) => (
            <NumberedList
                className={getLayout("numbered-list", containerType)}
                d={block}
            />
        ))
        .with({ type: "list" }, (block) => (
            <List className={getLayout("list", containerType)} d={block} />
        ))
        .with({ type: "text" }, (block) => {
            return (
                <Paragraph
                    d={block}
                    className={getLayout("text", containerType)}
                    shouldRenderLinks={shouldRenderLinks}
                />
            )
        })
        .with({ type: "simple-text" }, (block) => {
            return block.value
        })
        .with({ type: "heading", level: 1 }, (block) => (
            <h1
                className={cx(
                    "h1-semibold",
                    getLayout("heading", containerType)
                )}
                id={convertHeadingTextToId(block.text)}
            >
                {renderSpans(block.text, shouldRenderLinks)}
                {shouldRenderLinks && (
                    <a
                        className="deep-link"
                        href={`#${convertHeadingTextToId(block.text)}`}
                    />
                )}
            </h1>
        ))
        .with({ type: "heading", level: 2 }, (block) => {
            const { supertitle, text } = block

            const id = supertitle
                ? urlSlug(
                      `${spansToUnformattedPlainText(
                          supertitle
                      )}-${spansToUnformattedPlainText(text)}`
                  )
                : convertHeadingTextToId(block.text)

            return (
                <>
                    {supertitle ? (
                        <div className={getLayout("divider", containerType)} />
                    ) : null}
                    <h2
                        className={cx(
                            "h2-bold",
                            getLayout("heading", containerType),
                            {
                                "has-supertitle": supertitle
                                    ? spansToUnformattedPlainText(supertitle)
                                    : "",
                            }
                        )}
                        id={id}
                    >
                        {supertitle ? (
                            <div className="article-block__heading-supertitle overline-black-caps">
                                {renderSpans(supertitle, shouldRenderLinks)}
                            </div>
                        ) : null}
                        {renderSpans(text)}
                        {shouldRenderLinks && (
                            <a className="deep-link" href={`#${id}`} />
                        )}
                    </h2>
                </>
            )
        })
        .with({ type: "heading", level: 3 }, (block) => {
            const { supertitle, text } = block
            const id = supertitle
                ? urlSlug(
                      `${spansToUnformattedPlainText(
                          supertitle
                      )}-${spansToUnformattedPlainText(text)}`
                  )
                : convertHeadingTextToId(block.text)
            return (
                <h3
                    className={cx(
                        "h3-bold",
                        getLayout("heading", containerType),
                        {
                            "has-supertitle": supertitle
                                ? spansToUnformattedPlainText(supertitle)
                                : undefined,
                        }
                    )}
                    id={id}
                >
                    {supertitle ? (
                        <div className="article-block__heading-supertitle overline-black-caps">
                            {renderSpans(supertitle)}
                        </div>
                    ) : null}
                    {renderSpans(text, shouldRenderLinks)}
                    {shouldRenderLinks && (
                        <a
                            className="deep-link"
                            aria-labelledby={id}
                            href={`#${id}`}
                        />
                    )}
                </h3>
            )
        })
        .with({ type: "heading", level: 4 }, (block) => (
            <h4
                className={cx(
                    "h4-semibold",
                    getLayout("heading", containerType)
                )}
                id={convertHeadingTextToId(block.text)}
            >
                {renderSpans(block.text, shouldRenderLinks)}
            </h4>
        ))
        .with({ type: "heading", level: 5 }, (block) => (
            <h5
                className={cx(
                    "overline-black-caps",
                    getLayout("heading", containerType)
                )}
                id={convertHeadingTextToId(block.text)}
            >
                {renderSpans(block.text, shouldRenderLinks)}
            </h5>
        ))
        .with(
            { type: "heading" },
            // during parsing we take care of level being in a valid range
            () => null
        )
        .with({ type: "html" }, (block) => (
            <div
                className={getLayout("html", containerType)}
                dangerouslySetInnerHTML={{ __html: block.value }}
            />
        ))
        .with({ type: "horizontal-rule" }, () => (
            <hr className={getLayout("horizontal-rule", containerType)} />
        ))
        .with({ type: "sdg-grid" }, (block) => (
            <SDGGrid
                className={getLayout("sdg-grid", containerType)}
                d={block}
            />
        ))
        .with({ type: "sticky-right" }, (block) => {
            const firstBlock = block.left[0]
            let separateHeading = null
            let left = block.left
            if (
                firstBlock?.type === "heading" &&
                block.right[0]?.type !== "chart-story"
            ) {
                separateHeading = firstBlock
                left = block.left.slice(1)
            }
            return (
                <div className={getLayout("sticky-right", containerType)}>
                    {separateHeading && (
                        <ArticleBlock
                            b={separateHeading}
                            containerType="sticky-right-left-heading-column"
                        />
                    )}
                    <div
                        className={cx(
                            getLayout(
                                "sticky-right-left-column",
                                containerType
                            ),
                            { "grid-row-start-2": separateHeading }
                        )}
                    >
                        {left.map((item, i) => (
                            <ArticleBlock
                                key={i}
                                b={item}
                                containerType="sticky-right-left-column"
                            />
                        ))}
                    </div>
                    <div
                        className={cx(
                            getLayout(
                                "sticky-right-right-column",
                                containerType
                            ),
                            {
                                "grid-row-start-2 grid-md-row-start-auto":
                                    separateHeading,
                            }
                        )}
                    >
                        <div className="sticky-column-wrapper grid grid-cols-7 span-cols-7 grid-md-cols-12 span-md-cols-12">
                            {block.right.map((item, i) => (
                                <ArticleBlock
                                    key={i}
                                    b={item}
                                    containerType="sticky-right-right-column"
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )
        })
        .with({ type: "sticky-left" }, (block) => (
            <div className={getLayout("sticky-left", containerType)}>
                <div
                    className={getLayout(
                        "sticky-left-left-column",
                        containerType
                    )}
                >
                    <div className="sticky-column-wrapper grid grid-cols-7 span-cols-7 grid-md-cols-12 span-md-cols-12">
                        {block.left.map((item, i) => (
                            <ArticleBlock
                                key={i}
                                b={item}
                                containerType="sticky-left-left-column"
                            />
                        ))}
                    </div>
                </div>
                <div
                    className={getLayout(
                        "sticky-left-right-column",
                        containerType
                    )}
                >
                    {block.right.map((item, i) => (
                        <ArticleBlock
                            key={i}
                            b={item}
                            containerType="sticky-left-right-column"
                        />
                    ))}
                </div>
            </div>
        ))
        .with({ type: "side-by-side" }, (block) => (
            <div className={getLayout("side-by-side", containerType)}>
                <div className="grid grid-cols-6 span-cols-6 span-sm-cols-12">
                    {block.left.map((item, i) => (
                        <ArticleBlock
                            key={i}
                            b={item}
                            containerType="side-by-side"
                        />
                    ))}
                </div>
                <div className="grid grid-cols-6 span-cols-6 span-sm-cols-12">
                    {block.right.map((item, i) => (
                        <ArticleBlock
                            key={i}
                            b={item}
                            containerType="side-by-side"
                        />
                    ))}
                </div>
            </div>
        ))
        .with({ type: "gray-section" }, (block) => (
            <div className={getLayout("gray-section")}>
                {block.items.map((item, i) => (
                    <ArticleBlock key={i} b={item} />
                ))}
            </div>
        ))
        .with({ type: "prominent-link" }, (block) => (
            <ProminentLink
                className={getLayout("prominent-link", containerType)}
                {...block}
            />
        ))
        .with({ type: "sdg-toc" }, () => {
            return toc ? (
                <TableOfContents
                    toc={toc}
                    title="List of targets and indicators"
                    className={getLayout("toc", containerType)}
                />
            ) : null
        })
        .with({ type: "entry-summary" }, (block) => {
            return (
                <TableOfContents
                    title="Summary"
                    toc={block.items.map((item) => ({
                        ...item,
                        title: item.text,
                        isSubheading: false,
                    }))}
                    className={getLayout("toc", containerType)}
                />
            )
        })
        .with({ type: "missing-data" }, () => (
            <MissingData className={getLayout("missing-data", containerType)} />
        ))
        .with({ type: "additional-charts" }, (block) => (
            <AdditionalCharts
                items={block.items}
                className={getLayout("additional-charts", containerType)}
            />
        ))
        .with({ type: "expandable-paragraph" }, (block) => (
            <ExpandableParagraph
                className={getLayout("expandable-paragraph", containerType)}
            >
                {block.items.map((item, i) => (
                    <ArticleBlock key={i} b={item} />
                ))}
            </ExpandableParagraph>
        ))
        .with({ type: "topic-page-intro" }, (block) => (
            <TopicPageIntro
                {...block}
                className={getLayout("topic-page-intro", containerType)}
            />
        ))
        .with({ type: "key-insights" }, (block) => (
            <KeyInsights
                {...block}
                className={getLayout("key-insights", containerType)}
            />
        ))
        .with({ type: "research-and-writing" }, (block) => (
            <ResearchAndWriting
                {...block}
                className={getLayout("research-and-writing", containerType)}
            />
        ))
        .with({ type: "align" }, (block) => (
            <div
                className={cx(
                    `align-${block.alignment}`,
                    getLayout("align", containerType)
                )}
            >
                {block.content.map((b, i) => (
                    <ArticleBlock key={i} b={b} />
                ))}
            </div>
        ))
        .with({ type: "table" }, (block) => (
            <Table
                className={cx(
                    getLayout(`table--${block.size}`, containerType),
                    `article-block__table--${block.template}`
                )}
                {...block}
            />
        ))
        .with({ type: "blockquote" }, (block) => {
            // If the citation exists and is a URL, it uses the cite attribute
            // If the citation exists and is not a URL, it uses the footer
            // Otherwise, we show nothing for cases where the citation is written in the surrounding text
            const isCitationAUrl = Boolean(
                block.citation && block.citation.startsWith("http")
            )
            const shouldShowCitationInFooter = block.citation && !isCitationAUrl
            const blockquoteProps = isCitationAUrl
                ? { cite: block.citation }
                : {}

            return (
                <blockquote
                    className={cx(getLayout("blockquote", containerType))}
                    {...blockquoteProps}
                >
                    {block.text.map((textBlock, i) => (
                        <Paragraph
                            className="article-block__text"
                            d={textBlock}
                            key={i}
                            shouldRenderLinks={shouldRenderLinks}
                        />
                    ))}

                    {shouldShowCitationInFooter ? (
                        <footer>
                            – <cite>{block.citation}</cite>
                        </footer>
                    ) : null}
                </blockquote>
            )
        })
        .with({ type: "explorer-tiles" }, (block) => (
            <ExplorerTiles
                className={getLayout("explorer-tiles", containerType)}
                {...block}
            />
        ))
        .with({ type: "latest-data-insights" }, () => (
            <LatestDataInsightsBlock
                className={getLayout("latest-data-insights", containerType)}
            />
        ))
        .with({ type: "key-indicator" }, (block) => (
            <KeyIndicator className={getLayout("key-indicator")} d={block} />
        ))
        .with({ type: "key-indicator-collection" }, (block) => (
            <KeyIndicatorCollection
                className={getLayout("key-indicator-collection")}
                d={block}
            />
        ))
        .with({ type: "pill-row" }, (block) => {
            return (
                <PillRow
                    {...block}
                    className={getLayout("pill-row", containerType)}
                />
            )
        })
        .with({ type: "homepage-search" }, (_) => {
            return (
                <HomepageSearch
                    className={getLayout("homepage-search", containerType)}
                />
            )
        })
        .with({ type: "homepage-intro" }, (block) => {
            return (
                <HomepageIntro
                    className={getLayout("homepage-intro")}
                    {...block}
                />
            )
        })
        .with({ type: "socials" }, (block) => (
            <Socials
                className={getLayout("socials", containerType)}
                links={block.links}
            />
        ))
        .exhaustive()

    return (
        <BlockErrorBoundary className={getLayout("default", containerType)}>
            {content}
        </BlockErrorBoundary>
    )
}
