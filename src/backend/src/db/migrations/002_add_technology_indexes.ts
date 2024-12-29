import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTechnologyIndexes1677123456790 implements MigrationInterface {
    name = 'AddTechnologyIndexes1677123456790';

    /**
     * Creates optimized indexes on the technologies table to ensure sub-2 second
     * query performance across various search patterns
     * 
     * @param queryRunner - TypeORM query runner for executing database operations
     * @returns Promise that resolves when all indexes are created
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        // B-tree index for efficient joins on institution lookups
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_tech_institution_btree" 
            ON "technologies" USING btree ("institution_id");
        `);

        // B-tree index for category-based filtering
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_tech_category_btree" 
            ON "technologies" USING btree ("category");
        `);

        // B-tree index for regional/country-based searches
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_tech_country_btree" 
            ON "technologies" USING btree ("country");
        `);

        // GiST index for full-text search on description
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_tech_description_gist" 
            ON "technologies" USING gist (to_tsvector('english', "description"));
        `);

        // Composite B-tree index for combined title and description searches
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_tech_title_desc_composite" 
            ON "technologies" USING btree ("title", "description");
        `);

        // B-tree index for time-based queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_tech_discovered_btree" 
            ON "technologies" USING btree ("discovered_at");
        `);

        // Hash index for exact URL lookups
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_tech_url_hash" 
            ON "technologies" USING hash ("url");
        `);

        // Analyze table statistics to optimize query planning
        await queryRunner.query(`
            ANALYZE "technologies";
        `);
    }

    /**
     * Removes all indexes created by this migration in reverse order
     * 
     * @param queryRunner - TypeORM query runner for executing database operations
     * @returns Promise that resolves when all indexes are dropped
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes in reverse order of creation
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tech_url_hash";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tech_discovered_btree";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tech_title_desc_composite";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tech_description_gist";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tech_country_btree";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tech_category_btree";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tech_institution_btree";`);

        // Analyze table statistics after index removal
        await queryRunner.query(`
            ANALYZE "technologies";
        `);
    }
}