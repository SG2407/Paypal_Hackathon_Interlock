# Project Execution Instructions — PayPal Hackathon: IntentLock

You are my lead full-stack engineer and technical architect. We are building **IntentLock** for the PayPal AI Hackathon.

## 1. Read and follow the original requirements

Before writing code:

1. Refer back to the **PayPal Hackathon problem statement and requirements I previously provided in this conversation**. Treat those requirements as the source of truth for the competition.
2. Refer back to the **complete IntentLock project specification and implementation prompt** I previously gave you. It contains the product concept, architecture, technology stack, database models, API routes, AI functionality, PayPal integration, security requirements, testing strategy, and demo scenario.
3. Review the existing repository and understand its current structure before making changes.
4. If the original requirements or specification are not available in your context, ask me to provide them again. Do not invent missing requirements.

Your implementation must satisfy both the hackathon requirements and the IntentLock specification. Do not replace the core idea with a generic shopping application or a basic PayPal checkout integration.

## 2. Build the actual working product

Do not stop after producing a plan, architecture document, or sample UI.

Implement the application end to end, including:

- AI-powered natural-language shopping intent compilation.
- Structured, versioned permission policies.
- Product discovery and AI recommendations based on the seeded catalog.
- Deterministic authorization decisions: PASS, REVIEW, and BLOCK.
- PayPal Sandbox Orders API integration.
- PayPal buyer approval flow.
- Server-side order verification and policy revalidation before capture.
- Protection against price, product, quantity, subscription, and other purchase-detail tampering.
- Intent Receipt with PayPal transaction references and validation results.
- Hash-chained audit events.
- A convincing demonstration of both a successful purchase and a blocked tampered purchase.

Follow the full specification for the technology stack, database, routes, UI, security, and acceptance criteria.

## 3. Work incrementally and verify every feature

Build in logical milestones rather than attempting the entire application in one uncontrolled pass.

Suggested milestones:

1. Repository inspection, architecture, project setup, and dependencies.
2. Database schema, migrations, seed data, and catalog.
3. Intent compiler and structured policy generation.
4. Deterministic policy engine and automated tests.
5. Product discovery, recommendations, and evaluation UI.
6. PayPal Sandbox order creation and buyer approval.
7. Server-side verification, revalidation, and secure capture.
8. Intent Receipt and audit trail.
9. Tampering simulation and complete end-to-end demonstration.
10. Final UI polish, documentation, deployment readiness, and hackathon checklist.

You can adjust the order if dependencies require it, but preserve the complete functionality.

For every milestone:

- Implement the feature completely.
- Run the relevant tests.
- Run TypeScript checks and linting.
- Fix errors before moving forward.
- Verify that existing functionality has not regressed.
- Tell me what was completed and what remains.

Do not mark a feature complete just because the code has been written. It must actually work and be tested.

## 4. IMPORTANT: Commit and push to GitHub periodically

I want the project pushed to GitHub throughout development, not just at the very end.

Follow this Git workflow strictly:

1. First inspect the Git status, current branch, remote configuration, and existing commits.
2. Do not overwrite or delete existing work.
3. If a GitHub remote is already configured, use it. If not, tell me what setup or repository information is needed.
4. After each major milestone is fully implemented and its relevant tests pass:
   - Review the changed files.
   - Ensure no secrets, API keys, access tokens, `.env` files, or credentials are included.
   - Ensure `.gitignore` is configured correctly.
   - Run the relevant tests, type checks, and lint checks.
   - Create a descriptive Git commit.
   - Push the commit to the configured GitHub remote.
5. Use clear commit messages, for example:
   - `chore: initialize IntentLock project`
   - `feat: implement intent compiler and policy schema`
   - `feat: add deterministic purchase authorization engine`
   - `feat: integrate PayPal sandbox checkout`
   - `feat: add secure pre-capture validation`
   - `feat: implement intent receipts and audit trail`
   - `test: add tampering and end-to-end coverage`
   - `docs: finalize hackathon setup and demo guide`

**Git push rules:**
- Push after every successfully completed major milestone, not after every tiny code change.
- Do not push broken, incomplete, or untested milestone code.
- Do not wait until the entire application is finished to make the first push.
- Never force-push, rewrite shared history, or delete branches without asking me.
- Never commit secrets, credentials, private keys, or real customer information.
- If a push fails because authentication, permissions, or remote configuration requires my action, explain the exact issue and tell me what I need to do. Continue working locally where possible.
- After every successful push, report the commit hash, milestone, and pushed branch.

## 5. PayPal integration and security are critical

Use PayPal Sandbox only.

- Consult the current official PayPal documentation before implementing the Orders API and JavaScript SDK flow.
- Verify the actual SDK version and API methods instead of assuming names or copying outdated examples.
- Keep PayPal client secrets and OpenRouter API keys on the server.
- Never trust client-submitted product prices, totals, or order details.
- Derive purchase amounts from server-side product and order data.
- Retrieve the actual PayPal order before capture.
- Verify buyer approval, order status, currency, amount, items, and the saved purchase snapshot.
- Re-evaluate the applicable permission policy immediately before capture.
- Block capture if any required validation fails.
- Use idempotency protections for order creation and capture.
- Never capture a payment solely because an AI model recommends a product.
- Require explicit buyer approval through PayPal.
- Never enable live PayPal payments for this hackathon prototype.

AI may interpret intent and recommend products, but **the deterministic server-side policy engine must make the authorization decision**. AI output must never override a policy decision.

## 6. Keep the implementation hackathon-ready

The finished application must be:

- Functional, not just a mockup.
- Visually polished and easy to demonstrate.
- Easy for judges to understand within a short demo.
- Properly documented.
- Configurable through environment variables.
- Safe to run using PayPal Sandbox credentials.
- Suitable for deployment if time permits.

Make sure the repository includes:

- A comprehensive README with setup instructions.
- `.env.example` with placeholder values only.
- `.gitignore`.
- An appropriate open-source license.
- Architecture and data-flow documentation.
- Testing instructions.
- PayPal Sandbox setup instructions.
- A short demo script covering the successful purchase and tampering-block scenario.

Keep the hackathon's submission requirements in mind, including the public GitHub repository, working prototype, and short YouTube demonstration.

## 7. How to communicate with me

Work autonomously wherever the specification is clear. Do not ask me to approve every implementation decision.

Ask me only when you genuinely need information or an action that I must provide, such as:

- GitHub authentication or repository access.
- PayPal Sandbox client ID and secret.
- OpenRouter API key.
- An important product or architecture decision that cannot reasonably be inferred.

Do not ask me to paste credentials into source code or commit them.

At the end of each milestone, give me a concise report containing:

1. What you implemented.
2. What you tested and the results.
3. Whether the Git commit and push succeeded.
4. The commit hash and branch, if pushed.
5. Any remaining blockers.
6. The next milestone.

## 8. Start now

Begin by reviewing the original PayPal Hackathon problem statement, the IntentLock specification, and the existing repository.

Then inspect Git and the configured GitHub remote.

Give me a brief implementation plan and immediately start building. Do not stop after presenting the plan.

**Priority: deliver a genuinely working, secure, impressive PayPal-integrated AI prototype before the hackathon deadline. Test continuously, preserve working code, and push every completed major milestone to GitHub.**