/**
 * @file Logger Configuration
 * @description Defines comprehensive logging configuration for the application with support for
 * console, file, and ELK Stack logging, including structured logging, log rotation, and request tracing
 * @version 1.0.0
 */

import winston from 'winston'; // v3.8.0
import DailyRotateFile from 'winston-daily-rotate-file'; // v4.7.0
import { ElasticsearchTransport } from 'winston-elasticsearch'; // v0.17.0
import { LOG_LEVELS } from '../constants/error.constants';

// Environment variables with defaults
const LOG_FILE_PATH = process.env.LOG_FILE_PATH || 'logs/app-%DATE%.log';
const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const MAX_LOG_SIZE = process.env.MAX_LOG_SIZE || '20m';
const MAX_LOG_FILES = process.env.MAX_LOG_FILES || '14d';

/**
 * Interface defining the structure of logger configuration
 */
interface LoggerConfig {
  console: {
    level: string;
    handleExceptions: boolean;
    format: winston.Logform.Format;
    colorize: boolean;
  };
  file: {
    level: string;
    filename: string;
    datePattern: string;
    maxSize: string;
    maxFiles: string;
    format: winston.Logform.Format;
    zippedArchive: boolean;
  };
  elasticsearch: {
    level: string;
    clientOpts: {
      node: string;
      auth?: {
        username: string;
        password: string;
      };
      ssl?: {
        rejectUnauthorized: boolean;
        ca: string;
      };
    };
    indexPrefix: string;
    indexSuffixPattern: string;
    mappingTemplate: object;
    format: winston.Logform.Format;
  };
}

/**
 * Creates a standardized log format with timestamp, colorization, and structured data
 */
const getLogFormat = (): winston.Logform.Format => {
  return winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'label']
    }),
    winston.format((info) => {
      // Add trace ID from async context if available
      const traceId = global?.asyncLocalStorage?.getStore()?.get('traceId');
      if (traceId) {
        info.traceId = traceId;
      }
      return info;
    })(),
    winston.format((info) => {
      // Add request metadata if available
      const req = global?.asyncLocalStorage?.getStore()?.get('request');
      if (req) {
        info.request = {
          url: req.url,
          method: req.method,
          statusCode: req.statusCode
        };
      }
      return info;
    })(),
    winston.format((info) => {
      // Mask sensitive data
      if (info.metadata?.password) {
        info.metadata.password = '***';
      }
      if (info.metadata?.token) {
        info.metadata.token = '***';
      }
      return info;
    })(),
    winston.format.json()
  );
};

/**
 * Logger configuration object implementing the LoggerConfig interface
 */
export const loggerConfig: LoggerConfig = {
  console: {
    level: LOG_LEVELS.INFO,
    handleExceptions: true,
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      getLogFormat()
    ),
    colorize: true
  },

  file: {
    level: LOG_LEVELS.INFO,
    filename: LOG_FILE_PATH,
    datePattern: 'YYYY-MM-DD',
    maxSize: MAX_LOG_SIZE,
    maxFiles: MAX_LOG_FILES,
    format: getLogFormat(),
    zippedArchive: true
  },

  elasticsearch: {
    level: LOG_LEVELS.INFO,
    clientOpts: {
      node: ELASTICSEARCH_NODE,
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
      },
      ssl: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        ca: process.env.ELASTICSEARCH_CA || ''
      }
    },
    indexPrefix: 'tech-transfer-logs',
    indexSuffixPattern: 'YYYY.MM.DD',
    mappingTemplate: {
      index_patterns: ['tech-transfer-logs-*'],
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1,
        index: {
          refresh_interval: '5s'
        }
      },
      mappings: {
        dynamic_templates: [
          {
            strings_as_keywords: {
              match_mapping_type: 'string',
              mapping: {
                type: 'keyword'
              }
            }
          }
        ],
        properties: {
          '@timestamp': { type: 'date' },
          level: { type: 'keyword' },
          message: { type: 'text' },
          traceId: { type: 'keyword' },
          metadata: { type: 'object' }
        }
      }
    },
    format: getLogFormat()
  }
};