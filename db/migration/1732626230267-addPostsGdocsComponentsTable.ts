import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostsGdocsComponentsTable1732626230267
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
CREATE TABLE posts_gdocs_components (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gdocId VARCHAR(255),
    config JSON,
    parent VARCHAR(1024),
    path VARCHAR(1024),
    FOREIGN KEY (gdocId) REFERENCES posts_gdocs(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_gdocId (gdocId)
) ENGINE=InnoDB;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE posts_gdocs_components;`)
    }
}
