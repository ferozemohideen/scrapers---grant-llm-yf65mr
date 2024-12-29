# Technology Transfer Data Aggregation Backend Service

A robust, scalable microservices-based backend system for aggregating technology transfer data and providing grant-writing assistance using AI.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Deployment](#deployment)
- [Architecture](#architecture)
- [Security](#security)
- [Performance](#performance)
- [Contributing](#contributing)

## Overview

This backend service is part of a comprehensive technology transfer platform that aggregates research commercialization opportunities from 375+ institutions worldwide. The system combines advanced web scraping capabilities with LLM technology to transform fragmented technology transfer data into a streamlined, intelligent platform.

### Key Features
- Distributed web scraping system
- Real-time data processing and enrichment
- AI-powered grant writing assistance
- Scalable microservices architecture
- Comprehensive security controls
- Advanced caching and performance optimization

## Prerequisites

Ensure you have the following installed:
- Node.js >= 16.0.0
- npm >= 8.0.0
- Docker Engine >= 20.10.0
- Docker Compose >= 2.0.0

### System Requirements
- Minimum 8GB RAM for development
- Available ports: 3000, 5432, 6379, 5672, 27017, 15672

### Required Services
- PostgreSQL 14+
- Redis 6+
- MongoDB 5+
- RabbitMQ 3.9+

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/organization/tech-transfer-platform.git
cd tech-transfer-platform/backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development environment:
```bash
docker-compose up -d
npm run dev
```

## Development

### Available Scripts

```bash
# Development
npm run dev           # Start development server
npm run build        # Build production bundle
npm run lint         # Run ESLint
npm run format       # Format code with Prettier

# Testing
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report
npm run test:e2e         # Run end-to-end tests
npm run test:integration # Run integration tests

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio

# Docker
npm run docker:build    # Build Docker image
npm run docker:run      # Run Docker container
```

### Project Structure
```
src/
├── api/              # API routes and controllers
├── config/           # Configuration files
├── models/           # Data models and schemas
├── services/         # Business logic
├── scrapers/         # Web scraping modules
├── processors/       # Data processing modules
├── utils/            # Utility functions
└── tests/           # Test files
```

## Deployment

### Docker Deployment

The service uses Docker Compose for containerized deployment with the following services:
- API Service (Node.js)
- PostgreSQL Database
- Redis Cache
- MongoDB Database
- RabbitMQ Message Broker

```bash
# Production deployment
docker-compose -f docker-compose.yml up -d

# Monitor logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale api=3
```

### Resource Allocation

Service resource limits are configured in docker-compose.yml:
- API Service: 1 CPU, 2GB RAM
- PostgreSQL: 2 CPU, 4GB RAM
- Redis: 1 CPU, 2GB RAM
- MongoDB: 2 CPU, 4GB RAM
- RabbitMQ: 1 CPU, 2GB RAM

## Architecture

### Microservices Components
- Data Aggregation Engine
- Grant-Writing Assistant
- Search Service
- Authentication Service
- Processing Pipeline

### Data Flow
1. Web scraping workers collect data from institutions
2. Raw data is processed and enriched
3. Processed data is stored in appropriate databases
4. API endpoints serve data to frontend applications
5. Background workers handle async tasks

## Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Rate limiting and throttling
- API key management

### Data Protection
- Encrypted data at rest
- TLS for data in transit
- Secrets management using Docker secrets
- Regular security audits

## Performance

### Optimization Strategies
- Redis caching layer
- Database query optimization
- Rate limiting and request throttling
- Load balancing and horizontal scaling

### Monitoring
- Prometheus metrics
- Grafana dashboards
- ELK stack for logging
- Health check endpoints

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

### Code Style
- Follow TypeScript best practices
- Use ESLint and Prettier
- Write unit tests for new features
- Update documentation

## License

MIT License - see LICENSE file for details