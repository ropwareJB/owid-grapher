import ReactDOM from "react-dom"
import React from "react"
import { getWindowQueryParams } from "@ourworldindata/utils"
import { getClient, siteSearch, SiteSearchResults } from "./searchClient.js"
import { SearchResults } from "../site/SearchResults.js"
import { observer } from "mobx-react"
import { action, observable, runInAction } from "mobx"
import { SearchAutocomplete } from "./SearchAutocomplete.js"
import { Configure, InstantSearch } from "react-instantsearch-hooks-web"

@observer
export class SearchPageMain extends React.Component {
    @observable query: string = getWindowQueryParams().q || ""
    lastQuery?: string

    @observable.ref results?: SiteSearchResults

    async runSearch(query: string) {
        const results = await siteSearch(query)

        if (this.lastQuery !== query) {
            // Don't need this result anymore
            return
        }

        runInAction(() => (this.results = results))
    }

    @action.bound onSearch(query: string) {
        this.lastQuery = query
        if (query) {
            this.runSearch(query)
        } else {
            this.results = undefined
        }
    }

    componentDidMount() {
        const input = document.querySelector(
            ".SearchPage > main > form input"
        ) as HTMLInputElement
        input.value = this.query
        input.focus()
        this.onSearch(this.query)
    }

    // dispose?: IReactionDisposer
    // componentDidMount() {
    //     this.dispose = autorun(() => this.onSearch(this.query))
    // }

    // componentWillUnmount() {
    //     if (this.dispose) this.dispose()
    // }

    @action.bound onSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
        this.query = e.currentTarget.value
    }

    render() {
        return (
            <React.Fragment>
                {this.results && <SearchResults results={this.results} />}
            </React.Fragment>
        )
    }
}

export function runSearchPage() {
    const searchClient = getClient()
    ReactDOM.render(
        <InstantSearch indexName="pages" searchClient={searchClient}>
            <Configure distinct={1} />
            <SearchAutocomplete />
        </InstantSearch>,
        document.querySelector(".searchWrapper")
    )
}
