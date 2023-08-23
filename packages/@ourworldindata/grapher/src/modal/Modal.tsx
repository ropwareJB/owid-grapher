import React from "react"
import { observer } from "mobx-react"
import { action, computed } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTimes } from "@fortawesome/free-solid-svg-icons"
import { Bounds } from "@ourworldindata/utils"

@observer
export class Modal extends React.Component<{
    bounds: Bounds
    onDismiss: () => void
    title?: string
    children?: React.ReactNode
    isHeightFixed?: boolean
}> {
    contentRef: React.RefObject<HTMLDivElement> = React.createRef()

    @computed private get bounds(): Bounds {
        return this.props.bounds
    }

    @computed private get title(): string | undefined {
        return this.props.title
    }

    @computed private get isHeightFixed(): boolean {
        return this.props.isHeightFixed ?? false
    }

    @action.bound onDocumentClick(e: MouseEvent): void {
        // check if the click was outside of the modal
        if (
            this.contentRef?.current &&
            !this.contentRef.current.contains(e.target as Node) &&
            // check that the target is still mounted to the document; we also get click events on nodes that have since been removed by React
            document.contains(e.target as Node)
        )
            this.props.onDismiss()
    }

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") this.props.onDismiss()
    }

    componentDidMount(): void {
        document.addEventListener("click", this.onDocumentClick)
        document.addEventListener("keydown", this.onDocumentKeyDown)
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onDocumentClick)
        document.removeEventListener("keydown", this.onDocumentKeyDown)
    }

    render(): JSX.Element {
        const { bounds } = this

        const contentStyle = {
            left: bounds.left,
            width: bounds.width,
            maxHeight: bounds.height,
            height: this.isHeightFixed ? bounds.height : undefined,
            // center vertically
            top: "50%",
            transform: `translateY(-50%)`,
        }

        return (
            <div className="modalOverlay">
                <div className="modalWrapper">
                    <div
                        className="modalContent"
                        style={contentStyle}
                        ref={this.contentRef}
                    >
                        <div className="modalHeader">
                            {this.title && (
                                <h2 className="modalTitle">{this.title}</h2>
                            )}
                            <button
                                className="modalDismiss"
                                onClick={this.props.onDismiss}
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className="modalScrollable">
                            {this.props.children}
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}
