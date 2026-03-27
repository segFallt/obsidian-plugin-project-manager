---
tags:
  - "#reference"
topics:
  - "[[Architecture]]"
client: ""
engagement: ""
---

# API Rate Limiting Patterns

Common patterns for implementing rate limiting in REST APIs, with trade-offs for each approach.

## Key Points

- Token bucket for smooth bursts; leaky bucket for strict rate enforcement
- Return `Retry-After` headers on 429 responses
- Implement per-client rate limits, not just global limits
- Log all rate-limit events for capacity planning
