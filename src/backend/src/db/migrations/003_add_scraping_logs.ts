// TypeORM v0.3.0
import { MigrationInterface, QueryRunner, TableColumn, TableIndex, TableForeignKey } from "typeorm";

const MIGRATION_NAME = "AddScrapingLogs1677123456791";

export class AddScrapingLogs implements MigrationInterface {
    name = MIGRATION_NAME;

    constructor() {
        this.name = MIGRATION_NAME;
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns for enhanced error tracking and performance monitoring
        await queryRunner.addColumns("scraping_logs", [
            new TableColumn({
                name: "error_type",
                type: "varchar",
                length: "50",
                isNullable: true,
                comment: "Categorized error type for structured error tracking"
            }),
            new TableColumn({
                name: "stack_trace",
                type: "text",
                isNullable: true,
                comment: "Detailed error stack trace for debugging"
            }),
            new TableColumn({
                name: "metadata",
                type: "jsonb",
                isNullable: true,
                comment: "Flexible storage for additional error context and metadata"
            }),
            new TableColumn({
                name: "items_processed",
                type: "integer",
                isNullable: true,
                comment: "Number of items processed during scraping operation"
            }),
            new TableColumn({
                name: "duration_ms",
                type: "integer",
                isNullable: true,
                comment: "Execution duration in milliseconds"
            })
        ]);

        // Create index for efficient error analysis queries
        await queryRunner.createIndex("scraping_logs", new TableIndex({
            name: "IDX_scraping_logs_error_type",
            columnNames: ["error_type"],
            where: "error_type IS NOT NULL"
        }));

        // Create index for time-based log retrieval
        await queryRunner.createIndex("scraping_logs", new TableIndex({
            name: "IDX_scraping_logs_timestamp",
            columnNames: ["timestamp"]
        }));

        // Create composite index for efficient log retrieval by job
        await queryRunner.createIndex("scraping_logs", new TableIndex({
            name: "IDX_scraping_logs_job_timestamp",
            columnNames: ["job_id", "timestamp"]
        }));

        // Add foreign key constraint to scrape_jobs table
        await queryRunner.createForeignKey("scraping_logs", new TableForeignKey({
            name: "FK_scraping_logs_scrape_jobs",
            columnNames: ["job_id"],
            referencedColumnNames: ["id"],
            referencedTableName: "scrape_jobs",
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraint
        await queryRunner.dropForeignKey("scraping_logs", "FK_scraping_logs_scrape_jobs");

        // Drop indexes
        await queryRunner.dropIndex("scraping_logs", "IDX_scraping_logs_job_timestamp");
        await queryRunner.dropIndex("scraping_logs", "IDX_scraping_logs_timestamp");
        await queryRunner.dropIndex("scraping_logs", "IDX_scraping_logs_error_type");

        // Drop added columns
        await queryRunner.dropColumns("scraping_logs", [
            "error_type",
            "stack_trace", 
            "metadata",
            "items_processed",
            "duration_ms"
        ]);
    }
}