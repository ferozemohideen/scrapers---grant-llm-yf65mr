/**
 * @fileoverview Integration tests for grant proposal management API endpoints
 * Validates proposal generation, enhancement, review functionality and performance metrics
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing'; // ^8.0.0
import { INestApplication, HttpStatus } from '@nestjs/common'; // ^8.0.0
import * as request from 'supertest'; // ^6.0.0
import { GrantController } from '../../src/api/controllers/grant.controller';
import { IProposal, ProposalStatus } from '../../src/interfaces/grant.interface';

describe('Grant API Integration Tests', () => {
  let app: INestApplication;
  let testModule: TestingModule;

  // Test user contexts
  const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    roles: ['user']
  };

  const testAdmin = {
    id: 'test-admin-id',
    email: 'admin@example.com',
    roles: ['admin']
  };

  // Test data
  const testTechnology = {
    id: 'test-tech-id',
    title: 'Test Technology',
    description: 'Test description for technology transfer'
  };

  beforeAll(async () => {
    // Create test module with real implementations
    testModule = await Test.createTestingModule({
      controllers: [GrantController],
      // Add all required providers and dependencies
    }).compile();

    app = testModule.createNestApplication();
    
    // Apply production middleware and pipes
    app.useGlobalPipes();
    app.enableCors();
    app.enableVersioning();
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Reset test database and cache
    await testModule.get('DatabaseService').clearTestData();
    await testModule.get('CacheService').clear();
  });

  describe('POST /grants', () => {
    it('should generate a new proposal within 2 seconds', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/grants')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          technologyId: testTechnology.id,
          requirements: {
            targetLength: 2000,
            focusAreas: ['technical', 'commercial'],
            technicalDepth: 'advanced',
            includeSections: ['executive_summary', 'market_analysis']
          },
          aiParameters: {
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2048
          }
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        content: expect.any(String),
        status: ProposalStatus.DRAFT,
        metadata: expect.any(Object)
      });

      // Validate response time under 2 seconds
      expect(responseTime).toBeLessThan(2000);

      // Validate content quality
      expect(response.body.content.length).toBeGreaterThan(1000);
      expect(response.body.metadata.metrics.technicalAccuracy).toBeGreaterThan(0.8);
    });

    it('should handle rate limiting for proposal generation', async () => {
      // Make multiple rapid requests
      const requests = Array(10).fill(null).map(() => 
        request(app.getHttpServer())
          .post('/grants')
          .set('Authorization', `Bearer ${testUser.token}`)
          .send({
            technologyId: testTechnology.id,
            requirements: {
              targetLength: 1000,
              focusAreas: ['technical']
            }
          })
      );

      const responses = await Promise.all(requests);
      
      // Verify rate limiting behavior
      const rateLimited = responses.some(res => 
        res.status === HttpStatus.TOO_MANY_REQUESTS
      );
      expect(rateLimited).toBeTruthy();
    });
  });

  describe('PUT /grants/:id/enhance', () => {
    let testProposal: IProposal;

    beforeEach(async () => {
      // Create test proposal
      testProposal = await testModule
        .get('GrantService')
        .generateProposal({
          technologyId: testTechnology.id,
          userId: testUser.id
        });
    });

    it('should enhance proposal and improve success metrics', async () => {
      const initialMetrics = testProposal.metadata.metrics;

      const response = await request(app.getHttpServer())
        .put(`/grants/${testProposal.id}/enhance`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          enhancementType: 'technical_depth',
          aiParameters: {
            temperature: 0.8,
            maxTokens: 1024
          }
        });

      expect(response.status).toBe(HttpStatus.OK);
      
      // Validate enhancement metrics
      const enhancedMetrics = response.body.metadata.metrics;
      expect(enhancedMetrics.technicalAccuracy)
        .toBeGreaterThan(initialMetrics.technicalAccuracy);
      expect(enhancedMetrics.completenessScore)
        .toBeGreaterThan(initialMetrics.completenessScore);

      // Verify 30% improvement requirement
      const improvement = (enhancedMetrics.overallScore - initialMetrics.overallScore) 
        / initialMetrics.overallScore;
      expect(improvement).toBeGreaterThan(0.3);
    });
  });

  describe('GET /grants/:id/review', () => {
    let testProposal: IProposal;

    beforeEach(async () => {
      testProposal = await testModule
        .get('GrantService')
        .generateProposal({
          technologyId: testTechnology.id,
          userId: testUser.id
        });
    });

    it('should provide comprehensive review with success probability', async () => {
      const response = await request(app.getHttpServer())
        .get(`/grants/${testProposal.id}/review`)
        .set('Authorization', `Bearer ${testAdmin.token}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toMatchObject({
        technicalAccuracy: expect.any(Number),
        clarity: expect.any(Number),
        impact: expect.any(Number),
        successProbability: expect.any(Number),
        suggestions: expect.any(Array)
      });

      // Validate review quality
      expect(response.body.suggestions.length).toBeGreaterThan(0);
      expect(response.body.successProbability).toBeGreaterThanOrEqual(0);
      expect(response.body.successProbability).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /grants/user/:userId', () => {
    beforeEach(async () => {
      // Create multiple test proposals
      await Promise.all(Array(5).fill(null).map(() =>
        testModule.get('GrantService').generateProposal({
          technologyId: testTechnology.id,
          userId: testUser.id
        })
      ));
    });

    it('should retrieve user proposals with search under 2 seconds', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get(`/grants/user/${testUser.id}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .query({
          page: 1,
          limit: 10,
          status: ProposalStatus.DRAFT
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toMatchObject({
        proposals: expect.any(Array),
        total: expect.any(Number)
      });

      // Validate response time
      expect(responseTime).toBeLessThan(2000);

      // Validate pagination
      expect(response.body.proposals.length).toBeGreaterThan(0);
      expect(response.body.proposals.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Performance Metrics', () => {
    it('should validate 50% reduction in grant writing time', async () => {
      const manualWritingTime = 28800; // 8 hours in seconds
      
      const startTime = Date.now();
      
      // Generate and enhance proposal
      const proposal = await testModule
        .get('GrantService')
        .generateProposal({
          technologyId: testTechnology.id,
          userId: testUser.id
        });

      await testModule
        .get('GrantService')
        .enhanceProposal(proposal.id, {
          enhancementType: 'comprehensive'
        });

      const endTime = Date.now();
      const aiWritingTime = (endTime - startTime) / 1000;

      // Verify 50% time reduction
      const timeReduction = (manualWritingTime - aiWritingTime) / manualWritingTime;
      expect(timeReduction).toBeGreaterThan(0.5);
    });
  });
});