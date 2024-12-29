/**
 * @fileoverview Initial database migration schema implementing core tables with TimescaleDB integration,
 * advanced security features, and optimized performance configurations for the technology transfer platform.
 * @version 1.0.0
 */

import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'; // ^0.3.0
import { postgresConfig } from '../../config/database.config';

const MIGRATION_NAME = 'InitialSchema1677123456789';
const INSTITUTION_TYPES = ['US_UNIVERSITY', 'INTERNATIONAL_UNIVERSITY', 'FEDERAL_LAB'];
const ENCRYPTION_ALGORITHM = 'AES-256-CBC';

export class InitialSchema implements MigrationInterface {
    name = MIGRATION_NAME;

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable required extensions
        await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "timescaledb";');
        await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

        // Create institutions table
        await queryRunner.createTable(new Table({
            name: 'institutions',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'gen_random_uuid()',
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'type',
                    type: 'enum',
                    enum: INSTITUTION_TYPES,
                    isNullable: false,
                },
                {
                    name: 'base_url',
                    type: 'varchar',
                    length: '512',
                    isNullable: false,
                },
                {
                    name: 'active',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'rate_limit',
                    type: 'integer',
                    default: 1,
                },
                {
                    name: 'created_at',
                    type: 'timestamptz',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updated_at',
                    type: 'timestamptz',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);

        // Create technologies table as TimescaleDB hypertable
        await queryRunner.createTable(new Table({
            name: 'technologies',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'gen_random_uuid()',
                },
                {
                    name: 'institution_id',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'title',
                    type: 'varchar',
                    length: '512',
                    isNullable: false,
                },
                {
                    name: 'description',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'url',
                    type: 'varchar',
                    length: '1024',
                    isNullable: false,
                },
                {
                    name: 'discovered_at',
                    type: 'timestamptz',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updated_at',
                    type: 'timestamptz',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
            foreignKeys: [{
                columnNames: ['institution_id'],
                referencedTableName: 'institutions',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }],
        }), true);

        // Convert technologies to TimescaleDB hypertable
        await queryRunner.query(
            `SELECT create_hypertable('technologies', 'discovered_at', chunk_time_interval => INTERVAL '1 day');`
        );

        // Create users table with encryption
        await queryRunner.createTable(new Table({
            name: 'users',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'gen_random_uuid()',
                },
                {
                    name: 'email',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                    isUnique: true,
                },
                {
                    name: 'password_hash',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'profile',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'last_login',
                    type: 'timestamptz',
                    isNullable: true,
                },
                {
                    name: 'created_at',
                    type: 'timestamptz',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updated_at',
                    type: 'timestamptz',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);

        // Create scrape_jobs table
        await queryRunner.createTable(new Table({
            name: 'scrape_jobs',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'gen_random_uuid()',
                },
                {
                    name: 'institution_id',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'items_processed',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'start_time',
                    type: 'timestamptz',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'end_time',
                    type: 'timestamptz',
                    isNullable: true,
                },
            ],
            foreignKeys: [{
                columnNames: ['institution_id'],
                referencedTableName: 'institutions',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }],
        }), true);

        // Create scrape_logs table as TimescaleDB hypertable
        await queryRunner.createTable(new Table({
            name: 'scrape_logs',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'gen_random_uuid()',
                },
                {
                    name: 'job_id',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'level',
                    type: 'varchar',
                    length: '20',
                    isNullable: false,
                },
                {
                    name: 'message',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'timestamp',
                    type: 'timestamptz',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
            foreignKeys: [{
                columnNames: ['job_id'],
                referencedTableName: 'scrape_jobs',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }],
        }), true);

        // Convert scrape_logs to TimescaleDB hypertable
        await queryRunner.query(
            `SELECT create_hypertable('scrape_logs', 'timestamp', chunk_time_interval => INTERVAL '1 hour');`
        );

        // Create optimized indexes
        await queryRunner.createIndex('technologies', new TableIndex({
            name: 'idx_technologies_institution_discovered',
            columnNames: ['institution_id', 'discovered_at'],
        }));

        await queryRunner.createIndex('technologies', new TableIndex({
            name: 'idx_technologies_title_description',
            columnNames: ['title', 'description'],
            using: 'GIN',
        }));

        // Set up retention policies
        await queryRunner.query(`
            SELECT add_retention_policy('scrape_logs', INTERVAL '90 days');
            SELECT add_compression_policy('technologies', INTERVAL '7 days');
        `);

        // Create audit logging function and trigger
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION audit_log_changes()
            RETURNS TRIGGER AS $$
            BEGIN
                INSERT INTO audit_logs (
                    table_name,
                    record_id,
                    action,
                    old_data,
                    new_data,
                    user_id,
                    timestamp
                ) VALUES (
                    TG_TABLE_NAME,
                    NEW.id,
                    TG_OP,
                    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
                    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
                    current_user,
                    CURRENT_TIMESTAMP
                );
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Apply audit triggers to tables
        const auditedTables = ['institutions', 'technologies', 'users', 'scrape_jobs'];
        for (const table of auditedTables) {
            await queryRunner.query(`
                CREATE TRIGGER ${table}_audit_trigger
                AFTER INSERT OR UPDATE OR DELETE ON ${table}
                FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove audit triggers
        const auditedTables = ['institutions', 'technologies', 'users', 'scrape_jobs'];
        for (const table of auditedTables) {
            await queryRunner.query(`DROP TRIGGER IF EXISTS ${table}_audit_trigger ON ${table};`);
        }
        await queryRunner.query('DROP FUNCTION IF EXISTS audit_log_changes();');

        // Remove retention policies
        await queryRunner.query(`
            SELECT remove_retention_policy('scrape_logs');
            SELECT remove_compression_policy('technologies');
        `);

        // Drop tables in correct order
        await queryRunner.dropTable('scrape_logs', true, true);
        await queryRunner.dropTable('scrape_jobs', true, true);
        await queryRunner.dropTable('users', true, true);
        await queryRunner.dropTable('technologies', true, true);
        await queryRunner.dropTable('institutions', true, true);

        // Remove extensions
        await queryRunner.query('DROP EXTENSION IF EXISTS "timescaledb";');
        await queryRunner.query('DROP EXTENSION IF EXISTS "pgcrypto";');
    }
}