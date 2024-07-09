import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faRss } from "@fortawesome/free-solid-svg-icons"
import {
    faXTwitter,
    faFacebookSquare,
    faInstagram,
    faThreads,
} from "@fortawesome/free-brands-svg-icons"
import React, { useContext } from "react"
import {
    NewsletterSubscriptionContext,
    NewsletterSubscriptionForm,
} from "../../NewsletterSubscription.js"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import { OwidGdocHomepageContent } from "@ourworldindata/types"
import { DATA_INSIGHTS_ATOM_FEED_NAME } from "../utils.js"
import { AttachmentsContext } from "../OwidGdoc.js"
import { allTopicsInArea } from "../../SiteNavigationTopics.js"

export interface HomepageProps {
    content: OwidGdocHomepageContent
}

const SocialSection = () => {
    return (
        <section
            className="grid grid-cols-12-full-width span-cols-14"
            id="subscribe"
        >
            <section className="homepage-social-ribbon span-cols-8 col-start-2 span-sm-cols-12 col-sm-start-2">
                <h2 className="h2-semibold">Subscribe to our newsletter</h2>
                <div id="newsletter-subscription-root">
                    {/* Hydrated in runSiteTools() */}
                    <NewsletterSubscriptionForm
                        context={NewsletterSubscriptionContext.Homepage}
                    />
                </div>
            </section>
            <section className="homepage-social-ribbon__social-media span-cols-4 span-sm-cols-12 col-sm-start-2">
                <h2 className="h2-semibold">Follow us</h2>
                <ul className="homepage-social-ribbon__social-list">
                    <li>
                        <a
                            href="https://twitter.com/ourworldindata"
                            className="list-item"
                            title="X"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-track-note="homepage_follow_us"
                        >
                            <span className="icon">
                                <FontAwesomeIcon icon={faXTwitter} />
                            </span>
                            <span className="label">X</span>
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://facebook.com/ourworldindata"
                            className="list-item"
                            title="Facebook"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-track-note="homepage_follow_us"
                        >
                            <span className="icon">
                                <FontAwesomeIcon icon={faFacebookSquare} />
                            </span>
                            <span className="label">Facebook</span>
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://www.instagram.com/ourworldindata/"
                            className="list-item"
                            title="Instagram"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-track-note="homepage_follow_us"
                        >
                            <span className="icon">
                                <FontAwesomeIcon icon={faInstagram} />
                            </span>
                            <span className="label">Instagram</span>
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://www.threads.net/@ourworldindata"
                            className="list-item"
                            title="Threads"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-track-note="homepage_follow_us"
                        >
                            <span className="icon">
                                <FontAwesomeIcon icon={faThreads} />
                            </span>
                            <span className="label">Threads</span>
                        </a>
                    </li>
                    <li>
                        <a
                            href="/atom.xml"
                            className="list-item"
                            title="RSS"
                            target="_blank"
                            data-track-note="homepage_follow_us"
                        >
                            <span className="icon">
                                <FontAwesomeIcon icon={faRss} />
                            </span>
                            <span className="label">
                                Research & Writing RSS Feed
                            </span>
                        </a>
                    </li>
                    <li>
                        <a
                            href={`/${DATA_INSIGHTS_ATOM_FEED_NAME}`}
                            className="list-item"
                            title="Data Insights RSS"
                            target="_blank"
                            data-track-note="homepage_follow_us"
                            rel="noopener"
                        >
                            <span className="icon">
                                <FontAwesomeIcon icon={faRss} />
                            </span>
                            <span className="label">
                                Data Insights RSS Feed
                            </span>
                        </a>
                    </li>
                </ul>
            </section>
        </section>
    )
}

const AllTopicsSection = () => {
    const { homepageMetadata } = useContext(AttachmentsContext)
    if (!homepageMetadata) return null
    const { tagGraph } = homepageMetadata
    if (!tagGraph) return null

    // We have to flatten the areas because we can't nest <ul> elements and have them render correctly
    const flattenedAreas = tagGraph.children.map((area) => ({
        ...area,
        children: allTopicsInArea(area),
    }))

    return (
        <section
            id="all-topics"
            className="grid span-cols-12 col-start-2 homepage-topics-section"
        >
            <h2 className="h2-bold span-cols-12">All our topics</h2>
            <p className="body-2-regular span-cols-12">
                All our data, research, and writing — topic by topic.
            </p>
            {flattenedAreas.map((area) => (
                <section
                    key={area.name}
                    className="homepage-topic span-cols-12"
                >
                    <h2 className="homepage-topic__topic-name h3-bold">
                        {area.name}
                    </h2>
                    <ul className="homepage-topic__topic-list display-3-regular">
                        {area.children.map(({ slug, name }) => (
                            <li
                                className="homepage-topic__topic-entry"
                                key={`topic-entry-${slug}`}
                            >
                                <a href={`/${slug}`}>{name}</a>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </section>
    )
}

export const Homepage = (props: HomepageProps): React.ReactElement => {
    const { content } = props

    return (
        <div className="grid grid-cols-12-full-width">
            <ArticleBlocks blocks={content.body} />
            <SocialSection />
            <AllTopicsSection />
        </div>
    )
}
