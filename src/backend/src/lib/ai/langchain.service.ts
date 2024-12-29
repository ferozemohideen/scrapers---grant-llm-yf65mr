// @nestjs/common v8.0.0
import { Injectable } from '@nestjs/common';
// langchain/llms/openai v0.1.0
import { OpenAI } from 'langchain/llms/openai';
// langchain/prompts v0.1.0
import { PromptTemplate } from 'langchain/prompts';
// langchain/chains v0.1.0
import { LLMChain } from 'langchain/chains';
// langchain/vectorstores v0.1.0
import { VectorStore } from 'langchain/vectorstores';
// langchain/document v0.1.0
import { Document } from 'langchain/document';
// langchain/embeddings v0.1.0
import { OpenAIEmbeddings } from 'langchain/embeddings';

import { IProposal } from '../../interfaces/grant.interface';

@Injectable()
export class LangChainService {
  private readonly llm: OpenAI;
  private readonly proposalChain: LLMChain;
  private readonly enhancementChain: LLMChain;
  private readonly vectorStore: VectorStore;
  private readonly embeddings: OpenAIEmbeddings;
  private readonly proposalTemplate: PromptTemplate;
  private readonly enhancementTemplate: PromptTemplate;

  constructor(private readonly configService: any) {
    // Initialize OpenAI model with optimal settings for grant writing
    this.llm = new OpenAI({
      temperature: 0.7,
      maxTokens: 2000,
      modelName: 'gpt-4',
      topP: 0.9,
      frequencyPenalty: 0.3,
      presencePenalty: 0.3,
    });

    // Initialize embeddings for semantic search
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-ada-002',
      dimensions: 1536,
      batchSize: 100,
    });

    // Initialize proposal generation template
    this.proposalTemplate = new PromptTemplate({
      template: `Generate a comprehensive grant proposal based on the following context and requirements:
      Technology: {technology}
      Requirements: {requirements}
      Context: {context}
      
      Focus on:
      1. Clear technical description
      2. Innovation potential
      3. Market impact
      4. Implementation feasibility
      
      Please structure the proposal with the following sections:
      - Executive Summary
      - Technical Description
      - Innovation Impact
      - Market Analysis
      - Implementation Plan
      - Budget Justification`,
      inputVariables: ['technology', 'requirements', 'context'],
    });

    // Initialize enhancement template
    this.enhancementTemplate = new PromptTemplate({
      template: `Enhance the following proposal using provided reference materials:
      Proposal: {proposal}
      Reference Materials: {references}
      
      Enhance by:
      1. Integrating relevant citations
      2. Strengthening technical arguments
      3. Improving clarity and flow
      4. Adding supporting evidence`,
      inputVariables: ['proposal', 'references'],
    });

    // Initialize chains
    this.proposalChain = new LLMChain({
      llm: this.llm,
      prompt: this.proposalTemplate,
    });

    this.enhancementChain = new LLMChain({
      llm: this.llm,
      prompt: this.enhancementTemplate,
    });
  }

  /**
   * Generates a grant proposal with contextual integration
   * @param technologyId - ID of the technology
   * @param requirements - Generation requirements
   * @param contextDocuments - Array of relevant context documents
   * @returns Promise<string> - Generated proposal content
   */
  async generateProposalWithContext(
    technologyId: string,
    requirements: any,
    contextDocuments: Document[]
  ): Promise<string> {
    try {
      // Process context documents
      const processedDocs = contextDocuments.map(doc => 
        new Document({ pageContent: doc.pageContent, metadata: doc.metadata })
      );

      // Generate embeddings and perform similarity search
      const relevantContext = await this.vectorStore.similaritySearch(
        requirements.focusAreas.join(' '),
        5,
        { documents: processedDocs }
      );

      // Create contextualized prompt
      const contextText = relevantContext
        .map(doc => doc.pageContent)
        .join('\n\n');

      // Generate proposal
      const { text: proposalContent } = await this.proposalChain.call({
        technology: technologyId,
        requirements: JSON.stringify(requirements),
        context: contextText,
      });

      // Enhance with sources
      const enhancedContent = await this.enhanceProposalWithSources(
        proposalContent,
        relevantContext
      );

      return enhancedContent;
    } catch (error) {
      throw new Error(`Proposal generation failed: ${error.message}`);
    }
  }

  /**
   * Enhances proposal content with source integration
   * @param content - Original proposal content
   * @param referenceMaterials - Array of reference materials
   * @returns Promise<string> - Enhanced proposal content
   */
  async enhanceProposalWithSources(
    content: string,
    referenceMaterials: Document[]
  ): Promise<string> {
    try {
      // Process reference materials
      const references = referenceMaterials
        .map(doc => `${doc.pageContent}\nSource: ${doc.metadata.source}`)
        .join('\n\n');

      // Execute enhancement chain
      const { text: enhancedContent } = await this.enhancementChain.call({
        proposal: content,
        references: references,
      });

      return enhancedContent;
    } catch (error) {
      throw new Error(`Proposal enhancement failed: ${error.message}`);
    }
  }

  /**
   * Analyzes proposal quality and provides detailed feedback
   * @param content - Proposal content to analyze
   * @returns Promise<object> - Quality analysis results
   */
  async analyzeProposalQuality(content: string): Promise<object> {
    try {
      const analysisTemplate = new PromptTemplate({
        template: `Analyze the following grant proposal for quality:
        {content}
        
        Provide analysis for:
        1. Technical accuracy
        2. Clarity and readability
        3. Innovation presentation
        4. Market impact analysis
        5. Implementation feasibility
        6. Citation quality
        
        Format response as JSON with scores and recommendations.`,
        inputVariables: ['content'],
      });

      const analysisChain = new LLMChain({
        llm: this.llm,
        prompt: analysisTemplate,
      });

      const { text: analysisResult } = await analysisChain.call({
        content: content,
      });

      return JSON.parse(analysisResult);
    } catch (error) {
      throw new Error(`Quality analysis failed: ${error.message}`);
    }
  }
}