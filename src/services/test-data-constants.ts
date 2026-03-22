/**
 * Static data pools for the TestDataService.
 * All generated entities use TEST_PREFIX for easy identification and cleanup.
 */

export const TEST_PREFIX = "TEST -";

export const CLIENT_NAMES = [
  "Acme Corporation",
  "Bright Futures Ltd",
  "Cedar Grove Solutions",
  "Dune Analytics",
  "Elara Health",
  "Frontier Tech",
  "Global Bridge Partners",
  "Harbor Innovations",
  "Iris Media Group",
  "Jade Consulting",
] as const;

export const ENGAGEMENT_NAMES = [
  "Digital Transformation",
  "Brand Strategy Review",
  "Market Expansion 2026",
  "Cloud Migration Phase 1",
  "Operational Audit",
  "Customer Experience Overhaul",
  "Data Platform Build",
  "Compliance Programme",
  "Product Launch Support",
  "Growth Strategy Advisory",
] as const;

export const PROJECT_NAMES = [
  "CRM Implementation",
  "Website Redesign",
  "Data Warehouse Setup",
  "Mobile App Development",
  "Process Automation",
  "Staff Training Programme",
  "Security Assessment",
  "API Integration",
  "Reporting Dashboard",
  "UX Research Study",
] as const;

export const PERSON_NAMES = [
  "Alex Morgan",
  "Blair Thompson",
  "Casey Rivera",
  "Dana Kim",
  "Evan Patel",
  "Frances O'Brien",
  "George Nakamura",
  "Helen Zhao",
  "Ivan Sousa",
  "Jasmine Williams",
] as const;

export const INBOX_NAMES = [
  "Follow Up on Proposal",
  "Review Contract Draft",
  "Schedule Kickoff Meeting",
  "Gather Requirements",
  "Prepare Status Report",
  "Clarify Scope",
  "Research Competitor Landscape",
  "Draft Communications Plan",
  "Define Success Metrics",
  "Identify Stakeholders",
] as const;

export const SINGLE_MEETING_NAMES = [
  "Kickoff Workshop",
  "Requirements Gathering Session",
  "Stakeholder Presentation",
  "Executive Briefing",
  "Technical Discovery Call",
  "Budget Review Meeting",
  "Risk Assessment Workshop",
  "Lessons Learned Debrief",
  "Contract Negotiation",
  "Demo and Feedback Session",
] as const;

export const RECURRING_MEETING_NAMES = [
  "Weekly Status Sync",
  "Bi-weekly Steering Committee",
  "Monthly Progress Review",
  "Sprint Planning Session",
  "Daily Standup",
  "Quarterly Business Review",
  "Client Check-in Call",
  "Team Retrospective",
  "Product Roadmap Review",
  "Executive Leadership Sync",
] as const;

export const PROJECT_NOTE_NAMES = [
  "Architecture Decision Record",
  "Risk Register",
  "Meeting Notes Summary",
  "Technical Specification",
  "User Story Map",
  "Retrospective Notes",
  "Stakeholder Map",
  "Requirements Document",
  "Test Plan",
  "Release Notes",
] as const;

export const TASK_DESCRIPTIONS = [
  "Review and approve project scope document",
  "Schedule alignment meeting with stakeholders",
  "Draft initial project timeline",
  "Identify resource requirements",
  "Prepare weekly status update",
  "Follow up on outstanding action items",
  "Update risk register with new findings",
  "Review deliverable feedback from client",
  "Coordinate with legal on contract terms",
  "Set up project tracking in tools",
  "Conduct stakeholder interviews",
  "Document process improvements",
  "Test integration with existing systems",
  "Present findings to leadership team",
  "Finalise budget reconciliation",
  "Archive completed deliverables",
  "Onboard new team member",
  "Escalate blocker to project sponsor",
] as const;

export const REFERENCE_TOPIC_NAMES = [
  `${TEST_PREFIX}Architecture`,
  `${TEST_PREFIX}Security`,
  `${TEST_PREFIX}Compliance`,
  `${TEST_PREFIX}Performance`,
  `${TEST_PREFIX}Integration`,
  `${TEST_PREFIX}UX Research`,
  `${TEST_PREFIX}Data Governance`,
  `${TEST_PREFIX}API Design`,
  `${TEST_PREFIX}Testing Strategy`,
  `${TEST_PREFIX}Observability`,
  `${TEST_PREFIX}Cost Optimisation`,
  `${TEST_PREFIX}Accessibility`,
];

export const REFERENCE_NAMES = [
  `${TEST_PREFIX}RFC-001 Auth Flow`,
  `${TEST_PREFIX}RFC-002 Rate Limiting`,
  `${TEST_PREFIX}ADR-001 Database Choice`,
  `${TEST_PREFIX}ADR-002 API Versioning`,
  `${TEST_PREFIX}Runbook - Deploy Process`,
  `${TEST_PREFIX}Runbook - Incident Response`,
  `${TEST_PREFIX}Spec - Data Model v2`,
  `${TEST_PREFIX}Spec - Event Schema`,
  `${TEST_PREFIX}Guide - Onboarding`,
  `${TEST_PREFIX}Guide - Security Checklist`,
  `${TEST_PREFIX}Template - Post-Mortem`,
  `${TEST_PREFIX}Template - Design Review`,
];

/** Priority emojis in Tasks plugin order (index 2 = medium = no emoji). */
export const PRIORITY_EMOJIS = ["⏫", "🔼", "", "🔽", "⏬"] as const;

/** Number of tasks to generate per entity. */
export const TASKS_PER_ENTITY = 5;

/** Number of entities to generate per type. */
export const ENTITIES_PER_TYPE = 10;
