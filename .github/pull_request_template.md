# Pull Request Description

## Title
<!-- Provide a clear and concise title following conventional commit format -->
<!-- e.g., feat(scraper): add support for NASA API integration -->

## Description
<!-- Provide a detailed description of the changes including motivation and implementation details -->

## Type
<!-- Select the type of change this PR represents -->
- [ ] feature
- [ ] bugfix
- [ ] hotfix
- [ ] refactor
- [ ] performance
- [ ] documentation
- [ ] security

# Technical Details

## Component
<!-- Select the primary component affected by this change -->
- [ ] scraper
- [ ] data_processor
- [ ] grant_writer
- [ ] search_service
- [ ] api_gateway
- [ ] web_interface
- [ ] monitoring

## Impact Assessment
<!-- Check all that apply -->
- [ ] Database Changes (schema changes or migrations)
- [ ] API Changes (contract changes or versioning updates)

## Testing Details

### Test Coverage
<!-- Describe new/modified tests and provide coverage metrics -->
```
Test coverage report:
- Unit tests: ___%
- Integration tests: ___%
- Overall coverage: ___%
```

### Manual Testing Instructions
<!-- Provide step-by-step instructions for manual testing verification -->
1. 
2. 
3. 

# Review Checklist

## Code Quality
<!-- Ensure all code quality standards are met -->
- [ ] Code follows style guidelines and passes linting
- [ ] Comments and documentation are comprehensive and up-to-date
- [ ] No hardcoded secrets, credentials, or sensitive data
- [ ] Robust error handling implemented with appropriate logging
- [ ] Code is optimized for performance and scalability
- [ ] Technical debt considerations documented

## Testing
<!-- Verify comprehensive test coverage -->
- [ ] Unit tests added/updated with >80% coverage
- [ ] Integration tests added/updated for new functionality
- [ ] End-to-end tests updated if applicable
- [ ] Performance impact assessed through benchmarks
- [ ] Load testing completed for critical paths
- [ ] Edge cases and error scenarios covered

## Security
<!-- Ensure security requirements are met -->
- [ ] Security scan completed with no high/critical issues
- [ ] Input validation implemented for all user inputs
- [ ] Authentication/Authorization checks in place
- [ ] Data encryption verified for sensitive information
- [ ] Rate limiting implemented where necessary
- [ ] OWASP top 10 vulnerabilities addressed

## DevOps
<!-- Verify deployment and operational readiness -->
- [ ] CI pipeline passes all stages successfully
- [ ] Database migrations are backwards compatible
- [ ] Environment variables documented in .env.example
- [ ] Monitoring and alerts configured appropriately
- [ ] Deployment rollback plan documented
- [ ] Resource scaling considerations addressed

# Required Approvals
<!-- All approvals must be obtained before merging -->
- [ ] Code Review (2 required)
- [ ] Security Review (1 required)
- [ ] Tech Lead Review (1 required)
- [ ] Product Owner Review (1 required)

# Size Label
<!-- Select the appropriate size label based on changes -->
- [ ] XS (1-9 lines)
- [ ] S (10-29 lines)
- [ ] M (30-99 lines)
- [ ] L (100-499 lines)
- [ ] XL (500+ lines)

# References
<!-- Link any related issues, documentation, or dependencies -->
- Related Issue: 
- Documentation: 
- Dependencies: 

# CI/CD Status
<!-- CI/CD workflow status will be automatically updated -->
- Backend CI: ![Backend CI Status](../../workflows/backend-ci/badge.svg)
- Web CI: ![Web CI Status](../../workflows/web-ci/badge.svg)

<!-- 
Note: This PR template enforces project standards for:
- Code quality and review process
- Testing requirements and coverage
- Security compliance and review
- DevOps and deployment considerations

Branch naming convention:
- feature/* : New features
- bugfix/*  : Bug fixes
- hotfix/*  : Critical fixes
- release/* : Release preparation
- security/* : Security updates
-->