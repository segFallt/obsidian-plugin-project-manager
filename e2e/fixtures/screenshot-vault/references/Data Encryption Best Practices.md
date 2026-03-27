---
tags:
  - "#reference"
topics:
  - "[[Security]]"
client: "[[Global Finance Ltd]]"
engagement: "[[GFL Risk Review 2026]]"
---

# Data Encryption Best Practices

Standards and patterns for encrypting data at rest and in transit in financial services contexts.

## Key Points

- AES-256 for data at rest; TLS 1.3 minimum for data in transit
- Key management via HSM — never store keys alongside encrypted data
- Enforce envelope encryption for large datasets
- Annual key rotation policy aligned with SOC 2 requirements
