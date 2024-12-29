/**
 * @fileoverview Technology Transfer API Controller with optimized search and caching
 * Implements sub-2 second response time requirement with comprehensive error handling
 * @version 1.0.0
 */

import { injectable } from 'tsyringe'; // ^4.7.0
import { Request, Response } from 'express'; // ^4.18.0
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import { TechnologyService } from '../../services/technology.service';
import { validateRequest, validatePagination } from '../middleware/validation.middleware';
import { Technology } from '../../db/models/technology.model';
import { createError, handleError } from '../../utils/error.util';
import { ERROR_TYPES } from '../../constants/error.constants';
import { SearchParams } from '../../interfaces/search.interface';
import { ScraperResult } from '../../interfaces/scraper.interface';

/**
 * Controller handling technology-related HTTP endpoints with monitoring and optimized performance
 */
@injectable()
export class TechnologyController {
  private readonly CACHE_CONTROL = 'public, max-age=3600'; // 1 hour cache
  private readonly SEARCH_TIMEOUT = 2000; // 2 second timeout

  constructor(private readonly technologyService: TechnologyService) {}

  /**
   * Creates a new technology entry from scraper results
   * @param req Request containing scraper results
   * @param res Response object
   */
  @validateRequest()
  public async createTechnology(req: Request, res: Response): Promise<Response> {
    try {
      const scraperResult: ScraperResult = req.body;
      const technology = await this.technologyService.createFromScraper(scraperResult);

      return res.status(StatusCodes.CREATED).json({
        success: true,
        data: technology
      });
    } catch (error) {
      const handledError = handleError(error, {
        context: 'TechnologyController.createTechnology',
        scraperResult: req.body
      });

      return res.status(handledError.error.statusCode).json({
        success: false,
        error: handledError.error.message,
        correlationId: handledError.error.correlationId
      });
    }
  }

  /**
   * Retrieves a single technology by ID with caching
   * @param req Request with technology ID
   * @param res Response object
   */
  @validateRequest()
  public async getTechnology(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const technology = await this.technologyService.findById(id);

      if (!technology) {
        throw createError(
          ERROR_TYPES.NOT_FOUND_ERROR,
          'Technology not found',
          { technologyId: id }
        );
      }

      res.set('Cache-Control', this.CACHE_CONTROL);
      return res.status(StatusCodes.OK).json({
        success: true,
        data: technology
      });
    } catch (error) {
      const handledError = handleError(error, {
        context: 'TechnologyController.getTechnology',
        technologyId: req.params.id
      });

      return res.status(handledError.error.statusCode).json({
        success: false,
        error: handledError.error.message,
        correlationId: handledError.error.correlationId
      });
    }
  }

  /**
   * Performs optimized technology search with pagination and caching
   * Implements sub-2 second response time requirement
   * @param req Request with search parameters
   * @param res Response object
   */
  @validatePagination()
  @validateRequest()
  public async searchTechnologies(req: Request, res: Response): Promise<Response> {
    try {
      const searchParams: SearchParams = {
        query: req.query.q as string,
        filters: {
          institution: (req.query.institution as string || '').split(',').filter(Boolean),
          category: (req.query.category as string || '').split(',').filter(Boolean),
          country: (req.query.country as string || '').split(',').filter(Boolean),
          dateRange: {
            start: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
            end: req.query.endDate ? new Date(req.query.endDate as string) : undefined
          }
        },
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20
        }
      };

      const searchPromise = this.technologyService.search(searchParams);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Search timeout')), this.SEARCH_TIMEOUT);
      });

      const results = await Promise.race([searchPromise, timeoutPromise]);

      res.set('Cache-Control', this.CACHE_CONTROL);
      return res.status(StatusCodes.OK).json({
        success: true,
        data: results
      });
    } catch (error) {
      const handledError = handleError(error, {
        context: 'TechnologyController.searchTechnologies',
        searchParams: req.query
      });

      return res.status(handledError.error.statusCode).json({
        success: false,
        error: handledError.error.message,
        correlationId: handledError.error.correlationId
      });
    }
  }

  /**
   * Updates an existing technology entry
   * @param req Request with technology data
   * @param res Response object
   */
  @validateRequest()
  public async updateTechnology(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const updateData: Partial<Technology> = req.body;

      const technology = await this.technologyService.update(id, updateData);

      return res.status(StatusCodes.OK).json({
        success: true,
        data: technology
      });
    } catch (error) {
      const handledError = handleError(error, {
        context: 'TechnologyController.updateTechnology',
        technologyId: req.params.id,
        updateData: req.body
      });

      return res.status(handledError.error.statusCode).json({
        success: false,
        error: handledError.error.message,
        correlationId: handledError.error.correlationId
      });
    }
  }

  /**
   * Deletes a technology entry
   * @param req Request with technology ID
   * @param res Response object
   */
  @validateRequest()
  public async deleteTechnology(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      await this.technologyService.delete(id);

      return res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      const handledError = handleError(error, {
        context: 'TechnologyController.deleteTechnology',
        technologyId: req.params.id
      });

      return res.status(handledError.error.statusCode).json({
        success: false,
        error: handledError.error.message,
        correlationId: handledError.error.correlationId
      });
    }
  }
}