import React, { useEffect, useRef } from "react"
import { TagGraphNode } from "@ourworldindata/utils"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import { SiteNavigationTopic } from "./SiteNavigationTopic.js"
import { allTopicsInArea } from "./SiteNavigationTopics.js"

export const SiteMobileArea = ({
    area,
    isActive,
    toggleArea,
}: {
    area: TagGraphNode
    isActive: boolean
    toggleArea: (category: TagGraphNode) => void
}) => {
    const categoryRef = useRef<HTMLLIElement>(null)

    useEffect(() => {
        if (isActive && categoryRef.current) {
            categoryRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [isActive])

    return (
        <li key={area.slug} className="SiteMobileCategory" ref={categoryRef}>
            <SiteNavigationToggle
                ariaLabel={isActive ? `Collapse ${area}` : `Expand ${area}`}
                isActive={isActive}
                onToggle={() => toggleArea(area)}
                dropdown={
                    <ul>
                        {allTopicsInArea(area).map((topic) => (
                            <SiteNavigationTopic
                                key={topic.slug}
                                topic={topic}
                            />
                        ))}
                    </ul>
                }
                withCaret={true}
            >
                {area.name}
            </SiteNavigationToggle>
        </li>
    )
}
