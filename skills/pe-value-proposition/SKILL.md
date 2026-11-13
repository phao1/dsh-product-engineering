---
name: pe-value-proposition
description: "Creating or testing a value proposition: the 6-part form (Who, Why, What before, How, What after, Alternatives)."
user-invocable: true
---

# Value proposition

## DeepSeek Harness

This skill is available through `skill({ name: "pe-value-proposition" })` or the user's `/pe-value-proposition` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

## Metadata

| Field | Value |
|---|---|
| Name | value-proposition |
| Description | Generate a detailed value proposition using a 6-part template with JTBD framing. Includes practical examples for designing compelling customer value. |
| Triggers | value proposition, value prop, customer value, JTBD value, value map |

## Instructions

**Design a clear, comprehensive value proposition for $ARGUMENTS.** Work as a product strategist to articulate the customer value delivered by the product.

## Input requirements

- Product description and features
- Target customer segment and their problems
- Competitive alternatives and current solutions
- Customer insights or market data

## Value proposition template

### 6-part structure

**Fill all six parts for one customer segment.**

#### 1. Who

- Who is this value proposition for?
- What customer segment are we addressing?
- What are their characteristics and constraints?

#### 2. Why (problem)

- What is the customer's core problem or need?
- What's the Job to Be Done (JTBD)?
- What desired outcomes are they trying to achieve?

#### 3. What before

- What is the customer's current situation?
- What are they using today to solve this problem?
- What friction or pain exists in the current approach?

#### 4. How (solution)

- How does the product solve the problem?
- What specific features or capabilities deliver value?
- Why is this solution better than alternatives?

#### 5. What after

- What is the improved outcome or future state?
- How does the customer's life/work change?
- What becomes possible that wasn't before?

#### 6. Alternatives

- What other solutions could customers use?
- Why would they choose us instead?
- What's the switching cost or friction from alternatives?

## Example: Canva

| Part | Value |
|---|---|
| Who | Non-designers who need to create marketing graphics |
| Why | They need professional-looking designs but can't hire designers or use complex tools |
| What Before | Using PowerPoint, Photoshop (too complex), or hiring expensive designers |
| How | Drag-and-drop templates, built-in design elements, AI design assistance, intuitive interface |
| What After | Create professional designs in minutes, launch campaigns faster, save design costs |
| Alternatives | Photoshop (complex), Fiverr (slow, expensive), Canva competitors (fewer templates, harder UX) |

## Output process

**Develop the six parts, then write the value and positioning statements.**

1. Identify and profile the target customer segment.
2. Define the core problem and JTBD.
3. Describe the current state and friction points.
4. Articulate how the product solves the problem.
5. Envision the improved outcome.
6. Compare against competitive alternatives.
7. Create a concise value prop statement (1-2 sentences).
8. Develop a positioning statement for marketing use.

### Domain context

Strategyzer's Value Proposition Canvas, by Alexander Osterwalder, is widely used but has structural limitations. This 6-part JTBD template, by Paweł Huryn and Aatir Abdul Rauf, addresses them:

- **Start with the customer and work toward the solution.** This template begins with Who/Why. Strategyzer's canvas puts the product on the left, often leading teams to start with their solution instead of the customer's problem.
- **Use one segment per pass.** Strategyzer's canvas encourages mapping multiple products/services simultaneously, which dilutes focus.
- **Name what customers would use without you and why you're better.** Section 6 (Alternatives) requires both. Strategyzer's canvas has no equivalent, so you don't directly confront substitutes.
- **Use "What before → How → What after" for a simpler structure.** It is easier to fill out than separating Customer Jobs, Pains and Gains from Pain Relievers, Gain Creators and Products. That separation often creates confusion about where things go.
- **The final Value Proposition Statement is ready for marketing, sales and onboarding.** Strategyzer's canvas doesn't produce a reusable statement.

**Use Strategyzer's canvas for detailed pains/gains decomposition of a mature product's complex customer needs.** Use this 6-part template for clarity, speed and actionable output.

## How you can tell it worked

All six parts are filled from evidence, and the statement names the alternative the customer uses today. Someone in the segment would recognise their own situation in it.

## Notes

- **Jobs to Be Done focuses on the progress the customer is trying to make.** Its focus is not demographics.
- **Value propositions are segment-specific.** You may have different value props for different customer groups.
- **A stronger value prop makes marketing, sales and product decisions easier.**
- **Test value props with real customers before finalizing.**
- **Use a Value Curve to compare offerings on factors this segment values.** Apply the `pe-value-curve` skill (Blue Ocean Strategy) for comparison with competitors and substitutes. It gives section 6 its evidence.

### Templates

- [Value Proposition Template (PPTX)](https://docs.google.com/presentation/d/1RXH1Udj71aXQJzGeqYSOStnfQ-6dNz14/edit?slide=id.g2a98aeea3b1_0_247#slide=id.g2a98aeea3b1_0_247)
