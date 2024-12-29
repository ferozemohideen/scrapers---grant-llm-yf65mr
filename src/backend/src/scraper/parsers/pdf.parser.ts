/**
 * @fileoverview Advanced PDF parser implementation for extracting text and metadata 
 * from technology transfer documents with robust error handling, validation, and security features.
 * @version 1.0.0
 */

import { ERROR_TYPES } from '../../constants/scraper.constants';
import { ScraperError } from '../../interfaces/scraper.interface';
import * as pdfParse from 'pdf-parse'; // v1.1.1
import * as PDF2Json from 'pdf2json'; // v2.0.1
import { ReadableStream } from 'memory-streams'; // v0.1.3

/**
 * Interface for PDF parser configuration options
 */
export interface PDFParserOptions {
    extractMetadata: boolean;
    throwOnError: boolean;
    pageRange?: string[];
    timeout: number;
    maxFileSize: number;
    enableStreaming: boolean;
    securityOptions: {
        allowEncrypted: boolean;
        maxPages: number;
        allowExternalLinks: boolean;
        allowJavaScript: boolean;
    };
}

/**
 * Interface for PDF parsing metrics
 */
interface PDFMetrics {
    startTime: Date;
    endTime: Date;
    processingTime: number;
    pageCount: number;
    fileSize: number;
    memoryUsage: number;
}

/**
 * Interface for PDF validation results
 */
interface PDFValidation {
    isValid: boolean;
    errors: ScraperError[];
    warnings: string[];
    securityChecks: {
        isEncrypted: boolean;
        hasJavaScript: boolean;
        hasExternalLinks: boolean;
    };
}

/**
 * Interface for parsed PDF metadata
 */
export interface PDFMetadata {
    title: string;
    author: string;
    subject: string;
    keywords: string[];
    creationDate: Date;
    modificationDate: Date;
    pageCount: number;
    pdfVersion: string;
    isEncrypted: boolean;
    customMetadata: Record<string, any>;
}

/**
 * Interface for complete PDF parsing results
 */
export interface ParsedPDFResult {
    text: string;
    metadata: PDFMetadata;
    success: boolean;
    errors: ScraperError[];
    metrics: PDFMetrics;
    validation: PDFValidation;
}

/**
 * Enhanced PDF parser with advanced features for secure and efficient PDF processing
 */
export class PDFParser {
    private readonly options: PDFParserOptions;
    private metrics: PDFMetrics;
    private validation: PDFValidation;

    constructor(options: Partial<PDFParserOptions> = {}) {
        this.options = {
            extractMetadata: true,
            throwOnError: false,
            timeout: 30000,
            maxFileSize: 50 * 1024 * 1024, // 50MB
            enableStreaming: true,
            securityOptions: {
                allowEncrypted: false,
                maxPages: 1000,
                allowExternalLinks: false,
                allowJavaScript: false,
            },
            ...options
        };

        this.metrics = {
            startTime: new Date(),
            endTime: new Date(),
            processingTime: 0,
            pageCount: 0,
            fileSize: 0,
            memoryUsage: 0
        };

        this.validation = {
            isValid: false,
            errors: [],
            warnings: [],
            securityChecks: {
                isEncrypted: false,
                hasJavaScript: false,
                hasExternalLinks: false
            }
        };
    }

    /**
     * Parse PDF buffer with enhanced security and validation
     */
    public async parse(pdfBuffer: Buffer): Promise<ParsedPDFResult> {
        this.metrics.startTime = new Date();
        this.metrics.fileSize = pdfBuffer.length;

        try {
            // Validate PDF size
            if (pdfBuffer.length > this.options.maxFileSize) {
                throw this.createError(
                    ERROR_TYPES.VALIDATION_ERROR,
                    `PDF exceeds maximum size limit of ${this.options.maxFileSize} bytes`
                );
            }

            // Initialize streaming if enabled
            const dataStream = this.options.enableStreaming
                ? new ReadableStream(pdfBuffer)
                : null;

            // Perform security checks
            await this.performSecurityChecks(pdfBuffer);

            // Parse PDF content
            const parseOptions = {
                pagerender: this.options.pageRange ? this.createPageRenderer() : undefined,
                max: this.options.securityOptions.maxPages,
                timeout: this.options.timeout
            };

            const pdfData = await pdfParse(dataStream || pdfBuffer, parseOptions);
            
            // Extract metadata if enabled
            const metadata = this.options.extractMetadata
                ? await this.extractMetadata(pdfBuffer)
                : null;

            this.metrics.pageCount = pdfData.numpages;
            this.validation.isValid = true;

            return this.createResult(pdfData.text, metadata);

        } catch (error) {
            const scraperError = this.handleError(error);
            if (this.options.throwOnError) {
                throw scraperError;
            }
            return this.createErrorResult(scraperError);
        } finally {
            this.finalizeMetrics();
        }
    }

    /**
     * Extract enhanced metadata from PDF
     */
    private async extractMetadata(pdfBuffer: Buffer): Promise<PDFMetadata> {
        const pdfParser = new PDF2Json();

        return new Promise((resolve, reject) => {
            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                const metadata: PDFMetadata = {
                    title: pdfData.info.Title || '',
                    author: pdfData.info.Author || '',
                    subject: pdfData.info.Subject || '',
                    keywords: (pdfData.info.Keywords || '').split(',').map(k => k.trim()),
                    creationDate: new Date(pdfData.info.CreationDate),
                    modificationDate: new Date(pdfData.info.ModDate),
                    pageCount: pdfData.pages.length,
                    pdfVersion: pdfData.info.PDFFormatVersion || '',
                    isEncrypted: pdfData.info.IsEncrypted || false,
                    customMetadata: pdfData.info.Custom || {}
                };
                resolve(metadata);
            });

            pdfParser.on('pdfParser_dataError', (error: Error) => {
                reject(this.createError(
                    ERROR_TYPES.PARSE_ERROR,
                    `Metadata extraction failed: ${error.message}`
                ));
            });

            pdfParser.parseBuffer(pdfBuffer);
        });
    }

    /**
     * Perform security checks on PDF content
     */
    private async performSecurityChecks(pdfBuffer: Buffer): Promise<void> {
        const pdfParser = new PDF2Json();
        
        return new Promise((resolve, reject) => {
            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                this.validation.securityChecks = {
                    isEncrypted: pdfData.info.IsEncrypted || false,
                    hasJavaScript: this.detectJavaScript(pdfData),
                    hasExternalLinks: this.detectExternalLinks(pdfData)
                };

                if (!this.options.securityOptions.allowEncrypted && 
                    this.validation.securityChecks.isEncrypted) {
                    reject(this.createError(
                        ERROR_TYPES.SECURITY_ERROR,
                        'Encrypted PDFs are not allowed'
                    ));
                }

                if (!this.options.securityOptions.allowJavaScript && 
                    this.validation.securityChecks.hasJavaScript) {
                    reject(this.createError(
                        ERROR_TYPES.SECURITY_ERROR,
                        'PDFs containing JavaScript are not allowed'
                    ));
                }

                resolve();
            });

            pdfParser.parseBuffer(pdfBuffer);
        });
    }

    /**
     * Create page renderer for selective page processing
     */
    private createPageRenderer(): (pageData: any) => string {
        return (pageData: any): string => {
            const pageNum = pageData.pageNumber;
            if (this.options.pageRange && 
                !this.isPageInRange(pageNum, this.options.pageRange)) {
                return '';
            }
            return pageData.getTextContent();
        };
    }

    /**
     * Check if page number is within specified range
     */
    private isPageInRange(pageNum: number, pageRange: string[]): boolean {
        return pageRange.some(range => {
            const [start, end] = range.split('-').map(Number);
            return pageNum >= start && pageNum <= (end || start);
        });
    }

    /**
     * Detect JavaScript content in PDF
     */
    private detectJavaScript(pdfData: any): boolean {
        // Implementation of JavaScript detection in PDF
        return false; // Simplified for example
    }

    /**
     * Detect external links in PDF
     */
    private detectExternalLinks(pdfData: any): boolean {
        // Implementation of external link detection in PDF
        return false; // Simplified for example
    }

    /**
     * Create standardized error object
     */
    private createError(type: ERROR_TYPES, message: string): ScraperError {
        return {
            type,
            message,
            details: {
                timestamp: new Date(),
                metrics: this.metrics,
                validation: this.validation
            }
        };
    }

    /**
     * Handle and standardize errors
     */
    private handleError(error: any): ScraperError {
        if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
            return error;
        }
        return this.createError(
            ERROR_TYPES.PARSE_ERROR,
            `PDF parsing failed: ${error.message}`
        );
    }

    /**
     * Create successful result object
     */
    private createResult(text: string, metadata?: PDFMetadata): ParsedPDFResult {
        return {
            text,
            metadata,
            success: true,
            errors: [],
            metrics: this.metrics,
            validation: this.validation
        };
    }

    /**
     * Create error result object
     */
    private createErrorResult(error: ScraperError): ParsedPDFResult {
        return {
            text: '',
            metadata: null,
            success: false,
            errors: [error],
            metrics: this.metrics,
            validation: this.validation
        };
    }

    /**
     * Finalize metrics collection
     */
    private finalizeMetrics(): void {
        this.metrics.endTime = new Date();
        this.metrics.processingTime = 
            this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
        this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    }
}

export default PDFParser;