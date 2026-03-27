---
tags:
  - "#reference"
topics:
  - "[[Security]]"
  - "[[Architecture]]"
client: "[[Acme Corp]]"
engagement: "[[Acme Digital Transformation]]"
---

# OAuth2 Implementation Guide

Best-practice guide for implementing OAuth2 authorisation code flow with PKCE for single-page applications.

## Key Points

- Always use PKCE — never implicit flow in modern apps
- Store tokens in memory, not localStorage
- Implement token rotation with refresh token families
- Set short access token expiry (15 minutes recommended)
