import { MigrationInterface, QueryRunner } from "typeorm"

export class FillChartIdInChartConfig1711487196262
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE charts
            SET config = JSON_REPLACE(config, '$.hideLinesOutsideTolerance', 'true')
            WHERE
                type='ScatterPlot'
            AND
                slug IN (
                  'stunting-vs-level-of-prosperity-over-time',
                  'growth-of-income-and-trade'
                )
        `
    }

    public async down(): Promise<void> {
        return
    }
}
