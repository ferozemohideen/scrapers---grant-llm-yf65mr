/**
 * @fileoverview Central hub for parser functionality that exports a unified interface
 * for HTML and PDF parsing capabilities. Implements a factory pattern for parser instantiation
 * and provides comprehensive type safety and error handling.
 * @version 1.0.0
 */

import { HTMLParser, HTMLParserOptions, ParsedHTMLResult } from './html.parser';
import PDFParser, { PDFParserOptions, ParsedPDFResult } from './pdf.parser';
import { ERROR_TYPES } from '../../constants/scraper.constants';
import { ScraperError } from '../../interfaces/scraper.interface';

/**
 * Enum defining supported parser types
 */
export enum ParserType {
    HTML = 'html',
    PDF = 'pdf'
}

/**
 * Base interface for parser options
 */
export interface BaseParserOptions {
    throwOnError?: boolean;
    timeout?: number;
    retryAttempts?: number;
}

/**
 * Union type for all parser results
 */
export type ParserResult = ParsedHTMLResult | ParsedPDFResult;

/**
 * Custom error class for parser-specific errors
 */
export class ParserError extends Error {
    public readonly code: string;
    public readonly details: Record<string, any>;

    constructor(type: ERROR_TYPES, message: string, details: Record<string, any> = {}) {
        super(message);
        this.name = 'ParserError';
        this.code = type;
        this.details = details;
    }
}

/**
 * Factory function to get appropriate parser instance based on type
 * @param type Type of parser to instantiate
 * @param options Parser configuration options
 * @returns Configured parser instance
 * @throws ParserError if validation fails
 */
export function getParser(
    type: ParserType,
    options: HTMLParserOptions | PDFParserOptions & BaseParserOptions
): HTMLParser | PDFParser {
    try {
        validateParserOptions(type, options);

        switch (type) {
            case ParserType.HTML:
                return new HTMLParser(options as HTMLParserOptions);
            case ParserType.PDF:
                return new PDFParser(options as PDFParserOptions);
            default:
                throw new ParserError(
                    ERROR_TYPES.VALIDATION_ERROR,
                    `Unsupported parser type: ${type}`,
                    { supportedTypes: Object.values(ParserType) }
                );
        }
    } catch (error) {
        if (error instanceof ParserError) {
            throw error;
        }
        throw new ParserError(
            ERROR_TYPES.VALIDATION_ERROR,
            `Parser initialization failed: ${error.message}`,
            { type, options }
        );
    }
}

/**
 * Validates parser options based on type
 * @param type Parser type
 * @param options Parser options to validate
 * @throws ParserError if validation fails
 */
function validateParserOptions(
    type: ParserType,
    options: HTMLParserOptions | PDFParserOptions & BaseParserOptions
): void {
    if (!options || typeof options !== 'object') {
        throw new ParserError(
            ERROR_TYPES.VALIDATION_ERROR,
            'Invalid parser options',
            { type, options }
        );
    }

    // Validate base options
    if (options.timeout && (typeof options.timeout !== 'number' || options.timeout <= 0)) {
        throw new ParserError(
            ERROR_TYPES.VALIDATION_ERROR,
            'Invalid timeout value',
            { timeout: options.timeout }
        );
    }

    if (options.retryAttempts && (typeof options.retryAttempts !== 'number' || options.retryAttempts < 0)) {
        throw new ParserError(
            ERROR_TYPES.VALIDATION_ERROR,
            'Invalid retry attempts value',
            { retryAttempts: options.retryAttempts }
        );
    }

    // Type-specific validation
    switch (type) {
        case ParserType.HTML:
            validateHTMLOptions(options as HTMLParserOptions);
            break;
        case ParserType.PDF:
            validatePDFOptions(options as PDFParserOptions);
            break;
    }
}

/**
 * Validates HTML parser specific options
 * @param options HTML parser options
 * @throws ParserError if validation fails
 */
function validateHTMLOptions(options: HTMLParserOptions): void {
    if (!options.selectors || typeof options.selectors !== 'object') {
        throw new ParserError(
            ERROR_TYPES.VALIDATION_ERROR,
            'HTML parser requires valid selectors configuration',
            { selectors: options.selectors }
        );
    }

    if (Object.keys(options.selectors).length === 0) {
        throw new ParserError(
            ERROR_TYPES.VALIDATION_ERROR,
            'At least one selector must be specified',
            { selectors: options.selectors }
        );
    }
}

/**
 * Validates PDF parser specific options
 * @param options PDF parser options
 * @throws ParserError if validation fails
 */
function validatePDFOptions(options: PDFParserOptions): void {
    if (options.maxFileSize && (typeof options.maxFileSize !== 'number' || options.maxFileSize <= 0)) {
        throw new ParserError(
            ERROR_TYPES.VALIDATION_ERROR,
            'Invalid maxFileSize value',
            { maxFileSize: options.maxFileSize }
        );
    }

    if (options.securityOptions) {
        validatePDFSecurityOptions(options.securityOptions);
    }
}

/**
 * Validates PDF security options
 * @param securityOptions PDF security options
 * @throws ParserError if validation fails
 */
function validatePDFSecurityOptions(securityOptions: PDFParserOptions['securityOptions']): void {
    if (typeof securityOptions.maxPages !== 'number' || securityOptions.maxPages <= 0) {
        throw new ParserError(
            ERROR_TYPES.VALIDATION_ERROR,
            'Invalid maxPages value in security options',
            { securityOptions }
        );
    }

    if (typeof securityOptions.allowEncrypted !== 'boolean') {
        throw new ParserError(
            ERROR_TYPES.VALIDATION_ERROR,
            'allowEncrypted must be a boolean in security options',
            { securityOptions }
        );
    }
}

// Export all required types and classes
export {
    HTMLParser,
    HTMLParserOptions,
    ParsedHTMLResult,
    PDFParser,
    PDFParserOptions,
    ParsedPDFResult,
    ScraperError
};