import React, { useLayoutEffect, useState } from "react"
import { TagGraphNode, TagGraphRoot } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import classnames from "classnames"
import { SiteNavigationTopic } from "./SiteNavigationTopic.js"

// suppress useLayoutEffect (and its warnings) when not running in a browser
// https://gist.github.com/gaearon/e7d97cdf38a2907924ea12e4ebdf3c85?permalink_comment_id=4150784#gistcomment-4150784

// this is ok here because the layout effect below doesn't do anything until an
// other effect already triggered a paint, so there is no mismatch between the
// server and client on first paint (which is what the warning is about)
// eslint-disable-next-line @typescript-eslint/no-empty-function
if (typeof window === "undefined") React.useLayoutEffect = () => {}

export const SiteNavigationTopics = ({
    tagGraph,
    onClose,
    className,
}: {
    tagGraph: TagGraphRoot | null
    onClose: () => void
    className?: string
}) => {
    const [activeCategory, setActiveCategory] = useState<TagGraphNode | null>(
        tagGraph?.children[0] || null
    )

    const [numTopicColumns, setNumTopicColumns] = useState(1)

    // calculate the number of 10 topic columns we need based on the number of topics
    // using useLayoutEffect to avoid a flash of the wrong number of columns when switching categories
    useLayoutEffect(() => {
        if (activeCategory) {
            const topics = allTopicsInArea(activeCategory)
            const numColumns = Math.ceil(topics.length / 10)
            setNumTopicColumns(numColumns)
        }
    }, [activeCategory])

    const stopPropagation = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    return tagGraph?.children ? (
        <div
            className={classnames("SiteNavigationTopics", className)}
            // hack: this is to make sure the overlay is closed when clicking
            // the - visually - empty space to the right of the topics menu. A
            // click on the overlay in this area looks like a click on the
            // overlay but is actually a click on the remaining grid columns of
            // the menu. We then need to use stopPropagation to prevent clicks
            // within the visible portion of the menu to bubble up and close the
            // menu (and the overlay).
            onClick={onClose}
        >
            <div className="categories" onClick={stopPropagation}>
                <div className="heading">Browse by topic</div>
                <ul>
                    {tagGraph.children.map((category) => (
                        <li key={category.slug}>
                            <button
                                aria-label={`Toggle ${category.name} sub-menu`}
                                onClick={() => {
                                    setActiveCategory(category)
                                }}
                                className={classnames({
                                    active: category === activeCategory,
                                })}
                            >
                                <span>{category.name}</span>
                                <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            {activeCategory && (
                <ul
                    className={classnames("topics", {
                        "columns-medium": numTopicColumns === 2,
                        "columns-large": numTopicColumns > 2,
                    })}
                    onClick={stopPropagation}
                >
                    {allTopicsInArea(activeCategory).map((topic) => (
                        <SiteNavigationTopic key={topic.slug} topic={topic} />
                    ))}
                </ul>
            )}
        </div>
    ) : null
}

export const allTopicsInArea = (area: TagGraphNode): TagGraphNode[] => {
    return [
        ...area.children,
        ...area.children.flatMap((child) => allTopicsInArea(child)),
    ]
}
