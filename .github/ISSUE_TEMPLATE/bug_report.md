---
name: Bug Report
about: Create a report to help us improve the system
title: '[BUG] '
labels: bug, needs-triage, needs-reproduction
assignees: ''
---

<!--
Before submitting a bug report:
- Check if the issue has already been reported
- Ensure all sensitive data is removed
- Include all required information
-->

## Bug Description
### Title
<!-- A clear and concise bug title that identifies the issue -->

### Description
<!-- Detailed description of the bug including impact and scope -->

### Component
<!-- Select the affected system component -->
- [ ] data_aggregation_engine/scraper
- [ ] data_aggregation_engine/processor
- [ ] grant_writing_assistant/writer
- [ ] grant_writing_assistant/matcher
- [ ] search_service
- [ ] api_gateway
- [ ] web_interface
- [ ] monitoring_system
- [ ] database_layer
- [ ] authentication_service

### Severity
<!-- Select the appropriate severity level -->
- [ ] critical - system down/data loss
- [ ] high - major functionality broken
- [ ] medium - feature partially broken
- [ ] low - minor issue/cosmetic

### Incident ID
<!-- If this bug is related to a monitoring incident, provide the ID -->
Incident ID: 

## Environment
### Deployment Environment
<!-- Select the environment where the bug occurs -->
- [ ] production
- [ ] staging
- [ ] development
- [ ] local

### Version
<!-- System version where bug occurs (format: vX.Y.Z) -->
Version: 

### Infrastructure
<!-- Select the infrastructure where the bug occurs -->
- [ ] aws_us_east_1
- [ ] aws_us_west_2
- [ ] aws_eu_west_1
- [ ] local_environment

### Deployment Information
<!-- Provide relevant deployment details if applicable -->
```
Container ID:
Pod Name:
Other Details:
```

## Reproduction Steps
### Prerequisites
<!-- List any required setup, data, or conditions -->

### Steps to Reproduce
<!-- Provide detailed step-by-step reproduction instructions -->
1. 
2. 
3. 

### Expected Behavior
<!-- Describe what should happen -->

### Actual Behavior
<!-- Describe what actually happens -->

## Technical Details
### Error Logs
<!-- Include relevant error logs (REMOVE ANY SENSITIVE DATA) -->
```
Paste logs here
```

### Monitoring Metrics
<!-- Include relevant monitoring metrics or alerts -->
```
Paste metrics here
```

### Distributed Traces
<!-- Include relevant distributed traces if available -->
```
Paste trace data here
```

### Screenshots
<!-- Drag and drop screenshots or screen recordings if applicable -->

### Related Issues
<!-- Link to related issues or incidents -->
- 

## Validation Checklist
<!-- Ensure all applicable items are checked -->
- [ ] Steps are clear and reproducible
- [ ] All relevant logs attached
- [ ] Screenshots added if applicable
- [ ] Environment details complete
- [ ] Component correctly identified
- [ ] Severity accurately assessed

## Security Checklist
<!-- Ensure all security items are verified -->
- [ ] No sensitive data in logs
- [ ] No credentials exposed
- [ ] No PII included
- [ ] Security impact assessed
- [ ] Access properly restricted if security-sensitive

## Monitoring Checklist
<!-- Verify monitoring integration items -->
- [ ] Incident ID linked if applicable
- [ ] Relevant metrics attached
- [ ] Alert thresholds reviewed
- [ ] Trace data included if available

<!-- 
Auto-assignments will be handled based on:
- Component ownership
- Technical lead responsibilities
- Security team (for critical severity or security checklist failures)
- SRE team (for critical severity or monitoring system issues)

SLA based on severity:
- Critical: 2 hours
- High: 24 hours
- Medium: 72 hours
- Low: 1 week
-->