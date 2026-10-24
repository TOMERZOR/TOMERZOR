# Hidden Manual Work: Back-Office Workflows AI Agents Could Automate (2025–2026), and Lessons from Failed Startups

Research date: 2026-10-24. Audience: a solo or small-team Israeli founder building web and mobile apps, looking for a startup idea with real pain.

Method note: about 35 web searches. WebFetch failed with DNS errors on ycombinator.com, modelence.com and roundfunded.com, so YC RFS findings rely on search snippets and secondary coverage. Funding figures mostly come from press releases or trade press, not from independent verification. Where sources disagree, the notes say so.

---

## Q1. Which back-office workflows are dominated by manual coordination, and how much labor do they involve?

### Takeaway
The strongest labor evidence is in US healthcare admin, bookkeeping and accounting clerks, and freight brokerage operations.
- Prior auth: about 39 requests per physician per week, about 13 staff hours per week, and roughly 35–40% of physicians employ dedicated staff.
- Claim denials: about 12% of claims denied, about $262B in lost provider revenue.
- Bookkeeping clerks: about 1.5–1.6M US jobs at about $49–51K median pay.

Hard labor numbers for niche workflows (COI tracking, docketing, IEPs, grant reporting) are thin. They mostly come from vendor claims.

### Cited Findings

**Healthcare: prior authorization (PA)**
- In the AMA 2024 Prior Authorization Physician Survey (December 2024, 1,000 physicians, Medscape panel), practices completed 39 PA requests per physician per week. Sources give about 12–13 staff hours per week. — [AMA](https://ama-assn.org/practice-management/prior-authorization/fixing-prior-auth-nearly-40-prior-authorizations-week-way); [AJMC summary](https://www.ajmc.com/view/ama-survey-highlights-growing-burden-of-prior-authorization-on-physicians-patients)
- Sources disagree on the share of physicians who employ staff working exclusively on PA: 35% in one summary, 40% in another. — [AJMC](https://www.ajmc.com/view/ama-survey-highlights-growing-burden-of-prior-authorization-on-physicians-patients); [HMP Global](https://www.hmpglobalevents.com/tciv/news-insights/prior-authorization-burden-hidden-valuation-driver-ama-finds-39-prior-auth)

**Healthcare: claim denials and billing**
- About 12% of claims were denied in 2024, costing providers about $262B in lost revenue. This is an industry figure cited in funding coverage. — [MedCity News](https://medcitynews.com/2026/04/startup-helping-providers-manage-denied-claims-raises-16m/)
- Medical records specialists: median annual wage $50,250 (May 2024). Employment is projected to grow 7% from 2024 to 2034, with about 14,200 openings per year. — [BLS OOH](https://www.bls.gov/ooh/Healthcare/Medical-records-and-health-information-technicians.htm)
- Billing and posting clerks: about 430,220 employed, median wage $45,590 (May 2023, the latest year found). — [BLS OES 43-3021](https://www.bls.gov/oes/2023/may/oes433021.htm)

**Healthcare: insurance or benefits verification calls**
- Infinitus' platform calls payers about claims, prior authorizations and benefit verification. It navigates IVR systems and waits on hold until a live agent answers. This shows the work is largely phone-based hold time. — [MobiHealthNews](https://www.mobihealthnews.com/news/infinitus-systems-raises-515m-automating-healthcare-calls)

**Accounting: bookkeeping, AP and close**
- Bookkeeping, accounting and auditing clerks: 1,613,400 jobs in 2024, median pay $49,210. Employment is projected to fall 6% over 2024–34. The newer page shows 1,532,400 jobs in 2025, median $50,670. — [BLS OOH](https://www.bls.gov/ooh/office-and-administrative-support/bookkeeping-accounting-and-auditing-clerks.htm)

**Freight brokerage: track-and-trace and back office**
- Freight Hero runs brokers' back-office work for a flat fee per load. Its AI agents handle more than 90% of customer load interactions, with humans ("Heroes") handling exceptions.
- Its customer Ally Logistics reported 82.4% year-over-year revenue growth "without a meaningful increase in operations headcount." That implies track-and-trace headcount normally scales with load volume.
- Source: [FreightWaves](https://freightwaves.com/news/freight-hero-broker-back-office)
- Chain's "Autopilot" automates check calls, proof-of-delivery collection, driver and dispatcher Q&A, and TMS status updates. These are the core manual tasks of track-and-trace reps. — [Fulfill.com partner page](https://www.fulfill.com/partners/chain)

**Freight brokerage: carrier onboarding and fraud**
- Highway (founded 2022) does real-time carrier verification and automated compliance workflows. It says it serves 1,050+ brokers, including 70 of the top 100 US brokers. — [FreightWaves](https://www.freightwaves.com/news/carrier-identity-platform); [Dallas Innovates](https://dallasinnovates.com/dallas-based-highway-raises-strategic-growth-investment-to-accelerate-growth-fight-freight-fraud/)

**Customs brokerage**
- Customs broker licensing exam pass rates "hover around 10% to 20%," part of the founders' pitch for AI given the scarcity of licensed labor. Tariff volatility in 2025–26 increased filing complexity. — [TechCrunch (Amari AI)](https://techcrunch.com/2026/02/19/this-former-big-tech-engineers-are-using-ai-to-navigate-trumps-trade-chaos/)

**Construction permitting (vendor claims)**
- PermitFlow claims customers shortened timelines by up to 60%, cut administrative workload by 90%, and achieved 5x ROI. These are company claims, not independently verified. — [Business Wire](https://www.businesswire.com/news/home/20251202551013/en)

**Special education IEP paperwork**
- 57% of special-ed teachers used AI to help develop individualized plans in 2024–25, up from 39% the year before (CDT survey). 45 states reported special-ed teacher shortages in 2024–25. — [NPR via Michigan Public](https://www.michiganpublic.org/2026-05-20/overworked-and-understaffed-special-ed-teachers-turn-to-ai-for-help)
- BridgeEd AI claims its IEP tool cuts paperwork by 40%. This is a vendor claim on an MIT Solve pitch page. — [MIT Solve](https://solve.mit.edu/solutions/96927)

**Legal: docketing**
- Mitratech says its ARIES docket management cut manual docketing effort by up to 66%. This is a vendor claim from a March 2026 launch. — [Mitratech](https://mitratech.com/?p=102551)
- CourtDrive's AI docketing assistant extracts dates and deadlines from federal and state court eNotices (PDFs) and syncs them to calendars. That indicates this work is still done by hand in many firms. — [CourtDrive](https://www.courtdrive.com/)

**Nonprofit grants**
- Instrumentl has 4,500 clients. It says customers win about $1.1M more in grants per year and cut prospecting time by three-quarters (company claim). — [Summit Partners](https://www.summitpartners.com/news/instrumentl-raises-55m-from-summit-partners-to-accelerate-their-ai-grant-fundraising-platform)

### Inferences
- Healthcare revenue-cycle workflows (PA, eligibility, denials) have the best-documented labor cost. That is also why capital crowded in (see Q2).
- Freight brokerage shows a clean model: operations headcount scales linearly with loads, and AI breaks that link. This is the "services as software" pattern in its simplest form.
- Most niche workflows lack public headcount data. A founder would need to collect it through customer interviews, e.g. "how many hours per week does your office manager spend chasing COIs?"

### Gaps
- No BLS data was found for freight brokerage operations reps (cargo and freight agents), paralegals or docketing clerks, insurance claims processors, or customs brokers in this search pass.
- No independent hours-per-week data was found for COI tracking, construction submittals, grant reporting, vendor onboarding/KYB, tenant screening, or security questionnaires.
- Reddit or practitioner threads were not reached (searches returned vendor and press content). Practitioner-level evidence of pain is a gap.

---

## Q2. Who already serves each workflow, how crowded is it with funded AI startups, and does it SURVIVE or get DROPPED?

### Takeaway
Most of the obvious, large US workflows are DROPPED. AI startups have raised $10M–$350M+ rounds in each, some at unicorn valuations:
- prior auth
- eligibility calls
- denials
- AP and accounting
- sales tax
- PI legal intake
- property maintenance at multifamily scale
- RFPs and security questionnaires
- permitting
- carrier vetting

The workflows that SURVIVE are smaller, less glamorous niches where funded players aim at enterprise or mid-market and leave SMBs underserved:
- SMB accounts receivable
- COI tracking for small contractors
- court docketing for small firms
- IEP paperwork
- grant post-award reporting
- possibly construction submittals and customs entry prep outside the US

### Scorecard

| # | Workflow | Funded AI-era players found (2024–2026) | Crowding | Verdict |
|---|---|---|---|---|
| 1 | Prior authorization | Cohere Health ($90M Series C, $200M total); Humata ($25M); Silna ($22M A); Anterior ($40M, 2026); Ethermed ($8.5M A, 2026); Infinitus | Very high | **DROPPED** |
| 2 | Insurance or benefits verification calls | Infinitus ($102.9M total, a16z-led C); Silna | High | **DROPPED** |
| 3 | Medical billing denials and appeals | Amperos ($16M A, Bessemer, 2026); RapidClaims ($11M, Accel, 2025); Waystar (bought Olive assets) | High | **DROPPED** |
| 4 | AP invoice entry, bookkeeping, month-end close | Rillet ($100M C at $1B, total over $200M); Basis ($100M B at $1.15B); Ramp, Digits, Puzzle, Light | Very high | **DROPPED** |
| 5 | Sales tax filing | Kintsugi ($18M, 2025); Numeral ($35M B at $350M valuation) | High | **DROPPED** |
| 6 | Freight track-and-trace and broker back office | Freight Hero ($5M seed); Chain; Descartes | Medium | **DROPPED** for US mid-size brokers. Weak niche remains (see devil's advocate). |
| 7 | Carrier onboarding and fraud vetting | Highway (FTV growth equity, 70 of top-100 brokers); Descartes MyCarrierPortal | High (incumbent lock-in) | **DROPPED** |
| 8 | Accounts receivable and collections for SMBs | Fazeshift ($4M seed, YC/Gradient, enterprise); Paraglide ($5M seed, Bessemer, mid-market/enterprise) | Low for SMB; medium for enterprise | **SURVIVES** (SMB niche) |
| 9 | COI tracking (contractors, property) | Jones ($15M B); Certificial ($5.8M A + $15M); myCOI/illumend; Billy; CertCove | Medium (mostly pre-LLM players) | **SURVIVES** (small-contractor or non-US niche) |
| 10 | Construction permitting | PermitFlow ($54M B, Accel; about $90M total; Lennar, Amazon) | High in US | **DROPPED** (US). A local-market version may survive. |
| 11 | Construction submittals, RFIs, change orders | Zero RFI ($13.8–14M seed, General Catalyst, roll-up model, 2026) | Low–medium | **SURVIVES** (with caveats) |
| 12 | Customs brokerage paperwork | Amari AI ($4.5M seed, 2026); KlearNow.AI (Series B, figure unverified); Cervo (acquired by Altana, 2026); Flexport audit agent | Medium and rising | **SURVIVES (weak)**: niche or geography |
| 13 | Nurse and locum credentialing | CertifyOS ($14.5M A, 2022); Incredible Health ($80M B); Trusted Health | Medium–high (Medallion and Verifiable not verified in search) | **DROPPED** (likely) |
| 14 | Property maintenance coordination | EliseAI ($250M in 2025 at $2.2B; $350M in 2026 at $4B, a16z/Bessemer); Vendoroo | Very high at scale | **DROPPED** (small-landlord niche only) |
| 15 | Legal intake for personal injury and contingency practices | EvenUp ($150M E at $2B, $385M total); Eve ($103M at $1B+); Supio ($60M) | Very high | **DROPPED** |
| 16 | Court filing and docketing | Incumbents: CourtDrive, LawToolBox, Mitratech ARIES. No funded AI-native docketing startup found. | Low startup crowding, but incumbent add-ons exist | **SURVIVES** (small-firm niche) |
| 17 | Grant writing and reporting | Instrumentl ($55M growth, Summit); Grantable | Medium for discovery and writing; low for post-award reporting | **DROPPED** (writing); **SURVIVES (weak)** for reporting and compliance |
| 18 | RFP responses and security questionnaires | Conveyor, Arphie, Inventive AI ($6.5M, YC S23), Steerlab, Loopio, Responsive, RocketDocs | Very high | **DROPPED** |
| 19 | School IEP paperwork | BridgeEd AI, Journify Learning, Managed (no significant rounds found) | Low | **SURVIVES** |

### Cited Findings (by workflow)

**1. Prior authorization: DROPPED**
- Cohere Health raised a $90M Series C (Temasek), bringing its total to $200M. — [Goodwin](https://www.goodwinlaw.com/en/news-and-events/news/2025/05/announcements-technology-cm-cohere-health-completes-90-million)
- Silna Health raised a $22M Series A in March 2025 ($27M total). It covers PA, benefit checks and insurance verification. — [Coverager](https://coverager.com/silna-health-raises-22-million/)
- Humata Health raised $25M (June 2024). — [Coverager](https://coverager.com/prior-authorization-platform-humata-health-raises-25-million/)
- Anterior raised $40M for health-plan AI (February 2026). — [Axios Pro](https://www.axios.com/pro/health-tech-deals/2026/02/12/exclusive-anterior-raises-40m-for-health-plan-ai)
- Ethermed raised an $8.5M Series A to automate prior authorisation with AI (2026). — [Techleap](https://finder.techleap.nl/news/feed/ethermed-raises-8-5m-series-a-to-automate-prior-authorisation-with-ai)
- Devil's advocate:
  - Payers and EHRs are building PA into their own systems (inference).
  - Olive AI died partly on prior auth delivery and EHR integration complexity. — [IdeaProof (low authority)](https://ideaproof.io/failure/olive-health-ai); [Becker's](https://beckershospitalreview.com/digital-health/how-olive-ai-ran-out-of-time-and-money.html)

**2. Eligibility and benefits verification: DROPPED**
- Infinitus raised a $51.5M Series C led by a16z, $102.9M total. It automates payer calls about benefits, PA and claims. — [MobiHealthNews](https://www.mobihealthnews.com/news/infinitus-systems-raises-515m-automating-healthcare-calls); [Fierce Healthcare (Series B, GV)](https://www.fiercehealthcare.com/tech/infinitus-systems-pulls-30m-to-automate-provider-calls-insurers)

**3. Denials and appeals: DROPPED**
- Amperos Health: $4.2M seed (2025), then a $16M Series A (Bessemer, April 2026). It claims 3,000+ clinical locations (company figure). Its agents handle payer follow-ups, corrected claims and appeals. — [Fierce Healthcare](https://www.fiercehealthcare.com/ai-and-machine-learning/amperos-health-secures-16m-series-funding-announces-industrys-new-first-ai); [HIT Consultant](https://hitconsultant.net/2026/04/22/amperos-health-16m-series-a-agentic-ai-denial-management-rcm/)
- RapidClaims raised $11M ($8M Series A led by Accel, plus a $3M seed) in April 2025. — [Entrepreneur India](https://india.entrepreneur.com/?p=3890)

**4. AP, bookkeeping and close: DROPPED**
- Rillet raised a $100M Series C at a $1B valuation (ICONIQ), its third raise in 14 months, with over $200M total. Its earlier $25M Series A was led by Sequoia (June 2025). — [The Next Web](https://thenextweb.com/news/rillet-100m-series-c-1bn-accounting-ai); [FinTech Futures](https://www.fintechfutures.com/venture-capital-funding/accounting-start-up-rillet-bags-25m-in-sequoia-led-series-a); [CPA Trendlines](https://cpatrendlines.com/2026/08/24/rillets-raise-100-million-bets-on-fewer-accountants/)
- Basis raised $100M at a $1.15B valuation (Accel, February 2026). Its agents serve accounting firms across client accounting, tax and audit. — [Pulse 2.0](https://pulse2.com/basis-100-million-raised-at-1-15-billion-valuation-for-ai-agent-platform-serving-accountants)
- Ramp, Digits, Puzzle, Light and SoftLedger are pushing into the finance stack. Oracle, SAP, Microsoft, Workday and NetSuite are defending. — [The Next Web](https://thenextweb.com/news/rillet-100m-series-c-1bn-accounting-ai)
- Devil's advocate: Bench Accounting, an AI- and offshore-assisted bookkeeping service, shut down abruptly on December 27, 2024 (see Q4).

**5. Sales tax: DROPPED**
- Kintsugi raised $18M led by Vertex (April 2025). It targets SMB sales tax calculation and filing. — [TechCrunch](https://techcrunch.com/2025/04/30/ai-sales-tax-startup-kintsugi-has-doubled-its-valuation-in-6-months/)
- Numeral raised a $35M Series B at a $350M valuation (Mayfield, with Benchmark and YC), six months after an $18M Series A. — [TechCrunch](https://techcrunch.com/2025/09/18/numeral-raises-35m-to-automate-sales-tax-with-ai/)

**6–7. Freight brokerage back office and carrier onboarding: DROPPED**
- Freight Hero raised a $5M seed (Field Ventures, Flybridge), over $6M total. It runs per-load, AI-plus-human back offices for brokers. The exact announcement date was not confirmed; coverage references a July 2026 target. — [FreightWaves](https://freightwaves.com/news/freight-hero-broker-back-office)
- Chain (AI track-and-trace autopilot) exists; no funding was found. — [Fulfill.com](https://www.fulfill.com/partners/chain)
- Highway: growth equity from FTV Capital and Lead Edge (August 2025), amount undisclosed, 1,050+ brokers. — [FreightWaves](https://www.freightwaves.com/news/carrier-identity-platform)
- Descartes MyCarrierPortal provides automated carrier onboarding, vetting and risk monitoring (incumbent). — [FleetOwner](https://www.fleetowner.com/technology/autonomous-vehicles/news/55395673/descartes-transportation-management-platform-helps-fgl-automate-freight-brokerage-operations)
- Devil's advocate:
  - Freight is cyclical. Convoy ($260M raised at a $3.8B valuation about 18 months earlier) died in a freight recession. — [CNBC](https://www.cnbc.com/2023/10/19/bezos-backed-freight-firm-convoy-shuts-down-read-ceo-memo-here.html); [GeekWire](https://www.geekwire.com/2023/convoy-collapse-read-ceos-memo-detailing-sudden-shutdown/)
  - Brokers are US-centric and relationship-driven, which makes them hard to reach from Israel (inference).

**8. AR and collections for SMBs: SURVIVES (niche)**
- Fazeshift raised a $4M seed (Gradient, YC). It does invoice creation and payment reconciliation and works with "several large enterprise customers." — [Business Wire](https://www.businesswire.com/news/home/20250107180091/en/Fazeshift-Secures-$4MM-Seed-Round-Led-by-Gradient-to-Automate-Accounts-Receivable-with-AI)
- Paraglide raised a $5M seed (Bessemer, DN Capital, January 2026). It targets mid-market and enterprise customers (Choco, Ardoq, Spiideo). — [Tech.eu](https://tech.eu/2026/01/27/paraglide-raises-5m-seed-to-reinvent-accounts-receivable-with-agentic-ai/)
- a16z's 2025 voice-agent update lists debt collection among the areas where buyers show willingness to pay. — [a16z](https://a16z.com/ai-voice-agents-2025-update/)
- No startup focused on SMB collections agents was found in search (absence of evidence, not proof).
- Devil's advocate (inference):
  - Accounting tools already send invoice reminders.
  - SMBs churn and pay little.
  - Debt-collection rules (e.g. FDCPA in the US) carry compliance risk for voice or SMS agents.
  - A vertical wedge would be needed, e.g. home-services contractors, clinics, or Israeli SMBs chasing checks.

**9. COI tracking: SURVIVES (niche)**
- Jones raised a $15M Series B (NewSpring). It serves real estate and construction with collection, verification and ERP integration. — [CB Insights](https://www.cbinsights.com/investor/jones)
- Certificial raised a $5.8M Series A (2021) and a $15M round led by Nyca (2023). — [Business Wire](https://businesswire.com/news/home/20210608005689/en/Insurtech-Startup-Certificial-Secures-5.8-Million-in-Series-A-Funding); [FinTech Global](https://fintech.global/2023/07/13/certificial-reels-in-15m-in-latest-funding-round-led-by-nyca-partners/)
- myCOI/illumend positions itself as "AI-first." CertCove offers AI extraction and verification. Billy does construction compliance. — [CB Insights (myCOI)](https://www.cbinsights.com/company/mycoi); [Software Advice (CertCove)](https://www.softwareadvice.com.au/software/561527/CertCove)
- Devil's advocate (inference):
  - Large GCs and property managers are already served.
  - Small contractors may not feel the pain enough to pay.
  - The product could be a feature inside Procore or property-management software.
  - A US-centric insurance (ACORD) format makes it harder to reach from abroad.

**10. Permitting: DROPPED (US)**
- PermitFlow raised a $54M Series B (Accel, with Kleiner, Felicis, YC; December 2025), about $90M total per one source. It is expanding to inspections and license management. — [Business Wire](https://www.businesswire.com/news/home/20251202551013/en); [The Bridge](https://thebridge.jp/2025/12/permitflow-54m-series-b-accel-construction-permitting-ai-nyc)

**11. Construction submittals, RFIs and change orders: SURVIVES (caveats)**
- Zero RFI raised a $13.8–14M seed led by General Catalyst (March 2026). Its model is to acquire construction services firms and layer AI across them, focused on owners and developers. — [Axios Pro](https://www.axios.com/pro/supply-chain-deals/2026/03/16/zero-rfi-ai-construction-seed-general-catalyst); [CityBiz](https://www.citybiz.co/?p=818957)
- No 2025 funded startup focused on submittal review for general contractors was found in this search.
- Devil's advocate (inference):
  - Procore and Autodesk own the system of record and can ship AI features.
  - Selling to GCs is slow and relationship-heavy.
  - Submittal review carries liability.

**12. Customs brokerage: SURVIVES (weak)**
- Amari AI raised a $4.5M seed (February 2026). Its agents fill, validate and submit customs paperwork. — [TechCrunch](https://techcrunch.com/2026/02/19/this-former-big-tech-engineers-are-using-ai-to-navigate-trumps-trade-chaos/)
- Altana acquired Cervo AI (July 2026) and says it can now process 5x as many entries. — [DC Velocity](https://www.dcvelocity.com/supply-chain/other-services/global-logistics/altana-says-acquisition-will-help-customs-brokers-keep-up-with-tariff-changes)
- KlearNow.AI's Series B is listed at $50M or $66M on the same page (conflicting, unverified). — [YesPress](https://yespress.io/klearnow-ai)
- Devil's advocate: licensing, liability for misclassification, and country-specific customs systems. On the other hand, the last point could favor a local Israeli product (inference).

**13. Nurse and locum credentialing: DROPPED (likely)**
- CertifyOS raised a $14.5M Series A (General Catalyst, 2022) for credentialing, licensing and enrollment APIs. — [MedCity News](https://medcitynews.com/2022/09/certifyos-raises-14-5m-in-series-a-funds-for-credentialing-automation-platform/)
- Incredible Health raised an $80M Series B and automates credential screening. — [MedCity News](https://medcitynews.com/2022/08/incredible-health-rakes-in-80m-to-combat-the-nursing-shortage/)
- Medallion and Verifiable could not be confirmed in search (gap).

**14. Property maintenance coordination: DROPPED**
- EliseAI raised $250M at $2.2B (August 2025) and $350M at $4B led by a16z and Bessemer (September 2026). Its maintenance product triages and routes repair tickets. — [SiliconANGLE 2025](https://siliconangle.com/2025/08/20/property-management-startup-eliseai-nabs-250m-2-2b-valuation/); [SiliconANGLE 2026](https://siliconangle.com/2026/09/29/eliseai-raises-350m-to-enhance-its-ai-work-automation-suite/)
- Vendoroo handles AI maintenance coordination from work-order intake through vendor payment; funding was unconfirmed. — [Vendoroo](https://vendoroo.ai/property-meld-alternative)

**15. Personal injury legal intake: DROPPED**
- EvenUp raised a $150M Series E at $2B+ (Bessemer, October 2025), $385M total. — [Fortune](https://fortune.com/2025/10/07/exclusive-evenup-raises-150-million-series-e-at-2-billion-valuation-as-ai-reshapes-personal-injury-law); [Business Wire](https://www.businesswire.com/news/home/20251007138957/en/EvenUp-Raises-150M-Series-E-at-2B-Valuation-to-Redefine-Personal-Injury-Law-and-Level-the-Playing-Field-for-Injury-Victims)
- Eve raised $103M at $1B+ (September 2025). Supio raised $60M (April 2025) and launched an intake suite in May 2026. — [Sacra](https://sacra.com/c/evenup/)

**16. Court docketing: SURVIVES (niche)**
- Existing tools are incumbents or add-ons: CourtDrive's AI docketing assistant, LawToolBox (Outlook/Copilot deadline extraction), and Mitratech ARIES (March 2026). — [CourtDrive](https://www.courtdrive.com/); [LawNext](https://www.lawnext.com/category/archives/lawtoolbox); [Mitratech](https://mitratech.com/?p=102551)
- No AI-native docketing startup with a 2025 round was found.
- Devil's advocate (inference):
  - A missed deadline means malpractice, so firms are conservative.
  - Court rules are jurisdiction-specific and labor-intensive to encode.
  - Practice-management suites (Clio, MyCase, which integrates CourtDrive) can bundle it. — [MyCase support](https://supportcenter.mycase.com/en/articles/9370176-courtdrive)

**17. Grants: DROPPED for writing, SURVIVES (weak) for reporting**
- Instrumentl: $55M growth round from Summit Partners (April 2025), covering discovery, writing, management and reporting. — [Summit Partners](https://www.summitpartners.com/news/instrumentl-raises-55m-from-summit-partners-to-accelerate-their-ai-grant-fundraising-platform)
- Grantable pairs AI-native discovery with drafting; paid plans start at $50/month (competitor marketing). — [Grantable](https://grantable.co/compare/instrumentl)
- Devil's advocate (inference):
  - Nonprofits have low willingness to pay.
  - Generic LLM chat already covers much of the drafting.

**18. RFPs and security questionnaires: DROPPED**
- Players found: Arphie (2023, San Francisco), Steerlab (Paris), Conveyor, Loopio, RocketDocs. — [CB Insights](https://www.cbinsights.com/company/steerlab); [CB Insights](https://www.cbinsights.com/company/responsive/alternatives-competitors)
- Inventive AI (YC S23) raised $6.5M (Wing VC, June 2024). — [Extruct](https://www.extruct.ai/hub/inventive-ai-funding/)

**19. IEP paperwork: SURVIVES**
- Teacher demand is visible: 57% used AI for individualized plans in 2024–25, and 45 states report shortages. — [Michigan Public/NPR](https://www.michiganpublic.org/2026-05-20/overworked-and-understaffed-special-ed-teachers-turn-to-ai-for-help)
- Only small players were found: BridgeEd AI (MIT Solve), Journify Learning (Stanford GSB alumni), Managed (Denver; IEP and 504 scheduling and deadlines). — [MIT Solve](https://solve.mit.edu/solutions/96927); [Stanford GSB](https://www.gsb.stanford.edu/experience/news-history/mara-steiu-mba-25-empowering-special-education-ecosystem)
- Devil's advocate:
  - Student data privacy is a central concern. — [EdWeek](https://www.edweek.org/technology/the-pros-and-cons-of-ai-in-special-education/2024/05)
  - Teachers must review output carefully, and it is unclear whether AI-drafted IEPs meet IDEA requirements. — [EdWeek](https://www.edweek.org/technology/the-pros-and-cons-of-ai-in-special-education/2024/05)
  - District procurement is slow (inference).
  - Teachers may just use ChatGPT for free (inference).

### Inferences
**Why now.** Several capabilities matured in 2024–2026:
- LLM document extraction (COIs, eNotices, invoices, customs docs)
- voice agents that wait on hold and navigate IVRs (Infinitus, Freight Hero)
- agentic multi-step workflows across portals

Funding of agent-native companies like Amperos, Freight Hero, Amari and Rillet confirms investors believe these became production-viable.

**Pattern in the crowded spaces.** Wherever labor spend is large and centralized, $50M+ rounds exist within 12–24 months: health plans, hospitals, multifamily REITs, PI law firms, mid-market finance. That leaves a solo founder mostly in SMB, regional or non-US niches where VC-funded players do not bother.

**Israel angle (inference, unverified).** Country-specific bureaucracy may survive better than US horizontals because US-funded startups will not localize. Examples: Israeli customs (Sha'ar Olami), local permitting (Rishui Zamin), Israeli health funds (Kupot Holim) authorizations, and Israeli SMB collections and check-chasing. This needs dedicated validation.

**Best fits for a web and mobile builder.** Candidate SURVIVES workflows where a thin vertical app plus LLM extraction could deliver value without deep EHR or TMS integrations:
- SMB AR
- COI tracking for small contractors
- small-firm docketing
- IEP tools
- grant reporting

### Gaps
- Could not verify funding for Medallion, Verifiable, Vendoroo, Conveyor, Arphie, Chain or Grantable.
- Workflows not researched in this pass: vendor onboarding/KYB, tenant screening, procurement RFP (buyer side), and locum tenens specifically.
- No market sizing for SMB AR, COI, docketing or IEP niches.

---

## Q3. What do YC Requests for Startups (2025–2026) and investor theses say?

### Takeaway
Investors have converged on "services as software": capture the labor budget, not the IT budget. YC's 2026 RFS explicitly asks for AI-native agencies (Spring 2026) and AI-native service companies in law, accounting and recruiting (Summer 2026). The Fall 2026 RFS reportedly shifts toward the physical world, defense and aging.

### Cited Findings
- **Foundation Capital (April 2024, follow-up October 2024).** Its "Service-as-Software" thesis says software becomes the worker. It estimated a $4.6 trillion opportunity over five years. — [Foundation Capital](https://foundationcapital.com/system-of-agents)
- **Sequoia (Julien Bek).** "Services: The New Software" argues the money is in capturing the labor budget, not the software budget. This is a secondhand summary; the original was not retrieved. — [Linas's Newsletter](https://linas.substack.com/p/sequoiathesis)
- **Skeptics.**
  - Emergence's Jake Saper expects hybrid companies (part AI software, part people) with little precedent. — [Diginomica](https://diginomica.com/future-saas-world-ai-agents-part-2-product)
  - One BPO-focused critic says the Foundation-highlighted startups' results "haven't been really that outrageous." — [Harry Sanders](https://harrysanders.com/service-with-software/service-as-software/)
- **a16z voice agents 2025 update.** Buyers show willingness to pay in financial services (e.g. debt collection), insurance (front and back office), government and support. About 69% of YC voice-agent startups are B2B and about 18% healthcare-focused, with back-office healthcare (pharmacy, insurance) a key focus. — [a16z](https://a16z.com/ai-voice-agents-2025-update/)
- **Bessemer, via secondary coverage.** Vertical AI targets labor spend rather than IT budgets. — [Clobe summary](https://clobe.ai/blog/a16z-2026-ai-agent-labor-market)
- **YC Spring 2026, "AI-native agencies."** Agencies use AI themselves and sell finished work rather than tools. The YC page lists Aaron Epstein as author; a third-party page attributes it differently. — [YC RFS](https://ycombinator.com/rfs); [Modelence](https://modelence.com/yc-rfs-spring-2026/ai-native-agencies)
- **YC Summer 2026, "AI-native service companies."** Targets law, accounting and recruiting, where firms still scale by hiring. — [Modelence](https://modelence.com/yc-rfs-summer-2026/ai-native-service-companies); [Founded CEO Substack](https://foundedceo.substack.com/p/a16z-and-y-combinator-just-shared)
- **YC Fall 2026.** Reportedly 13 requests themed "AI is moving into the physical world," including "The Future of American Defense," "Compute at Sea," "AI for the Aging Population" and "Proving You're Human." This is secondary coverage. — [IBTimes SG](https://www.ibtimes.sg/A000Ncu); [BigIdeasDB](https://bigideasdb.com/yc-request-for-startups-2026)
- **HubSpot Ventures.** Its 2025+ investment focus is AI agents for small businesses. — [HubSpot](https://www.hubspot.com/company-news/hubspot-ventures-2025-and-beyond)

### Inferences
- **A founder-relevant implication of the YC agencies RFS:** a solo founder can start as an AI-assisted service that sells outcomes, e.g. "we chase your COIs" or "we collect your overdue invoices," then productize. This avoids the integration-heavy SaaS sale.
- **The risk:** service margins, and dependence on manual labor if the AI falls short. Bench is the cautionary example (Q4).

### Gaps
- The official ycombinator.com/rfs page could not be fetched (DNS failure), so exact titles, authors and batch assignments are from secondary sources and should be verified.
- The original Sequoia essay and an a16z-authored "services as software" essay were not retrieved.

---

## Q4. Postmortems: what kills back-office, vertical SaaS and tech-enabled-service startups?

### Takeaway
Six failure drivers recur:
- No real market need
- Running out of cash, often tied to macro shocks
- Integration complexity per customer, especially in healthcare
- Losing focus by chasing too many workflows
- Service quality collapsing when "AI plus offshore" is pushed to low prices
- Enterprise pilots that never convert

Trust and data access are a recurring blocker for AI agents specifically.

### Cited Findings

**General statistics**
- In the CB Insights post-mortem analysis, "no market need" is the top reason, cited in 42% of failures. Running out of cash and the wrong team follow. Sources give the sample as 101 or 111 post-mortems; the original was not retrieved. — [Startup News AU](https://startupnews.com.au/news/top-20-reasons-startups-fail-cb-insights/); [SmartCompany](https://www.smartcompany.com.au/startupsmart/analysis/startups-fail-founders-capital/)

**Olive AI (healthcare admin automation, including prior auth): shut down October 2023**
- Raised about $850–900M at a peak valuation of $4B, with about 1,400 employees. Its assets were sold to Waystar and Humata Health. — [Fierce Healthcare](https://www.fiercehealthcare.com/health-tech/once-high-flying-unicorn-olive-ai-sells-two-key-businesses-winds-down-operations); [Becker's](https://beckershospitalreview.com/digital-health/how-olive-ai-ran-out-of-time-and-money.html)
- The CEO reportedly said Olive "pivoted 27 times." It struggled to deliver across prior auth, population health and surgery analytics. — [Sergei AI Substack](https://sergeiai.substack.com/p/the-death-of-olive-ai)
- It overpromised, e.g. a 5x cut in administrative spend, and customers reported poor support and the team lacking knowledge of its own product. — [Medium analysis](https://medium.com/@himanshukhichar/fall-of-olive-ai-just-another-day-in-digital-healthcare-c65ace9dec59)
- Each hospital had unique workflows and EHRs, which made standardization extremely hard. — [IdeaProof (low authority)](https://ideaproof.io/failure/olive-health-ai)
- It tried and failed to raise money or find a buyer before closing. — [Becker's](https://www.beckershospitalreview.com/healthcare-information-technology/digital-health/olive-ai-tried-to-raise-money-before-shutting-down/)

**Convoy (digital freight brokerage): shut down October 2023**
- The CEO memo cited a "massive freight recession and a contraction in the capital markets." A four-month review of strategic options found nothing viable. It had raised $260M at $3.8B about 18 months earlier. — [GeekWire](https://www.geekwire.com/2023/convoy-collapse-read-ceos-memo-detailing-sudden-shutdown/); [CNBC](https://www.cnbc.com/2023/10/19/bezos-backed-freight-firm-convoy-shuts-down-read-ceo-memo-here.html)
- Abundant truck capacity let shippers go directly to asset-based carriers, which squeezed brokers. — [TT News](https://www.ttnews.com/articles/convoy-stops-orders-cuts-jobs)

**Bench Accounting (tech-enabled bookkeeping): closed December 27, 2024**
- Closed abruptly, then was acquired by Employer.com three days later. No official postmortem was found. — [BetaKit](https://betakit.com/?p=381640); [ICAEW](https://www.icaew.com/insights/viewpoints-on-the-news/2025/apr-2025/cloud-accounting-software-lessons-from-failure-of-bench)
- Secondary accounts cite several causes:
  - ultra-low pricing relying on AI and offshore teams, which hurt quality
  - inconsistent work
  - proprietary software lock-in and weak data migration
  - thin margins
  - venture debt and VC pressure
- Several of these sources are competitor marketing. — [MYCPE](https://my-cpe.com/blogs/bench-accounting-closure-and-acquisition); [BetaKit](https://betakit.com/?p=381640)

**Small and AI-era shutdowns (2025)**
- Astra (AI SaaS) cited a cofounder split and long enterprise sales cycles. It also struggled to win trust for data access to Salesforce, Slack and Google Drive. — [CXO Digital Pulse](https://www.cxodigitalpulse.com/ai-saas-startup-astra-shuts-down-months-after-funding-amid-cofounder-dispute-and-market-challenges/); [Entrackr](https://entrackr.com/snippets/ai-saas-startup-astra-shuts-down-amid-co-founder-differences-9609594)
- Noogata raised about $28M and signed PepsiCo and Colgate, but deals stayed small or stuck in pilots (third-party analysis). — [BetOnAI](https://betonai.net/ai-tools-that-were-hyped-in-2025-but-dead-by-2026-the-saas-casualties/)
- Wordsworth AI: enterprise customization ate margins at six-figure revenue (third-party). — [IdeaProof](https://ideaproof.io/failure/wordsworth-ai)
- Kevala: a sub-scale point solution absorbed by a broader senior-care platform (third-party). — [IdeaProof](https://ideaproof.io/failure/kevala)
- College Conductor, a solo-founder vertical SaaS for independent college consultants, ran manual back-office steps and shut down after three years. Its postmortem lists the reasons. — [Matt Layman](https://mattlayman.com/blog/failed-saas-postmortem)

### Inferences
Mapping these failures onto the founder's hypotheses (distribution, trust, integrations, pain not real):

- **Pain not real or not paid for:** the top CB Insights cause. In SMB back-office work, "annoying" is not the same as "budgeted." Validate with willingness to pay, not interviews alone.
- **Integrations:** Olive shows that per-customer integration in fragmented systems (EHRs) kills unit economics. Prefer workflows where input arrives as email, PDF or portal and output is a document, calendar entry or phone call, not deep system-of-record writes.
- **Trust:**
  - AI agents touching money, deadlines or compliance (collections, docketing, IEPs, customs) carry liability. Astra shows data-access trust slows sales.
  - Human-in-the-loop review is a must at launch. Freight Hero's "Heroes" model fits this.
- **Distribution:** Convoy and Noogata show that big logos and pilots do not equal revenue. For a solo founder, channel partners matter: insurance agents for COI, accounting firms for AR, state bar or practice-management marketplaces for docketing.
- **Service-as-software trap:** Bench shows that pricing an AI-plus-human service too low, before automation actually works, destroys quality and margin.
- **Focus:** Olive's 27 pivots argue for one workflow and one vertical.

### Gaps
- The original CB Insights report and the latest edition's sample size were not retrieved.
- No Failory or Indie Hackers postmortems specific to COI, AR or docketing were found.
- No direct founder postmortem from Bench was found.
- No small "AI agent for back office" startups that failed in 2025–2026 with a detailed write-up were found. Most AI-era failure write-ups come from aggregators of uneven quality.
