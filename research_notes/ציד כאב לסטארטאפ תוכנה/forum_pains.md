# Forum Pains: Recurring Operational Problems Voiced by SMBs and Professionals (2024–2026)

> **How this was gathered, and its limits (read first).** In this research environment, Reddit (reddit.com, old.reddit.com, the Reddit JSON API, pullpush) was **blocked**, both from the search index and for direct fetches. Hacker News pages and the HN Algolia/Firebase APIs also could not be fetched directly, and neither could most forum pages (WebFetch DNS failures). Every quote below therefore comes from **search-engine excerpts** of pages on professional forums: TheTruckersReport, BiggerPockets, ContractorTalk, ElectricianTalk, HVAC-Talk, Dentaltown, allnurses, AccountingWEB, Shopify Community, Indie Hackers and news.ycombinator.com. Text in quotation marks is the excerpt as the search tool returned it. It is very likely verbatim, but I could not check it against the full page. Many "Reddit" claims online reach us only through vendor blogs. Where that happens it is labelled **secondhand/vendor**. **There are no first-hand Reddit quotes in these notes.** The report writer should not present any finding as "from Reddit" unless a vendor blog attributes it there, and then must label it secondhand.

## Key Question 1: What operational problems do people in these professions complain about again and again, and what workarounds do they use (spreadsheets, WhatsApp, paper, hiring a person)?

### Takeaway
The pains that recur most across trades, real estate, trucking, dental/PT, accounting and e-commerce share one shape: **chasing a third party for a document or proof, then tracking whether it has expired**. Examples are subcontractor COIs, lien waivers, client receipts and bank statements, detention timestamps, move-in/move-out photos, prior authorizations and licenses. The usual workarounds are a spreadsheet, a shared Drive folder, calendar reminders, WhatsApp groups and "lots of nagging". A second cluster is **re-keying the same data into many portals**: insurance carrier portals, dental insurer portals and delivery-platform dashboards.

### Cited Findings

**P1. Subcontractor certificate-of-insurance (COI) tracking (GCs, property managers)**
- Secondhand/vendor account of a r/ConstructionManagers thread: a project coordinator who inherited a subcontractor compliance spreadsheet spends the day chasing subs for renewed certificates. Experienced managers replied "yes, this is how most companies do it — and yes, it is a nightmare." They added: "When you have ten subcontractors, it works. At thirty or forty, it becomes the bottleneck." — [imagetotable.ai (vendor, quoting thread)](https://imagetotable.ai/blog/construction-coi-tracking-email-spreadsheet-problem)
- ContractorTalk: third-party compliance services such as ISN and PICS "manually check the certificates using humans", and their "software doesn't really do what you're talking about. Their employees do the checks and you pay for the centralized database." DIY workarounds named in the thread: Google Drive/Dropbox plus a checklist, and QuickBooks reminders for expiring policies. — [ContractorTalk thread](https://www.contractortalk.com/threads/software-for-managing-subcontractor-certs-of-insurance-associated-sub-data.264865/)
- Free Excel COI trackers are widely distributed, which shows the spreadsheet is the default workaround. — [Billy free template](https://billyforinsurance.com/certificate-of-insurance-tracking-template-excel/)

**P2. Bookkeepers/accountants chasing clients for receipts, statements and documents every month**
- AccountingWEB: practitioners say they "rarely get the information throughout the month, and it is usually a week or so after month end"; "there's no magic software that will make clients provide records, just education and lots of nagging"; one bookkeeper estimates "3-4 hours per client, per annum in 'client queries'" on top of chasing records. — [AccountingWEB: hours chasing documents](https://www.accountingweb.co.uk/community/industry-insights/how-many-hours-did-your-firm-spend-last-month-chasing-documents); [AccountingWEB: sole traders per bookkeeper](https://www.accountingweb.co.uk/any-answers/how-many-sole-traders-can-a-bookkeeper-manage)
- A Receipt Bank (now Dext) executive: "The major pain point for our partners is going back and forth on email chasing clients." — [AccountingWEB](https://www.accountingweb.co.uk/node/232293)
- An Indie Hackers founder building a document-collection tool reports that chasing client replies and missing receipts were the main complaints in customer interviews. — [Indie Hackers](https://www.indiehackers.com/post/i-thought-bookkeeping-software-problems-were-accounting-problems-i-was-wrong-25854191c9)
- The DocChase founder (Product Hunt) calls the worst part "the monthly ritual of asking every client 'can you send me your bank statement?'" — [hunted.space / DocChase](https://www.hunted.space/dashboard/docchase)
- An r/Bookkeeping post (Jul 2024, seen via a mirror) asks how others get receipts from clients and match them, calling it very time-consuming. — [r/Bookkeeping mirror](https://pol1.lr.ggtyler.dev/r/Bookkeeping)

**P3. Dental front desk verifying insurance eligibility and benefits**
- A Dentaltown column says checking eligibility before appointments "takes an average of two hours a day", and says eligibility "is almost always going to be last, but it is also one of the most important because it heavily impacts your collections." — [Dentaltown](https://www.dentaltown.com/channel/post/7458/is-dental-insurance-eligibility-taking-too-much-time)
- Vendor estimates run 10–15 minutes per patient by phone or portal, and 15–30 minutes with hold times. At 25 patients/day, one vendor puts it at about 4–5.5 hours/day, "nearly one full-time employee" (vendor, treat as directional). — [Solutionreach](https://www.solutionreach.com/blog/faster-verifications-fewer-denials-why-real-time-eligibility-is-a-2026-must-have); [Dentalbase](https://www.dentalbase.ai/blogs/practice-management/dental-insurance-verification-process-step-by-step-front-desk)
- Workarounds: a dedicated staff owner, protected batching blocks, outsourced verification BPOs. — [Dentaltown front office](https://www.dentaltown.com/channel/post/25995/front-office-systems-that-fix-chaos)

**P4. Truckers and small carriers losing detention pay for lack of proof**
- A TheTruckersReport thread is titled "Lost detention pay again because broker said 'no proof' — how do you guys document it". In other threads, a driver lost detention because the only proof was a handwritten note on the BOL, and "some shipper and receiver clerks won't initial in and out times". Workarounds: phone logs, ELD entries, GPS apps, emailing the broker before free time ends, small-claims court. — [TheTruckersReport: "no proof"](https://thetruckersreport.com/truckingindustryforum/threads/lost-detention-pay-again-because-broker-said-no-proof-%E2%80%94-how-do-you-guys-document-it.2540236); [How to get brokers to ACTUALLY PAY DETENTION?](https://www.thetruckersreport.com/truckingindustryforum/threads/how-to-get-brokers-to-actually-pay-detention.2145331/page-2); [What would you do if a broker doesn't pay detention](https://www.thetruckersreport.com/truckingindustryforum/threads/what-would-you-do-if-a-broker-doesnt-pay-detention.1275590/)
- A broker rate-con template: "Detention will be paid ONLY if the broker is notified ONE HOUR PRIOR to detention occurring and times are clearly marked on BOLs." — [Scribd sample](https://www.scribd.com/document/613150220/semail)
- A Senate Commerce document cites an FMCSA estimate that detention costs the industry more than $3B. — [commerce.senate.gov](https://www.commerce.senate.gov/index.php/services/files/BAE24B91-2539-4DFA-B966-9E5491826733)

**P5. California small landlords facing new regulatory paperwork: AB 2801 deposit photos and AB 1482 rent caps**
- BiggerPockets, 2025 threads: AB 2801 requires photos before move-in, at move-out before repairs, and after repairs. Per one poster, "most landlords get tripped up because they can't connect photos to line items" on the itemized statement. Missing the 21-day window "means forfeiting deductions entirely". Workarounds: "a simple naming convention (unit number + room + date) in a shared Drive folder per property"; "a calendar entry the moment a tenant moves out, and block day 18 as the hard 'write it up' deadline"; narrated video walkthroughs. — [BiggerPockets: how small landlords handle AB 1482/AB 2801 paperwork](https://www.biggerpockets.com/forums/899/topics/1288628-landlords-in-ca-how-are-small-landlords-handling-ab-1482-and-ab-2801-paperwork); [BiggerPockets: move-out checklist after AB 2801](https://www.biggerpockets.com/forums/52/topics/1290993-my-move-out-checklist-after-ab-2801-what-california-landlords-need-to-document-now)
- On AB 1482, landlords track each unit in a spreadsheet and check the cap "before you send the increase notice, not after". Local ordinances layer on top, the CPI cap changes every August, and "one incorrect increase can mean a rent rollback and penalties." — [BiggerPockets AB 1482/2801 thread](https://www.biggerpockets.com/forums/899/topics/1288628-landlords-in-ca-how-are-small-landlords-handling-ab-1482-and-ab-2801-paperwork)
- General deposit disputes: "Sending the tenant copies of move-in and move-out pictures greatly reduces protests against deposit charges." — [BiggerPockets deposit threads](https://www.biggerpockets.com/forums/52/topics/1045109-move-out-condition-and-disposition-of-security-deposit)
- Sources conflict on AB 2801 effective dates (Jan 2025 vs. tenancies from Jul 1, 2025, with pre/post-repair photos from Apr 1, 2025). — [same BiggerPockets threads](https://www.biggerpockets.com/forums/109/topics/1212272-new-california-law-requires-photo-documentation-for-security-deposit-deductions)

**P6. Independent insurance agents re-entering the same data into multiple carrier portals**
- "Independent agents spend upwards of two hours a day on manual data entry." 55% of agents quote commercial lines through carrier portals, but only 32% prefer to. Entering the same data across portals was "frustrating and time-consuming for all parties." — [Insurance Business](https://www.insurancebusinessmag.com/us/news/technology/why-more-tools-are-making-independent-agents-less-productive-592341.aspx); [IVANS case study](https://www.ivans.com/resources/reports-research/insurance-carrier-journey-digital-connectivity/); [Insurance Journal](https://www.insurancejournal.com/magazines/mag-features/2023/10/16/743907.htm)

**P7. Insurance agency commission reconciliation**
- Carriers don't standardize statements. One example: Progressive's CSV uses "Pol #" and "Comm Amt" while other carriers use different headers. The spreadsheet workaround is subtraction formulas plus green/yellow color-coding. "If no one is comparing against last month, a vanished policy looks like silence rather than a problem." — [Commissions Wizard guide (vendor)](https://commissionswizard.com/blog/insurance-commission-reconciliation-guide); [Commission Tracker guide (vendor)](https://commission-tracker.com/insurance-commission-reconciliation/)

**P8. Restaurants losing money on third-party delivery error charges and adjustments**
- At the Food On Demand conference (May 2024), a Freddy's executive called DSP chargebacks "really just theft". Freddy's partner Loop AI is "helping recoup more than $1 million a year." — [Food On Demand](https://foodondemand.com/05172024/its-really-just-theft-freddys-exec-says-of-chargebacks-at-fodc/)
- Dispute windows (vendor claim): DoorDash about 14 days, Uber Eats about 30 days with weekly caps. Uber's official policy allows payout adjustments "up to the full cost of the affected items, including tax." — [KoreFi (vendor)](https://www.korefi.ai/blog/uber-eats-fees-for-restaurants); [Uber Eats merchant page](https://merchants.ubereats.com/gb/en/resources/learning-center/order-errors)

**P9. E-commerce: multichannel inventory sync and overselling**
- Shopify Community: polling tools sync "every 10 to 15 minutes", which opens an oversell window at peak. "Shopify doesn't handle that part natively." — [Shopify Community: how often do you sync](https://community.shopify.com/t/how-often-do-you-sync-inventory-across-sales-channels/684825); [Best inventory sync tool](https://community.shopify.com/t/best-inventory-sync-tool-for-shopify/672498)

**P10. E-commerce: chargebacks and friendly fraud lost despite proof of delivery**
- A Shopify Community thread title: "Shopify Merchants Are Being Penalised for Chargeback Evidence We Literally Cannot Provide on Any Other Plan Other Than Plus". The claim is that non-Plus merchants can't customise checkout to capture terms acceptance. Other merchants lost disputes even with tracking, because tracking only answers the "not received" reason code. — [Shopify Community thread](https://community.shopify.com/t/shopify-merchants-are-being-penalised-for-chargeback-evidence-we-literally-cannot-provide-on-any-other-plan-other-than-plus/622590); [Charge back on item delivered with tracking](https://community.shopify.com/t/charge-back-on-an-item-successfully-delivered-with-tracking-evidence/347448)

**P11. Physical therapists documenting off the clock**
- The WebPT 2024 State of Rehab Therapy report is cited as finding that 85% of PTs take documentation home and 36% name it a leading cause of burnout (cited by a vendor, not verified against WebPT directly). — [Physitrack (vendor)](https://www.physitrack.com/insights/documentation-burden-pt-ot-burnout)

**P12. PT/outpatient clinics losing claims to missing or expired prior authorizations and visit limits**
- "Insurance companies do not usually send expiration reminders", so clinics track dates themselves. Vendors cite PT denial rates of about 11% and "missing OK causes 25% of PT claim denials" (vendor figures that conflict with each other). — [rcmworkshop](https://rcmworkshop.com/insights/blogs/physical-therapy-prior-authorization-handling-visit-limits-and-payer-restrictions/); [SPRY](https://www.sprypt.com/blog/effective-strategies-to-reduce-claim-denials-for-your-pt-clinic)

**P13. Veterinary clinics: client communication and reminder tools that don't sync with the PIMS**
- Review roundups: Weave "expensive, with frequent price increases and add-on fees"; PetDesk "PIMS sync is the recurring sore spot... manual entry that was supposed to disappear"; Vello "only exists inside IDEXX's world". — [Tailwerks roundup](https://tailwerks.com/best-veterinary-client-communication-software/); [Owner Exchange](https://ownerexchange.com/veterinary-client-communication-software/)

**P14. Small law firms running conflict checks in spreadsheets or email**
- Clio's own guide calls spreadsheet checks "the most common method". A vendor says Clio's checker searches only Clio records, so legacy spreadsheet data is missed. — [Clio blog](https://www.clio.com/au/blog/conflict-check-how-to/); [ustechautomations (vendor)](https://ustechautomations.com/resources/blog/legal-build-a-conflict-check-workflow-for-small-law-2026)

**P15. Lien waivers per pay application (GCs and subs)**
- Spreadsheet trackers use "one row per subcontractor per pay-app cycle" with a payment-hold flag. A vendor claims spreadsheets work "up to about five active jobs". — [invoicedataextraction](https://invoicedataextraction.com/blog/subcontractor-lien-waiver-tracker-gc-ap); [LienDone](https://www.liendone.com/blog/lien-waiver-tracking-spreadsheet)

**P16. Subcontractors not getting paid for extra work (unsigned change orders and T&M tickets)**
- ContractorTalk/ElectricianTalk: one sub did extra work without a signed change order, so the owner refused to pay ("He was correct, we did do the extra work without getting an additional signed change order"). The sub filed a lien and was offered partial payment only if the lien was removed first. Thread advice: get daily T&M tickets signed by someone with authority. — [ContractorTalk: break out change orders on extras](https://www.contractortalk.com/threads/do-you-break-out-a-change-order-on-extras-on-small-jobs.344569/); [ElectricianTalk: change orders](https://www.electriciantalk.com/threads/change-orders.13692/)
- California home-improvement law: a change order "shall become part of the contract only if it is in writing and signed by the parties prior to the commencement of any work". — (excerpt surfaced in the same search; statute text not fetched)

**P17. Field-service software too expensive for small trades shops (HVAC, electrical, plumbing)**
- Vendor-reported r/HVAC sentiment: ServiceTitan costs roughly $500–$700/month at the floor plus $5k–$10k implementation, and about $3.5–4k/month for 10 techs (secondhand, competitor blogs). — [FieldProxy (vendor)](https://www.fieldproxy.ai/resources/blog/best-servicetitan-alternatives-for-small-hvac-companies-under-50-techs)
- HVAC-Talk: Jobber is "not very expensive, easy to use and does what we need it to do". One poster wanted software that can "assign a work order directly to a piece of equipment and also keep track of the maintenance agreements". — [HVAC-Talk: software to run business](https://www.hvac-talk.com/threads/hvac-software-to-run-business.2226005/); [HVAC-Talk: PM software](https://www.hvac-talk.com/threads/preventative-maintenance-software.1974241/)

**P18. Field crews coordinating over WhatsApp groups (photos and decisions get lost)**
- Vendor accounts: "40 progress photos being buried under 800 unrelated messages within two days"; "WhatsApp also strips most photo metadata during compression"; when staff leave, history leaves with them. Crews keep using WhatsApp because it is "simple, universal, and trusted"; ease of use is the top adoption driver (68%, vendor-cited survey). — [Banamind](https://banamind.ai/blog/why-construction-teams-use-whatsapp); [Valoon](https://valoon.chat/en/blog/whatsapp-groups-in-construction/); [SymTerra](https://www.symterra.co.uk/blog/construction-site-communication-app-uk); [Buildove](https://buildove.com/2025/09/13/the-whatsapp-trap-managing-construction-projects-on-whatsapp-is-costing-you-more-money/)

**P19. Nurse units still filling shifts with paper "short sheets"**
- allnurses: units post a paper "short" sheet; one manager kept a manual sheet for fear an app would lower pay; others found API and ShiftWizard frustrating. Most threads are several years old. — [allnurses: Bid Shift](https://allnurses.com/anyone-using-bid-shift-filling-t191785/); [allnurses: what scheduling do you use](https://allnurses.com/what-kind-scheduling-use-work-t622583/)

**P20. Freelancers and agencies chasing late B2B invoices**
- Ask HN, about April 2026: "How do you handle clients who don't pay on time?" The consensus is deposits, stopping work, and late fees. One commenter says "there aren't any worthwhile legal resources for freelancers." — [Ask HN 47638685](https://news.ycombinator.com/item?id=47638685); [Indie Hackers thread](https://www.indiehackers.com/post/freelancers-of-ih-how-do-you-actually-deal-with-a-client-paying-late-or-never-55972ef40e)

**P21. Trades: tracking employee licenses and CE across states**
- Spreadsheet templates sell to track license, state, board and expiry with 30/60/90-day colour flags. Guides concede "a spreadsheet is fine for a single-state shop". — [LicensedTrades](https://licensedtrades.com/blog/how-to-track-contractor-license-renewals-multi-state); [ContractorComply](https://contractorcomply.us/resources/contractor-license-expiration-tracking)

**P22. Self-managed HOAs tracking dues in spreadsheets**
- Many free or cheap tools exist: KindHOA $0/$29 flat, HomeHerald free up to 50 homes, AffordableHOA $49 flat. — [KindHOA](https://kindhoa.com/alternatives/best-self-managed-hoa-software); [AffordableHOA](https://affordablehoa.com/hoa-management-software)

### Inferences
- The strongest recurring pattern is **"evidence capture plus deadline"**: COI expiry, detention timestamps, deposit photos tied to deduction lines, signed T&M tickets, prior-auth expiry. Money is lost not because the work is hard but because proof was not captured at the moment it happened, or a date was missed.
- Workarounds cluster as: spreadsheet (COI, lien waivers, commissions, rent caps, licenses), shared Drive plus naming conventions (landlords), calendar reminders (landlords, COIs), WhatsApp (field crews), paper (nurse short sheets, BOL notes), and **hiring a person or BPO** (dental verification, COI human checkers, outsourced RCM). Hiring a person is the strongest willingness-to-pay signal.

### Gaps
- **No first-hand Reddit content could be retrieved** (blocked), so the subreddits named in the brief (r/smallbusiness, r/sysadmin, r/Accounting, r/landlord, r/PropertyManagement, r/HVAC, r/electricians, r/Plumbing, r/nursing, r/physicaltherapy, r/dentistry, r/Teachers, r/freelance, r/ecommerce, r/restaurateur, r/Truckers, r/Insurance, r/LawFirm, r/paralegal, r/vet) are **not directly represented**. A human should spot-check them manually.
- Two searches for sysadmin pains (SaaS offboarding, license sprawl on Spiceworks) returned no results. I found nothing on teachers or paralegals.
- I could not open full forum pages, so post dates for several forum threads are unknown. Some ContractorTalk/HVAC-Talk/allnurses threads are clearly older than 2024.

## Key Question 2: What do Hacker News "Ask HN: what tool do you wish existed / what would you pay to solve" threads from 2024–2026 say?

### Takeaway
I found relevant 2024–2026 HN threads, but I could not read their comment bodies. Only search-summary snippets were available, so HN contributes little verifiable B2B pain. The useful HN signal comes from 2026 "Who is hiring" posts, where funded startups describe industries "still running on spreadsheets and phone calls (and faxes!)". That is a **saturation signal**: VC-backed teams are already attacking those niches.

### Cited Findings
- "Ask HN: What work problems would your company pay to solve?" exists. The OP asks about manual workflows, reporting pain and compliance hassles. The item id suggests late 2025; the date is unconfirmed. The comment contents could not be retrieved. — [HN 46041165](https://news.ycombinator.com/item?id=46041165)
- Snippets from related HN threads (dates unclear): a sysadmin says upgrading a server fleet at end-of-life is painful and worth paying to solve. A trading group would pay for an upload-positions, get-margin-reports service because the CME tool's factors change intraday. Another commenter says firms in international trade pay to avoid customs delays rather than to cut compliance cost. — [HN search summary pointing to 46041165 and related threads](https://news.ycombinator.com/item?id=46041165)
- "Ask HN: What Problem Would You Solve with Unlimited Time and Money? [Apr 2025]" and "[May 2025]" are mostly consumer and moonshot wishes. — [HN 43670167](https://news.ycombinator.com/item?id=43670167); [HN 43883335](https://news.ycombinator.com/item?id=43883335)
- "Ask HN: What are the 'boring' businesses for hackers these days?" (Jan 2024). Its advice: look for "a MS Excel spreadsheet that gets mailed back and forth and edited" in niche non-technical industries, priced around $50–$250/month. — [HN 38882314](https://news.ycombinator.com/item?id=38882314)
- 2026 HN "Who is hiring" posts: hotel procurement is "a $400B industry still running on spreadsheets and phone calls (and faxes!)" (Feb 2026); contractors "still run payroll, compliance, and job costing across spreadsheets and legacy software" (Mar 2026); hardware supply chains "run on spreadsheets, email, and PDFs" (Jun 2026). — [Feb 2026](https://news.ycombinator.com/item?id=46857488); [Mar 2026](https://news.ycombinator.com/item?id=47219668); [Jun 2026](https://news.ycombinator.com/item?id=48357725)
- Healthcare fax persists. Commenters say records for out-of-network providers usually move by fax, and that fax is "not considered 'electronic media' under HIPAA". — [Ask HN: who still uses faxes (2022)](https://news.ycombinator.com/item?id=29517259)
- Ask HN (about April 2026) on late-paying clients. Consensus: deposits of 20–50%, stop work, late fees of "5-10% each month". — [HN 47638685](https://news.ycombinator.com/item?id=47638685)

### Inferences
- HN wish threads skew toward developer and consumer wishes. For B2B vertical pain they are weaker than trade forums.
- The "Who is hiring" evidence means construction compliance, hotel procurement and supply chains already have funded startups hiring engineers in 2026.

### Gaps
- Comment-level content from HN 46041165 (the most on-target thread) could not be read. A human should read it directly.
- HN Algolia queries for 2024–2026 "Ask HN" threads were not possible (host blocked).

## Key Question 3: For each pain, who suffers, how often, what does it cost, who already serves it (names, pricing, funding), why do people still complain, what is the devil's-advocate case, and what is the verdict?

### Takeaway
Under aggressive checking, **almost every pain already has several funded or cheap products**, often a dozen or more SEO-driven niche tools, which is itself evidence of saturation. **No pain cleanly passes "critical + underserved".** Three survive only conditionally, as narrow wedges:
- **(A) Evidence capture for subcontractor extra work (T&M/change-order sign-off) for small specialty subs.** Clearstory serves the top GCs; small subs are underserved.
- **(B) California small-landlord compliance documentation (AB 2801 photo-to-deduction linkage plus AB 1482/local rent-cap tracking).** It is new, regulation-driven, has penalties, and its tools are fragmented and immature.
- **(C) Detention proof and collection for owner-operators.** Real money is lost and the tools are tiny and fragmented, but the root cause is leverage.

The other 19 are DROPPED.

### Cited Findings

#### Scoreboard
| # | Pain | Who pays | Verdict |
|---|---|---|---|
| P1 | Sub COI tracking | GCs, PMs | DROPPED (crowded down to $39/mo) |
| P2 | Bookkeeper document chasing | Bookkeepers/CPAs | DROPPED (crowded; behavioral root cause) |
| P3 | Dental insurance verification | Dental practices | DROPPED (well-funded AI rush) |
| P4 | Detention proof/collection | Owner-operators, small fleets | SURVIVES (conditional, weak) |
| P5 | CA landlord AB 2801/AB 1482 compliance | 1–50 unit CA landlords | SURVIVES (conditional, small TAM) |
| P6 | Carrier-portal re-entry | Independent agencies | DROPPED (raters/incumbents/RPA) |
| P7 | Commission reconciliation | Agencies | DROPPED (served from $67/mo) |
| P8 | Delivery-platform disputes | Restaurants | DROPPED (Loop AI $20M raised, Voosh) |
| P9 | Multichannel inventory sync | E-com sellers | DROPPED (saturated) |
| P10 | Chargebacks | E-com | DROPPED (saturated; network-rule constrained) |
| P11 | PT documentation | PTs/clinics | DROPPED (AI-scribe flood) |
| P12 | PT prior-auth tracking | Clinics | DROPPED (EMR feature; US-healthcare burden) |
| P13 | Vet comms/PIMS sync | Vet clinics | DROPPED (PIMS lock-in, incumbents) |
| P14 | Law conflict checks | Small firms | DROPPED (in Clio et al.) |
| P15 | Lien waivers | GCs/subs | DROPPED (Levelset/Procore, Siteline) |
| P16 | Unsigned extra work / T&M | Specialty subs | SURVIVES (conditional) |
| P17 | FSM too expensive | Small trades | DROPPED (Jobber/HCP etc.) |
| P18 | WhatsApp crews lose info | Field SMBs | DROPPED as standalone (many WhatsApp-native tools), but a key design insight |
| P19 | Nurse shift sheets | Hospitals | DROPPED (enterprise buyer) |
| P20 | Freelancer late payment | Freelancers | DROPPED (low WTP, contract problem) |
| P21 | Trade license/CE tracking | Multi-state contractors | DROPPED (small, served) |
| P22 | HOA dues | Volunteer boards | DROPPED (free tools) |

#### P1 Subcontractor COI tracking: DROPPED
- **Who/cost:** GC project coordinators and AP. The pain scales with the number of subs ("at thirty or forty, it becomes the bottleneck"). — [imagetotable (secondhand)](https://imagetotable.ai/blog/construction-coi-tracking-email-spreadsheet-problem)
- **Existing:** myCOI (no public price, estimated $500–2,000+/mo, enterprise); Billy (around $600/mo for 100–300 subs per one estimate); TrustLayer (free Starter up to 50 vendors, +$10/vendor/mo per one source); COI File $39–$199/mo. — [subdoc.io](https://subdoc.io/blog/affordable-coi-tracking-software); [trackmyvendor](https://trackmyvendor.com/mycoi-alternatives); [coifile](https://coifile.com/coi-tracking/best-software-for-contractors/)
- **Why complaints persist:** enterprise pricing for small GCs, and human-checker services (ISN/PICS) that don't automate. — [ContractorTalk](https://www.contractortalk.com/threads/software-for-managing-subcontractor-certs-of-insurance-associated-sub-data.264865/)
- **Devil's advocate:** a free tier (TrustLayer) plus a dozen AI-extraction entrants (subdoc, coipulse, coifile, trackmyvendor, imagetotable, an Apify actor) already compete for the low end. Search results for this query are dominated by them. — [Apify actor](https://apify.com/armourylabs/subcontractor-certificate-expiry-checker); [coipulse](https://coipulse.com/blog/mycoi-alternatives)

#### P2 Bookkeeper document chasing: DROPPED
- **Who/cost:** bookkeepers and small accounting firms, monthly. Around 3–4 hours per client per year in queries plus chasing (one practitioner's estimate). — [AccountingWEB](https://www.accountingweb.co.uk/any-answers/how-many-sole-traders-can-a-bookkeeper-manage)
- **Existing:** Content Snare (from about $29–35/mo); TaxDome (about $800–1,200/user/yr); Financial Cents, Karbon, Uku, DocChase, Dext/Hubdoc. — [Capterra Content Snare](https://www.capterra.com/p/167019/Content-Snare/); [Capterra TaxDome](https://www.capterra.com/p/186749/TaxDome/); [getuku](https://getuku.com/articles/taxdome-pricing/)
- **Devil's advocate:** practitioners themselves say "there's no magic software that will make clients provide records". The bottleneck is client behaviour, and many cheap tools already automate reminders. — [AccountingWEB](https://www.accountingweb.co.uk/any-answers/how-many-sole-traders-can-a-bookkeeper-manage)

#### P3 Dental insurance verification: DROPPED
- **Who/cost:** front desk, daily, about 2 hours/day (Dentaltown) up to roughly 1 FTE (vendor estimate). Practices already pay BPOs, which shows willingness to pay. — [Dentaltown](https://www.dentaltown.com/channel/post/7458/is-dental-insurance-eligibility-taking-too-much-time)
- **Existing/funding:** Patientdesk AI ($1M pre-seed, YC, live in 60+ clinics, Feb 2026); Toothy AI (YC W25, $5.4M, Accel); LightSpun ($13M Series A, about Sep 2025); Trust AI ($6M seed, Aug 2025); Zentist; plus Vyne/Onederful-type clearinghouses. — [Dealroom/Patientdesk](https://app.dealroom.co/news/feed/patientdesk-ai-raises-1m-pre-seed-from-y-combinator-to-automate-dental-front-desks-with-real-time-insurance-verification); [Dental Tribune/Trust AI](https://www.dental-tribune.com/news/trust-ai-the-chatgpt-for-dentists-raises-us6-million-in-seed-funding/); [vcbacked dental directory](https://www.vcbacked.co/directory/industries/dental)
- **Devil's advocate:** a critical pain, but a crowded 2025–26 AI-agent gold rush. US payer integrations and HIPAA add cost, and it is hard for an Israel-based solo founder to sell to US dental offices.

#### P4 Detention proof and collection for owner-operators: SURVIVES (conditional, weak)
- **Who/cost:** owner-operators and small fleets, on every load with dwell time. An FMCSA figure puts the industry cost above $3B. A vendor attributes to ATRI (Sep 2024) the finding that carriers invoice detention about 75% of the time and are paid on about 55% of those invoices (unverified against ATRI). — [Senate Commerce doc](https://www.commerce.senate.gov/index.php/services/files/BAE24B91-2539-4DFA-B966-9E5491826733); [dockclaim (vendor)](https://dockclaim.com/compare/detention-tracking-software)
- **Existing:** DockClaim $49/mo; DockClock free plus 10% of collected claims; Detention Defender $20/mo (pre-launch); Detention Source and Detention Gun (iOS); DetentionIQ (fleet, integrates with Samsara/Motive); TMS modules. — [dockclaim](https://dockclaim.com/compare/detention-tracking-software); [DockClock](https://dockclock.app/); [DetentionIQ](https://www.detentioniq.com/); [Detention Source](https://apps.apple.com/us/app/detention-source/id6444958697)
- **Why still complaining:** the proof has to satisfy rate-con terms (notice before free time, BOL in/out signed), and receivers refuse to sign times. That is a workflow and contract problem, not just GPS. — [TheTruckersReport](https://www.thetruckersreport.com/truckingindustryforum/threads/how-to-get-brokers-to-actually-pay-detention.2145331/page-2)
- **Devil's advocate:** brokers often pay detention only if they collect from the shipper, so better proof doesn't create leverage. The market is already full of tiny apps, which suggests low ARPU and a fragmented audience reachable only through trucker channels. ELD giants (Motive/Samsara) can add it as a feature.

#### P5 California small-landlord compliance (AB 2801 + AB 1482 + local ordinances): SURVIVES (conditional, small TAM)
- **Who/cost:** individual and small CA landlords at every turnover (deposit) and every rent increase. Penalties: deduction forfeiture after the 21 days, and rent rollback plus penalties for an over-cap increase (per forum posters). — [BiggerPockets](https://www.biggerpockets.com/forums/899/topics/1288628-landlords-in-ca-how-are-small-landlords-handling-ab-1482-and-ab-2801-paperwork)
- **Existing:** inspection apps RentCheck (about $1–1.25/unit/mo per Buildium) and zInspector (free up to about 5 units, paid from about $22/mo); rent-cap tools such as the CAA members-only CPI calculator, LeaseBase (claims per-property AB 1482 tracking including local ordinances), RentGuard (free tier plus paid reminders of the 12-month rule), RentCeiling and Keywise; full PM suites (Buildium/AppFolio) for larger owners. — [Buildium roundup](https://www.buildium.com/blog/best-property-management-inspection-software/); [CAA](https://caanet.org/caa-updates-cpi-calculator-for-rent-increases-under-ab-1482-2026/); [LeaseBase](https://leasebase.ai/ab1482-calculator/); [RentGuard](https://rentguardca.com/); [Keywise](https://www.keywise.app/blog/california-ab-1482-explained-2026)
- **Why still complaining:** the specific gap voiced is linking each deduction line to specific photos and invoices and hitting the deadline ("can't connect photos to line items"). Calculators even disagree on the numbers: LA at 8.7% (LeaseBase) vs. 6.0% local (RentCeiling). — [BiggerPockets](https://www.biggerpockets.com/forums/899/topics/1288628-landlords-in-ca-how-are-small-landlords-handling-ab-1482-and-ab-2801-paperwork); [RentCeiling](https://rentceiling.com/california)
- **Devil's advocate:** small landlords are price-sensitive and act almost like consumers. The market is California-only, and several 2025–26 entrants appeared at once. TurboTenant/Avail/RentCheck can add an "AB 2801 itemization" feature cheaply. US legal-compliance liability is another hurdle, and the founder has to reach US landlords from Israel.

#### P6 Carrier-portal re-entry (insurance agents): DROPPED
- **Existing:** comparative raters (EZLynx, PL Rating, and similar), Bolt, Relay, browser-automation vendors (Skyvern, Autonoly), and the IVANS connectivity network. — [Relay](https://relayins.com/blog/carrier-portal-automation); [Skyvern](https://www.skyvern.com/blog/automate-insurance-carrier-portal-workflows/); [FirstConnect](https://www.firstconnectinsurance.com/blog/insurance-quoting-software/)
- **Devil's advocate:** it depends on carrier cooperation and portals that break RPA, and incumbents own the agency management system.

#### P7 Commission reconciliation: DROPPED
- **Existing:** Commission Tracker ($67–72/mo flat plus a $120 sign-up fee; done-for-you processing $187/mo); AgencyBloc (about $59–109/user/mo plus a commissions module); AgencyComp; Commissions Wizard; Insurstein. — [commission-tracker pricing](https://commission-tracker.com/pricing/); [GetApp](https://www.getapp.com/sales-software/a/commission-tracker-for-insurance/); [AgencyComp](https://agencycomp.com/)
- **Devil's advocate:** already served cheaply, and AMS vendors (Applied, HawkSoft) bundle it.

#### P8 Delivery-platform error charges (restaurants): DROPPED
- **Existing/funding:** Loop AI ($6M in 2024 led by Base10, then a $14M Series A in Feb 2026 led by Nyca); Voosh (claims 80–90% dispute win rate); KoreFi. — [Restaurant Business](https://www.restaurantbusinessonline.com/technology/loopai-raises-6m-app-automates-third-party-delivery-bookkeeping); [Verdict Foodservice](https://www.verdictfoodservice.com/news/loop-ai-secures-funding-to/); [Food On Demand](https://foodondemand.com/05172024/its-really-just-theft-freddys-exec-says-of-chargebacks-at-fodc/)
- **Devil's advocate:** funded leaders exist, and it depends on platform data access.

#### P9 Inventory sync: DROPPED
- **Existing:** Sellbrite, Trunk, Sumtracker, Linnworks, Cin7 Core and others. — [Shopify Community](https://community.shopify.com/t/best-inventory-sync-tool-for-shopify/672498)

#### P10 Chargebacks: DROPPED
- **Existing:** many chargeback-automation vendors. Outcomes are decided by card networks and banks ("the bank... makes the decision"). — [Shopify Community](https://community.shopify.com/t/chargebacks-friendly-fraud-and-arbitrations/339868)

#### P11 PT documentation: DROPPED
- **Existing:** a flood of AI documentation tools (SPRY, Chartnote, EZPT, Physitrack, WebPT features). Even vendors concede "faster notes don't automatically reduce burnout". — [Physitrack](https://www.physitrack.com/insights/ai-documentation-pt-burnout); [EZPT](https://www.ezpttech.com/); [Chartnote](https://blog.chartnote.com/ai-documentation-for-physical-therapy-reclaiming-the-most-expensive-hour-of-the-day/)

#### P12 PT prior-auth tracking: DROPPED
- **Existing:** EMR auth-tracking modules, heno.io, and outsourced RCM. — [heno.io](https://www.heno.io/prior-authorizations/); [rcmworkshop](https://rcmworkshop.com/insights/blogs/physical-therapy-prior-authorization-handling-visit-limits-and-payer-restrictions/)
- **Devil's advocate:** it is an EMR feature, and selling it means HIPAA work and US payer complexity.

#### P13 Vet communications: DROPPED
- **Existing:** Weave, PetDesk, Vello/IDEXX, Shepherd and others. The core complaint is PIMS integration, which the PIMS vendors control. — [Tailwerks](https://tailwerks.com/best-veterinary-client-communication-software/)

#### P14 Law conflict checks: DROPPED
- **Existing:** Clio Grow and the conflict modules in most practice-management suites. — [Clio Grow](https://www.clio.com/grow/); [Guideflow list](https://www.guideflow.com/blog/conflict-check-software)

#### P15 Lien waivers: DROPPED
- **Existing:** Levelset (Procore), Siteline, LienDone, Brixx's list of 8 options. — [Siteline](https://www.siteline.com/blog/best-lien-waiver-management-software-for-subcontractors); [Levelset](https://www.levelset.com/lien-waivers/lien-waiver-software/); [Brixx](https://brixxdigital.com/blog/lien-waiver-software)

#### P16 Unsigned extra work / T&M tickets for small specialty subs: SURVIVES (conditional)
- **Who/cost:** electrical, plumbing and drywall subs on GC jobs, on every scope change. Unpaid extras lead to liens and partial settlements. — [ContractorTalk](https://www.contractortalk.com/threads/do-you-break-out-a-change-order-on-extras-on-small-jobs.344569/)
- **Existing:** Clearstory ($16M Series B in Jun 2024, about $35M total). It is aimed at large GCs: 13 of the 25 largest North American GCs, and 19,000 change orders worth over $850M a month on its network. Residential/FSM suites (Jobber, Buildertrend, JobTread) include change orders. Procore/Fieldwire/Raken cover T&M on the GC side. — [BusinessWire/Clearstory](https://www.businesswire.com/news/home/20240627887251/en); [Commercial Observer](https://commercialobserver.com/2024/06/proptech-startup-clearstory-series-b/)
- **Why still complaining:** the failure happens in the field. The foreman doesn't capture a signed, priced ticket before the work starts, and the GC super won't sign. Tools sold to the GC don't fix the sub's incentive.
- **Devil's advocate:** this is a power and contract problem; GCs can simply refuse to sign. Clearstory can move downmarket. Subs already use generic apps (photos, e-sign, DocuSign). Construction sales cycles are long and need deep local knowledge, which is harder from Israel. It is unclear whether small subs pay.

#### P17 FSM too expensive: DROPPED
- **Existing:** Jobber (from about $39/mo), Housecall Pro, Workiz, Service Fusion, FieldEdge and others. — [ContractorTalk mention of Jobber price](https://www.contractortalk.com/threads/need-recommendation-for-job-costing-software.457514/); [Jobber](https://getjobber.com/academy/servicetitan-competitors/)

#### P18 WhatsApp-run field crews: DROPPED as a standalone (design insight retained)
- **Existing:** Valoon (WhatsApp-like construction chat), Banamind (WhatsApp capture), Zenzap, SymTerra, Site Setu, Convoe. — [Valoon](https://valoon.chat/en/blog/whatsapp-groups-in-construction/); [Zenzap](https://www.zenzap.co/blog-posts/5-best-work-chat-apps-for-construction/); [Banamind](https://banamind.ai/blog/whatsapp-groups-construction-teams-best-practices)
- **Devil's advocate:** many entrants, and Meta's WhatsApp Business API rules and costs limit what can be built.

#### P19–P22: DROPPED
- Nurse scheduling: an enterprise hospital buyer, with incumbents (API, ShiftWizard, Bid Shift). — [allnurses](https://allnurses.com/what-kind-scheduling-use-work-t622583/)
- Freelancer late pay: low willingness to pay; the HN consensus fix is contractual (deposits, stop-work). — [HN 47638685](https://news.ycombinator.com/item?id=47638685)
- License tracking: served by ContractorComply, TrackMyVendor, AceWatt and spreadsheet templates. — [TrackMyVendor](https://trackmyvendor.com/); [AceWatt](https://acewatt.com/blog/electrical-contractor-certification-tracking-software)
- HOA: free and flat-fee tools. — [KindHOA](https://kindhoa.com/alternatives/best-self-managed-hoa-software)

### Inferences
- **Meta-finding:** in 2025–26, AI-extraction and agent startups plus SEO "alternatives" blogs have flooded nearly every "chase a document / track an expiry" niche (COI, lien waivers, licenses, detention, rent caps). Pain alone no longer separates opportunities. **Distribution and a specific wedge** (a sub-segment the leaders ignore, a new regulation, a non-US geography) matter more.
- For an Israeli solo or small-team founder, the three conditional survivors are all **US-specific** (California law, US trucking, US construction contracts). One unexplored option is to transpose a proven pattern (e.g., COI/vendor-compliance tracking, the bookkeeper document-chase portal, WhatsApp-native field capture) into **Israel/Hebrew or other non-US markets**, where vendors like TrustLayer, Content Snare or Clearstory may not localize. This is untested: no evidence was gathered on Israeli market gaps.
- Pains where buyers **already pay a human** (dental verification BPOs, ISN/PICS COI checkers, outsourced auth tracking, commission-processing services at $187/mo) show the clearest willingness to pay, but they are also where funded AI startups are concentrating.

### Gaps
- Funding for many named vendors (TrustLayer, myCOI, Billy, Valoon, DockClaim, LeaseBase, Voosh) was not verified.
- The ATRI detention-payment statistic and the WebPT 2024 survey figures were seen only through vendor citations.
- Effective dates for AB 2801 conflict between sources. The statute (Civ. Code §1950.5) was not checked.
- There is no quantitative sizing of the conditional survivors (number of CA small landlords, owner-operators, specialty subs).
- Israeli/localized versions of these pains were not researched; outside scope as searched.
