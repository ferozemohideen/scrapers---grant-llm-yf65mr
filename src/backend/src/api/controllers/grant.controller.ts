/**
 * @fileoverview Enterprise-grade REST API controller for grant proposal management
 * Implements secure and optimized endpoints with comprehensive error handling
 * @version 1.0.0
 */

import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  UseFilters,
  Logger,
  HttpStatus,
  HttpException
} from '@nestjs/common'; // ^8.0.0

import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger'; // ^5.0.0

import { RateLimit } from '@nestjs/throttler'; // ^2.0.0
import { CacheInterceptor } from '@nestjs/cache-manager'; // ^1.0.0
import { JwtAuthGuard, RolesGuard } from '@nestjs/passport'; // ^8.0.0

import { GrantService } from '../../services/grant.service';
import { 
  IProposal, 
  IProposalGeneration, 
  IProposalEnhancement,
  ProposalStatus 
} from '../../interfaces/grant.interface';
import { API_VALIDATION_RULES } from '../../constants/validation.constants';

/**
 * Enhanced controller for managing grant proposals with comprehensive security
 * and performance optimizations
 */
@Controller('grants')
@ApiTags('grants')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CacheInterceptor)
@UseFilters(HttpExceptionFilter)
@UsePipes(new ValidationPipe({ transform: true }))
export class GrantController {
  private readonly logger = new Logger(GrantController.name);

  constructor(private readonly grantService: GrantService) {}

  /**
   * Generates a new grant proposal with AI assistance
   * @param data Proposal generation requirements
   * @returns Generated proposal with initial metrics
   */
  @Post()
  @RateLimit({ ttl: 60, limit: API_VALIDATION_RULES.RATE_LIMITING.maxRequests.authenticated })
  @ApiOperation({ summary: 'Generate new grant proposal' })
  @ApiBody({ type: ProposalGenerationDto })
  @ApiResponse({ status: HttpStatus.CREATED, type: ProposalResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, type: ErrorResponseDto })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, type: ThrottleErrorDto })
  async generateProposal(@Body() data: IProposalGeneration): Promise<IProposal> {
    this.logger.log(`Starting proposal generation for technology ${data.technologyId}`);
    
    try {
      const proposal = await this.grantService.generateProposal(data);
      this.logger.log(`Successfully generated proposal ${proposal.id}`);
      return proposal;
    } catch (error) {
      this.logger.error(`Proposal generation failed: ${error.message}`);
      throw new HttpException(
        'Failed to generate proposal',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Enhances existing proposal with AI-powered improvements
   * @param id Proposal ID
   * @param enhancement Enhancement parameters
   * @returns Enhanced proposal with improvement metrics
   */
  @Put(':id/enhance')
  @RateLimit({ ttl: 60, limit: API_VALIDATION_RULES.RATE_LIMITING.maxRequests.authenticated })
  @ApiOperation({ summary: 'Enhance existing proposal' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ProposalEnhancementDto })
  @ApiResponse({ status: HttpStatus.OK, type: ProposalResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorResponseDto })
  async enhanceProposal(
    @Param('id') id: string,
    @Body() enhancement: IProposalEnhancement
  ): Promise<IProposal> {
    this.logger.log(`Starting proposal enhancement for ${id}`);
    
    try {
      const enhanced = await this.grantService.enhanceProposal(id, enhancement);
      this.logger.log(`Successfully enhanced proposal ${id}`);
      return enhanced;
    } catch (error) {
      this.logger.error(`Proposal enhancement failed: ${error.message}`);
      throw new HttpException(
        'Failed to enhance proposal',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Reviews proposal with comprehensive feedback
   * @param id Proposal ID
   * @returns Detailed review with success probability
   */
  @Get(':id/review')
  @ApiOperation({ summary: 'Review proposal quality' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: HttpStatus.OK, type: ProposalReviewDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorResponseDto })
  async reviewProposal(@Param('id') id: string): Promise<Record<string, any>> {
    this.logger.log(`Starting proposal review for ${id}`);
    
    try {
      const review = await this.grantService.reviewProposal(id);
      this.logger.log(`Successfully reviewed proposal ${id}`);
      return review;
    } catch (error) {
      this.logger.error(`Proposal review failed: ${error.message}`);
      throw new HttpException(
        'Failed to review proposal',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Retrieves user's proposals with pagination
   * @param userId User ID
   * @param page Page number
   * @param limit Results per page
   * @param status Optional status filter
   * @returns Paginated list of proposals
   */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user proposals' })
  @ApiParam({ name: 'userId', type: String })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'status', enum: ProposalStatus, required: false })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedProposalsDto })
  async getUserProposals(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = API_VALIDATION_RULES.PAGINATION.defaultLimit,
    @Query('status') status?: ProposalStatus
  ): Promise<{ proposals: IProposal[]; total: number }> {
    this.logger.log(`Retrieving proposals for user ${userId}`);
    
    try {
      // Validate pagination parameters
      limit = Math.min(limit, API_VALIDATION_RULES.PAGINATION.maxLimit);
      page = Math.max(1, page);

      const result = await this.grantService.getUserProposals(
        userId,
        page,
        limit,
        status
      );
      
      this.logger.log(`Successfully retrieved proposals for user ${userId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to retrieve user proposals: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve proposals',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}