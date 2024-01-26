export const ExplorerVariablesTableName = "explorer_variables"
export interface ExplorerVariablesRowForInsert {
    explorerSlug: string
    id?: number
    variableId: number
}
export type ExplorerVariablesRow = Required<ExplorerVariablesRowForInsert>
