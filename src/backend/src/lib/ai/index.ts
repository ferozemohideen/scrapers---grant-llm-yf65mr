// Core AI service exports and configuration
// @nestjs/common v8.0.0
import { Injectable, OnModuleInit } from '@nestjs/common';
// @nestjs/config v8.0.0
import { ConfigService } from '@nestjs/config';
// prometheus-client v1.0.0
import { Counter, Histogram } from 'prom-client';

import { GPT4Service } from './gpt4.service';
import { LangChainService } from './langchain.service';
import { 
  IProposal, 
  IGenerationRequirements, 
  IAIParameters,
  IProposalEnhancement 
} from '../../interfaces/grant.interface';

/**
 * Configuration interface for AI services
 */
interface AIServiceConfig {
  openaiApiKey: string;
  openaiOrgId: string;
  maxConcurrentRequests: number;
  requestTimeout: number;
  rateLimitPerMinute: number;
  retryAttempts: number;
}

/**
 * Metrics for monitoring AI service performance
 */
const metrics = {
  requestCounter: new Counter({
    name: 'ai_service_requests_total',
    help: 'Total number of AI service requests',
    labelNames: ['service', 'operation']
  }),
  latencyHistogram: new Histogram({
    name: 'ai_service_latency_seconds',
    help: 'Latency of AI service operations',
    labelNames: ['service', 'operation']
  }),
  errorCounter: new Counter({
    name: 'ai_service_errors_total',
    help: 'Total number of AI service errors',
    labelNames: ['service', 'operation', 'error_type']
  })
};

/**
 * Core AI service provider that integrates GPT-4 and LangChain capabilities
 * for grant proposal generation and enhancement
 */
@Injectable()
export class AIService implements OnModuleInit {
  private readonly config: AIServiceConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly gpt4Service: GPT4Service,
    private readonly langChainService: LangChainService
  ) {
    this.config = {
      openaiApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      openaiOrgId: this.configService.get<string>('OPENAI_ORG_ID'),
      maxConcurrentRequests: this.configService.get<number>('AI_MAX_CONCURRENT_REQUESTS', 10),
      requestTimeout: this.configService.get<number>('AI_REQUEST_TIMEOUT', 30000),
      rateLimitPerMinute: this.configService.get<number>('AI_RATE_LIMIT_PER_MINUTE', 100),
      retryAttempts: this.configService.get<number>('AI_RETRY_ATTEMPTS', 3)
    };
  }

  async onModuleInit() {
    await this.validateConfiguration();
  }

  /**
   * Generates a grant proposal using GPT-4 with error handling and metrics
   */
  async generateProposal(
    technologyId: string,
    requirements: IGenerationRequirements,
    options?: IAIParameters
  ): Promise<string> {
    const timer = metrics.latencyHistogram.startTimer({ service: 'gpt4', operation: 'generate' });
    
    try {
      metrics.requestCounter.inc({ service: 'gpt4', operation: 'generate' });
      
      const proposal = await this.gpt4Service.generateProposal(
        technologyId,
        requirements,
        options
      );
      
      timer();
      return proposal;
    } catch (error) {
      metrics.errorCounter.inc({ 
        service: 'gpt4', 
        operation: 'generate', 
        error_type: error.name 
      });
      throw error;
    }
  }

  /**
   * Generates a context-aware proposal using LangChain
   */
  async generateProposalWithContext(
    technologyId: string,
    requirements: IGenerationRequirements,
    contextDocuments: any[]
  ): Promise<string> {
    const timer = metrics.latencyHistogram.startTimer({ 
      service: 'langchain', 
      operation: 'generateWithContext' 
    });
    
    try {
      metrics.requestCounter.inc({ service: 'langchain', operation: 'generateWithContext' });
      
      const proposal = await this.langChainService.generateProposalWithContext(
        technologyId,
        requirements,
        contextDocuments
      );
      
      timer();
      return proposal;
    } catch (error) {
      metrics.errorCounter.inc({ 
        service: 'langchain', 
        operation: 'generateWithContext', 
        error_type: error.name 
      });
      throw error;
    }
  }

  /**
   * Enhances a proposal using GPT-4
   */
  async enhanceProposal(
    content: string,
    enhancementType: string,
    options?: IAIParameters
  ): Promise<IProposalEnhancement> {
    const timer = metrics.latencyHistogram.startTimer({ 
      service: 'gpt4', 
      operation: 'enhance' 
    });
    
    try {
      metrics.requestCounter.inc({ service: 'gpt4', operation: 'enhance' });
      
      const enhancement = await this.gpt4Service.enhanceProposal(
        content,
        enhancementType,
        options
      );
      
      timer();
      return enhancement;
    } catch (error) {
      metrics.errorCounter.inc({ 
        service: 'gpt4', 
        operation: 'enhance', 
        error_type: error.name 
      });
      throw error;
    }
  }

  /**
   * Analyzes proposal quality using LangChain
   */
  async analyzeProposalQuality(content: string): Promise<object> {
    const timer = metrics.latencyHistogram.startTimer({ 
      service: 'langchain', 
      operation: 'analyze' 
    });
    
    try {
      metrics.requestCounter.inc({ service: 'langchain', operation: 'analyze' });
      
      const analysis = await this.langChainService.analyzeProposalQuality(content);
      
      timer();
      return analysis;
    } catch (error) {
      metrics.errorCounter.inc({ 
        service: 'langchain', 
        operation: 'analyze', 
        error_type: error.name 
      });
      throw error;
    }
  }

  /**
   * Validates service configuration
   */
  private async validateConfiguration(): Promise<void> {
    if (!this.config.openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }
    if (!this.config.openaiOrgId) {
      throw new Error('OpenAI Organization ID is required');
    }
    // Additional validation as needed
  }
}

// Export services for external use
export { GPT4Service } from './gpt4.service';
export { LangChainService } from './langchain.service';
export { AIService };