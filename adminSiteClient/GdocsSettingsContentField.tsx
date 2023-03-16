import React from "react"
import { Input, InputProps } from "antd"
import {
    OwidArticleType,
    OwidArticleContent,
    OwidArticleErrorMessage,
    OwidArticleErrorMessageType,
} from "@ourworldindata/utils"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"
import { getPropertyMostCriticalError } from "./gdocsValidation.js"
import { TextAreaProps } from "antd/lib/input/TextArea.js"

export const GdocsSettingsContentField = ({
    gdoc,
    property,
    render = (props) => <GdocsSettingsTextField {...props} />,
    errors,
}: {
    gdoc: OwidArticleType
    property: keyof OwidArticleContent
    render?: ({
        name,
        value,
        errorType,
    }: {
        name: string
        value: string
        errorType?: OwidArticleErrorMessageType
    }) => JSX.Element
    errors?: OwidArticleErrorMessage[]
}) => {
    const error = getPropertyMostCriticalError(property, errors)

    return (
        <div className="form-group">
            <label htmlFor={property}>
                <span className="text-capitalize">{property}</span>
            </label>
            <div className="edit-in-gdocs">
                <GdocsEditLink gdocId={gdoc.id} />
                {render({
                    name: property,
                    value: gdoc.content[property],
                    errorType: error?.type,
                })}
            </div>

            <GdocsErrorHelp error={error} />
        </div>
    )
}

export const GdocsSettingsTextField = ({
    name,
    value,
    errorType,
    inputProps,
}: {
    name: string
    value: string
    errorType?: OwidArticleErrorMessageType
    inputProps?: InputProps
}) => (
    <Input
        addonBefore={`${name}:`}
        value={value}
        status={errorType}
        id={name}
        readOnly
        {...inputProps}
    />
)

export const GdocsSettingsTextArea = ({
    name,
    value,
    errorType,
    inputProps,
}: {
    name: string
    value: string
    errorType?: OwidArticleErrorMessageType
    inputProps?: TextAreaProps
}) => (
    <Input.TextArea
        value={value}
        status={errorType}
        id={name}
        readOnly
        {...inputProps}
    />
)
