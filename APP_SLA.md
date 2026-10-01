# Service Level Agreement (SLA)
## Bottleneck: Time in Status & SLAs (monday.com Marketplace App)

**Effective Date:** October 1, 2026  
**Document Version:** 1.0.0  

---

### 1. Service Commitment & Uptime Guarantee
We commit to delivering high-availability cloud services for the **Bottleneck: Time in Status & SLAs** application with an **Overall Monthly Uptime Guarantee of 99.9%** (excluding scheduled maintenance windows).

$$\text{Uptime Percentage} = \frac{\text{Total Minutes in Month} - \text{Downtime Minutes}}{\text{Total Minutes in Month}} \times 100 \ge 99.9\%$$

---

### 2. Incident Classification & Support Response Times

| Severity Level | Description | Target Initial Response | Target Resolution Time |
| :--- | :--- | :--- | :--- |
| **Sev 1 - Critical** | Core webhook processing or background queue completely down across multiple accounts. | **< 30 minutes** | **< 4 hours** |
| **Sev 2 - Major** | Performance degradation, Redis cache synchronization delay, or dashboard visual glitches affecting single accounts. | **< 2 hours** | **< 12 hours** |
| **Sev 3 - Minor** | Minor UI bugs, question on SLA configuration rules, or non-blocking feature requests. | **< 8 business hours** | **Next release cycle** |

---

### 3. Data Protection & Security Standards
- **Zero Raw Data Retention**: Only item IDs, board IDs, and status transition timestamps are stored. Pulse descriptions, private comments, and board attachments are never captured or cached.
- **Encryption**: All data in transit is encrypted using TLS 1.3. All PostgreSQL volumes and Redis caches in production are encrypted at rest using AES-256.
- **Token Handling**: monday.com OAuth tokens and API signing secrets are encrypted using environment-isolated secrets management.
- **GDPR & Privacy Compliance**: Full compliance with Right to Be Forgotten. Uninstalling the app cascades automated deletion of all associated `status_events` and `alert_logs`.

---

### 4. Recovery Point & Recovery Time Objectives (RPO / RTO)
- **Recovery Point Objective (RPO):** $< 1\text{ hour}$ (Automated continuous database WAL archiving).
- **Recovery Time Objective (RTO):** $< 2\text{ hours}$ (Automated container redeployment via Docker / Kubernetes orchestration).

---

### 5. Scheduled Maintenance
Scheduled system updates occur during low-traffic windows (Sundays 02:00 – 04:00 UTC) and will be announced at least 48 hours in advance via the monday.com Developer App Dashboard.
