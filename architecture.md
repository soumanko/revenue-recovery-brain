# Revenue Recovery Brain — System Architecture

**Revenue Recovery Brain** is an autonomous, event-driven AI revenue recovery orchestration platform designed for e-commerce, D2C, fintech, and subscription merchants. It intercepts failed payments, checkout abandonments, and subscription churn events, diagnoses root causes, scores recoverability using multi-factor probability models, and executes policy-governed interventions (intelligent retries, personalized customer notifications, and Hinglish voice outreach) with explainable audit trails.

---

## 1. High-Level System Architecture

The application is architected as a full-stack Next.js 16 application featuring an autonomous agent loop, an in-memory transactional datastore, and a real-time reactive user interface.

```mermaid
flowchart TB
    subgraph ClientLayer["Frontend Presentation Layer (Next.js 16 + React 19)"]
        UI_Dash["Dashboard (/)"]
        UI_Cases["Case Management (/cases & /cases/[id])"]
        UI_Batch["Batch Runner Studio (/batch)"]
        UI_Voice["Hinglish Voice Recovery Simulator (/voice)"]
        UI_Policy["Merchant Policy Rules (/policy)"]
        UI_Audit["Explainability & Audit Trail (/audit)"]
        UI_Analytics["Revenue & Channel Analytics (/analytics)"]
    end

    subgraph APILayer["API Routing & Controllers (Next.js App Router)"]
        API_Agent["/api/agent/process & /api/agent/activity"]
        API_Cases["/api/cases & /api/cases/[id]"]
        API_Batch["/api/batch"]
        API_Dash["/api/dashboard"]
        API_Policy["/api/policy"]
        API_Audit["/api/audit"]
        API_Analytics["/api/analytics"]
        API_Seed["/api/seed"]
    end

    subgraph AgentCore["Autonomous Recovery Agent Engine (src/lib/agent.ts)"]
        Diag["1. Diagnosis Engine (analyzeRevenueRisk)"]
        CustCtx["2. Customer Context Resolver (getCustomerContext)"]
        Scorer["3. Multi-Factor Scoring Engine (calculateRecoveryScore)"]
        PolicyArb["4. Policy Arbiter & Action Selector (selectRecoveryAction)"]
        ExecEng["5. Action Execution Engine (executeRecoveryAction)"]
        Auditor["6. Audit & Explainability Logger (recordAuditEvent)"]
        ActivityEng["7. Live Activity Feed Generator (recordActivity)"]
    end

    subgraph DataLayer["Persistence & In-Memory Datastore (src/lib/store.ts)"]
        Store_Events[("Risk Events Map")]
        Store_Customers[("Customer Profiles Map")]
        Store_Cases[("Recovery Cases Map")]
        Store_Actions[("Recovery Actions Map")]
        Store_Batches[("Batch Runs Map")]
        Store_Audit[("Audit Log Array")]
        Store_Feed[("Activity Feed Array")]
        Store_Policy[("Merchant Policy Config")]
    end

    ClientLayer <-->|HTTP / REST API| APILayer
    APILayer <-->|Invoke Pipeline & Fetch State| AgentCore
    AgentCore <-->|CRUD & State Transitions| DataLayer
    APILayer <-->|Direct Read Queries| DataLayer
```

---

## 2. Autonomous Agent Lifecycle & State Machine

The recovery engine follows a 7-step autonomous lifecycle. When a risk event enters the system, it transitions through well-defined lifecycle states governed by merchant policies.

```mermaid
stateDiagram-v2
    [*] --> DETECTED: Risk Event Ingested (Payment / Abandonment / Subscription)
    DETECTED --> DIAGNOSING: Agent Ingestion
    DIAGNOSING --> ACTION_SELECTED: Risk Evaluated & Score Calculated

    state ACTION_SELECTED {
        [*] --> CheckPolicy
        CheckPolicy --> ImmediateRetry: Transient & Score >= 70%
        CheckPolicy --> VoiceOutreach: Value >= MinVoice & Score >= 50% & Hinglish
        CheckPolicy --> DelayedRetry: Moderate Score 40-65%
        CheckPolicy --> CustomerNotification: Abandonment / Low Score
        CheckPolicy --> Escalation: Low Score 20-39% / Human Review
        CheckPolicy --> StopRecovery: Limits Exceeded / Permanently Unrecoverable
    }

    ACTION_SELECTED --> ACTION_EXECUTING: Action Dispatched
    ACTION_EXECUTING --> WAITING_FOR_RESULT: Awaiting Gateway / Customer Response
    WAITING_FOR_RESULT --> RECOVERED: Payment Succeeded (Funds Captured)
    WAITING_FOR_RESULT --> STOPPED: Policy Limit Hit / Hard Decline
    WAITING_FOR_RESULT --> ESCALATED: Manual Queue Dispatch
    WAITING_FOR_RESULT --> FAILED: Action Did Not Succeed

    FAILED --> DIAGNOSING: Follow-up Attempt (If Retries & Contacts < Max)
    FAILED --> STOPPED: Max Attempts or Contact Exhausted

    RECOVERED --> [*]
    STOPPED --> [*]
    ESCALATED --> [*]
```

### State Machine Transition Rules

| State | Description | Next Allowed States | Exit Conditions |
| :--- | :--- | :--- | :--- |
| `DETECTED` | Initial event ingestion (payment failure, checkout abandonment, recurring billing error). | `DIAGNOSING` | Case initialized and enqueued for agent evaluation. |
| `DIAGNOSING` | The failure reason, error category, and transience are parsed. | `ACTION_SELECTED` | Diagnosis result generated and recoverability classified. |
| `ACTION_SELECTED` | The multi-factor score is computed and matched against merchant policy. | `ACTION_EXECUTING` | Action selected (retry, call, notification, escalate, stop). |
| `ACTION_EXECUTING` | The intervention is dispatched via payment gateway, telephony, or messaging. | `WAITING_FOR_RESULT` | Gateway / channel execution call submitted. |
| `WAITING_FOR_RESULT` | System monitors execution feedback or customer payment webhook. | `RECOVERED`, `FAILED`, `STOPPED`, `ESCALATED` | Response received or timeout elapsed. |
| `RECOVERED` | Terminal state. Funds successfully captured and verified. | `[*]` | Revenue credited; audit trail finalized. |
| `FAILED` | Intermediate failure state. Agent triggers fallback evaluation. | `DIAGNOSING`, `STOPPED` | Policy permits follow-up or triggers termination. |
| `STOPPED` | Terminal state. Recovery abandoned due to policy limits or hard decline. | `[*]` | Prevents further retries or customer spam. |
| `ESCALATED` | Terminal state. Handed off to human merchant operations queue. | `[*]` | Edge cases requiring manual intervention. |

---

## 3. Decision-Making & Multi-Factor Scoring Engine

Before selecting any intervention, the agent evaluates the transaction using an algorithmic multi-factor scoring model that outputs a **Recovery Probability Score (0–100%)**.

```mermaid
flowchart LR
    subgraph Inputs["Input Signals"]
        S1["Failure Transience<br/>(Bank Timeout / Gateway / Insufficient Funds)"]
        S2["Customer History<br/>(Successful Payments / Total Orders)"]
        S3["Retry Freshness<br/>(Previous Attempt Count Penalty)"]
        S4["Time Freshness<br/>(Decay Hours Since Detection)"]
        S5["Transaction Value<br/>(Order Amount Significance)"]
        S6["Customer Loyalty<br/>(LTV & Total Orders)"]
    end

    subgraph Weights["Weight Distribution"]
        W1["30% Weight"]
        W2["25% Weight"]
        W3["15% Weight"]
        W4["10% Weight"]
        W5["10% Weight"]
        W6["10% Weight"]
    end

    subgraph Engine["Scoring Engine"]
        Calc["Score = Sum(Factor Value * Weight)"]
        Bound["Bounded [0 - 100%]"]
    end

    subgraph Output["Decision Engine"]
        ScoreOut["Recovery Score %"]
        ActionDecide["Action Policy Arbiter"]
    end

    S1 --> W1 --> Calc
    S2 --> W2 --> Calc
    S3 --> W3 --> Calc
    S4 --> W4 --> Calc
    S5 --> W5 --> Calc
    S6 --> W6 --> Calc
    Calc --> Bound --> ScoreOut --> ActionDecide
```

### Mathematical Factor Weights

$$\text{Recovery Score} = \sum_{i=1}^{6} (\text{Value}_i \times \text{Weight}_i)$$

1. **Failure Transience ($30\%$)**:
   - Transient network/gateway/bank timeouts = $95$ pts
   - Insufficient funds = $50$ pts
   - Expired cards = $20$ pts
   - Hard declines = $15$ pts
2. **Customer Historical Success Rate ($25\%$)**:
   - Ratio of past successful payments to total lifetime orders ($\% \times 0.25$).
3. **Retry Freshness ($15\%$)**:
   - Penalizes repeated failures: $\max(0, 100 - (\text{retryCount} \times 40))$.
4. **Time Freshness ($10\%$)**:
   - Accounts for lead decay: $\max(0, 100 - (\text{hoursSinceFailure} \times 3))$.
5. **Transaction Value Relevance ($10\%$)**:
   - Balances urgency for higher ticket sizes: $\min(100, (\text{amount} / 5000) \times 60 + 40)$.
6. **Customer Loyalty ($10\%$)**:
   - Rewards repeat, high-LTV customers: $\min(100, \text{totalOrders} \times 8 + (\text{totalSpent} > 50000 \,?\, 20 : 0))$.

---

## 4. Merchant Policy & Governance Guardrails

The engine operates under strict merchant-configured guardrails to ensure customer protection, spam prevention, and compliance with banking standards.

```mermaid
flowchart TD
    StartCheck["Case Action Evaluation"] --> LimitCheck{"Exceeded Policy Limits?<br/>(Retries >= MaxRetries AND Contacts >= MaxContacts)"}
    
    LimitCheck -- Yes --> StopPolicy["Action: stop_recovery<br/>Reason: Policy limits reached"]
    LimitCheck -- No --> WindowCheck{"Elapsed Time > recoveryWindowHours?"}
    
    WindowCheck -- Yes --> StopWindow["Action: stop_recovery<br/>Reason: Recovery window expired"]
    WindowCheck -- No --> HardDecline{"Failure Reason = permanently_unrecoverable?"}
    
    HardDecline -- Yes --> StopDecline["Action: stop_recovery<br/>Reason: Unrecoverable decline"]
    HardDecline -- No --> MinProb{"Score < minRecoveryProbabilityForRetry?"}
    
    MinProb -- Yes --> NotifyOrStop{"Customer Contacts < MaxContacts?"}
    NotifyOrStop -- Yes --> Notify["Action: customer_notification"]
    NotifyOrStop -- No --> StopMin["Action: stop_recovery"]
    
    MinProb -- No --> HighValueVoice{"Amount >= minAmountForVoiceRecovery<br/>AND Voice Enabled<br/>AND Hinglish Preferred<br/>AND Score >= 50%?"}
    
    HighValueVoice -- Yes --> VoiceCall["Action: hinglish_voice_call"]
    HighValueVoice -- No --> TransientHigh{"Transient = True AND Score >= 70%?"}
    
    TransientHigh -- Yes --> ImmRetry["Action: immediate_retry"]
    TransientHigh -- No --> DelayedOrEscalate{"Score >= 40%?"}
    
    DelayedOrEscalate -- Yes --> DelayRetry["Action: delayed_retry"]
    DelayedOrEscalate -- No --> Escalate["Action: escalation (Manual Review)"]
```

### Configurable Merchant Policy Parameters

| Policy Parameter | Default | Purpose & Guardrail |
| :--- | :--- | :--- |
| `maxRetries` | `2` | Maximum automated payment gateway retry attempts per case. |
| `maxCustomerContacts` | `2` | Maximum direct notifications/calls to prevent customer harassment. |
| `recoveryWindowHours` | `48` | Time-to-live (TTL) for automated recovery eligibility. |
| `minRecoveryProbabilityForRetry` | `65%` | Minimum score threshold required to trigger automated gateway retries. |
| `minAmountForVoiceRecovery` | `₹2,000` | Minimum order value required to initiate a conversational voice recovery call. |
| `enableVoiceRecovery` | `true` | Master toggle for conversational Hinglish voice agent. |
| `enableAutoRetry` | `true` | Master toggle for autonomous background gateway retries. |

---

## 5. Conversational Hinglish Voice Recovery Architecture

For high-value transactions and cart abandonments in the Indian market, the platform deploys an interactive voice recovery agent speaking natural **Hinglish** (Hindi + English blend).

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant VoiceUI as Voice Simulator UI (/voice)
    participant Agent as Agent Execution Engine
    participant Store as In-Memory Store & Audit

    Agent->>VoiceUI: Evaluate High-Value Case (e.g. ₹8,500, Score: 88%)
    VoiceUI->>Customer: Initiates Outbound Call (State: ringing)
    Customer->>VoiceUI: Accepts Call (State: connected)
    VoiceUI->>Customer: "Namaste Rahul ji! Main Revenue Recovery Brain se bol raha hoon..."
    Customer->>VoiceUI: "Haan, boliye."
    VoiceUI->>Customer: "Aapka ₹8,500 ka payment bank timeout ki wajah se complete nahi hua. Dobara try karein?"
    Customer->>VoiceUI: "Haan, kar do."
    VoiceUI->>Agent: Trigger Synchronous Payment Retry
    Agent->>Store: Execute Gateway Re-attempt
    Store-->>Agent: Gateway Capture Successful (200 OK)
    Agent-->>VoiceUI: Payment Success Confirmation
    VoiceUI->>Customer: "Payment successfully complete ho gaya! ₹8,500 recover ho gaya. Dhanyavaad!"
    VoiceUI->>Store: Persist Call Transcript, Duration, and Recovery Metric
    VoiceUI->>Store: Emit Audit Log & Activity Feed Item
```

---

## 6. Relational Entity-Relationship Diagram (ERD)

The data layer is structured around an in-memory transactional datastore supporting relational references and query indices.

```mermaid
erDiagram
    CUSTOMER ||--o{ REVENUE_RISK_EVENT : experiences
    CUSTOMER ||--o{ RECOVERY_CASE : owns
    REVENUE_RISK_EVENT ||--|| RECOVERY_CASE : triggers
    RECOVERY_CASE ||--o{ RECOVERY_ACTION : executes
    RECOVERY_CASE ||--o{ AUDIT_ENTRY : logs
    BATCH_RUN ||--o{ RECOVERY_CASE : aggregates

    CUSTOMER {
        string id PK
        string name
        string email
        string phone
        int totalOrders
        int successfulPayments
        int failedPayments
        float averageOrderValue
        float totalSpent
        string preferredLanguage
        string createdAt
    }

    REVENUE_RISK_EVENT {
        string id PK
        string eventType "payment_failure | checkout_abandonment | subscription_failure"
        string customerId FK
        float amount
        string currency
        string failureReason
        string orderId
        int retryCount
        int previousSuccessfulPayments
        string createdAt
    }

    RECOVERY_CASE {
        string id PK
        string eventId FK
        string customerId FK
        string batchId FK
        string state "DETECTED | DIAGNOSING | ACTION_SELECTED | ACTION_EXECUTING | WAITING_FOR_RESULT | RECOVERED | FAILED | STOPPED | ESCALATED"
        float recoveryScore
        string recoverability
        string selectedAction
        int totalAttempts
        int customerContacts
        float amountAtRisk
        float amountRecovered
        string recoveryChannel
        int recoveryTimeMs
        string createdAt
        string resolvedAt
    }

    RECOVERY_ACTION {
        string id PK
        string caseId FK
        string actionType
        string actionReason
        string status "pending | executing | success | failed | skipped"
        float amountRecovered
        int executionTimeMs
        string createdAt
    }

    AUDIT_ENTRY {
        string id PK
        string eventId FK
        string caseId FK
        string timestamp
        string decision
        string reason
        float recoveryProbability
        string policy
        string action
        string actionResult
        float amountAtRisk
        float amountRecovered
        string agentState
    }

    BATCH_RUN {
        string id PK
        int totalCases
        int processedCases
        int recoveredCases
        int failedCases
        int stoppedCases
        int escalatedCases
        float totalAtRisk
        float totalRecovered
        string status "pending | processing | completed"
        string createdAt
        string completedAt
    }

    MERCHANT_POLICY {
        string id PK
        int maxRetries
        int maxCustomerContacts
        int recoveryWindowHours
        float minRecoveryProbabilityForRetry
        float minAmountForVoiceRecovery
        boolean enableVoiceRecovery
        boolean enableAutoRetry
        string updatedAt
    }
```

---

## 7. Component & Route Architecture

The frontend is organized into modular views connected to backend REST API endpoints:

```mermaid
graph TD
    subgraph UI_Pages["Next.js App Pages"]
        P_Dash["/ (Dashboard)"]
        P_Cases["/cases (Cases List)"]
        P_CaseDetail["/cases/[id] (Case Detail & Timeline)"]
        P_Batch["/batch (Batch Processing)"]
        P_Voice["/voice (Hinglish Voice Simulator)"]
        P_Policy["/policy (Policy Controls)"]
        P_Audit["/audit (Audit & Explainability)"]
        P_Analytics["/analytics (Analytics & Charts)"]
    end

    subgraph API_Endpoints["API Route Handlers"]
        A_Dash["/api/dashboard"]
        A_Cases["/api/cases & /api/cases/[id]"]
        A_AgentProc["/api/agent/process"]
        A_AgentAct["/api/agent/activity"]
        A_Batch["/api/batch"]
        A_Policy["/api/policy"]
        A_Audit["/api/audit"]
        A_Analytics["/api/analytics"]
        A_Seed["/api/seed"]
    end

    subgraph Shared_Libs["Core Library Modules"]
        L_Agent["src/lib/agent.ts (Autonomous Engine)"]
        L_Store["src/lib/store.ts (DataStore Singleton)"]
        L_Types["src/lib/types.ts (Domain Interfaces)"]
        L_Utils["src/lib/utils.ts (Formatters & Helpers)"]
    end

    P_Dash --> A_Dash
    P_Dash --> A_AgentAct
    P_Cases --> A_Cases
    P_CaseDetail --> A_Cases
    P_CaseDetail --> A_AgentProc
    P_Batch --> A_Batch
    P_Voice --> A_AgentProc
    P_Policy --> A_Policy
    P_Audit --> A_Audit
    P_Analytics --> A_Analytics

    A_Dash & A_Cases & A_Batch & A_Policy & A_Audit & A_Analytics & A_Seed --> L_Store
    A_AgentProc & A_Batch --> L_Agent
    L_Agent --> L_Store
    L_Agent & L_Store --> L_Types
```

### Module Responsibilities

1. **[`src/lib/agent.ts`](file:///d:/revenue-recovery-brain/src/lib/agent.ts)**:
   - Contains pure and transactional agent functions: `analyzeRevenueRisk`, `calculateRecoveryScore`, `selectRecoveryAction`, `executeRecoveryAction`, and `processRecoveryCase`.
   - Implements the complete policy verification and decision audit trail generation.
2. **[`src/lib/store.ts`](file:///d:/revenue-recovery-brain/src/lib/store.ts)**:
   - Singleton `DataStore` pattern holding fast in-memory Maps for cases, events, customers, actions, batches, and audit records.
   - Includes realistic seed data tailored for Indian commerce (INR currency, Hinglish speakers, realistic UPI/card failure patterns).
3. **[`src/lib/types.ts`](file:///d:/revenue-recovery-brain/src/lib/types.ts)**:
   - Strongly typed TypeScript domain models, enums for recovery states, failure categories, and agent execution results.
4. **[`src/lib/utils.ts`](file:///d:/revenue-recovery-brain/src/lib/utils.ts)**:
   - INR currency formatting (`₹X,XX,XXX`), relative timestamps, and visual status badge styling helpers.

---

## 8. Security, Compliance & Explainability Standards

1. **No Black-Box Decisions**:
   - Every single transition records an `AuditEntry` detailing the exact mathematical score breakdown, merchant policy thresholds in effect at runtime, and textual reasoning.
2. **Contact Fatigue Prevention**:
   - Customer contacts are strictly capped via `maxCustomerContacts` to prevent spam, brand erosion, and telemarketing regulatory violations.
3. **Gateway Protection**:
   - Enforces exponential backoff and maximum retry caps (`maxRetries`) to prevent issuing bank velocity blocks and gateway penalties.
4. **Data Isolation**:
   - Case records maintain immutable links between original risk events, actions taken, and final capture confirmations.
