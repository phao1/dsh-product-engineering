---
name: pe-market-segments
description: "Exploring customer segments, audiences or new markets: 3-5 segments with their jobs, pains and product fit."
user-invocable: true
---

# Market segments

## DeepSeek Harness

This skill is available through `skill({ name: "pe-market-segments" })` or the user's `/pe-market-segments` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

## Purpose

**Identify 3-5 distinct customer segments and evaluate their fit with your product.** Understand each segment's jobs-to-be-done, desired outcomes and pain points. Use the analysis to evaluate market opportunities, prioritize target audiences or expand into new segments.

## Instructions

**Work as a strategic market research expert.** Use market segmentation, customer profiling and total addressable market (TAM) analysis.

### Input

**Identify and analyze potential customer segments for $ARGUMENTS.** Read and analyze any supplied research data, market studies, customer databases or existing segmentation documents. Look for behavioral patterns, demographic clusters and distinct needs across segments.

### Analysis steps

1. **Consider the full addressable market for $ARGUMENTS.**
2. **Identify logical segmentation dimensions.** Consider behavioral, demographic, firmographic and needs-based dimensions.
3. **Create 3-5 distinct, non-overlapping customer segments.**
4. **Synthesize each segment's profile and validate its distinctness.**
5. **Evaluate market size, growth potential and competitive intensity per segment.** Think through the analysis step by step.

### Output structure

**Provide a profile with the following sections for each of the 3-5 segments.**

#### Segment name and overview

- Clear, memorable segment identifier
- Size estimate (% of total market or absolute numbers if data available)
- Growth trajectory and market dynamics

#### Key demographics and firmographics

- Core characteristics (age, role, company size, industry, geography, etc.)
- Decision-maker profiles if B2B

#### Jobs-to-be-done

- Primary job and desired outcome for this segment
- Frequency, context and stakes of the job
- Success criteria and desired outcomes

#### Key pain points and obstacles

- Barriers to job completion specific to this segment
- Consequences of not solving the problem

#### Desired gains and success factors

- What outcomes matter most to this segment
- Preferred solution characteristics
- Cost and time constraints

#### Product fit analysis

- How well $ARGUMENTS serves this segment's needs
- Unique value proposition for this segment
- Potential adoption barriers or resistance

#### Competitive landscape

- Existing solutions or workarounds this segment uses
- Alternative approaches or competitors

## Best practices

- **Ensure segments are measurable, accessible and distinct.**
- **Prioritize segments with clear jobs-to-be-done and pain points.**
- **Validate segment assumptions with available data.**
- **Consider both greenfield opportunities and underserved segments.**
- **Flag segments requiring additional market research.**

## How you can tell it worked

Each segment is a group with a distinct job and pain rather than a demographic slice. The owner can say which one to explore first.
