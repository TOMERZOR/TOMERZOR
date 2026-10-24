# Lading product brief

Working name. "Sidemark" was the first choice, but it is already a CRM for interior designers.

## The problem

Residential interior designers order furniture, lighting, fabric and stone from many vendors per project. Vendors report changes in their own formats: PDF acknowledgments, backorder emails, freight tracking notices, receiving reports. Someone at the studio reads each one, updates the order tracker by hand, works out whether the install date still holds, and explains the delay to the client. Most of that time is not billed.

Evidence gathered so far (October 2026):

- Designers say they spend more time confirming availability and following up on backorders than designing ([Posh Surfside](https://poshsurfside.com/a-day-in-the-life-of-an-interior-designer)).
- Clients have no mental model of procurement, so every delay arrives as a surprise ([Interior Design Community](https://interiordesigncommunity.com/client-expectations-product-delays/)).
- Low fees mean designers absorb procurement work, which leads to burnout ([Into Design](https://intodesign.online/how-to-price-interior-design-furniture-sourcing/)).
- Shipping damage and losses are rising, and carrier inboxes often lead nowhere ([Business of Home, Aug 2026](https://businessofhome.com/articles/why-designers-are-taking-shipping-and-receiving-into-their-own-hands)).

## What exists

- Design-business tools (Studio Designer, Programa, Houzz Pro, DesignFiles) have order trackers and client portals, but the vendor updates are typed in by hand. No public source shows any of them reading acknowledgment emails automatically.
- General AI purchase-order tools (Canals, Parashift, Leverage) read supplier confirmations for manufacturers and contractors, not for design studios.

The gap is a design-specific reader: one that understands sidemarks, COM fabric, receivers, room-by-room install dates, and how a designer talks to a client.

## The product

1. **Review:** every vendor email, read and matched to an order, with the exact line each value came from. Uncertain reads (vague dates, missing PO numbers, several possible orders) wait for the designer.
2. **Orders:** all items on one time axis. Lost time is hatched. Each room states whether everything arrives before its install date.
3. **Client updates:** a plain-language draft per project, built from the changes the designer applied. The designer edits it and sends it from their own email.

## Why it could fail

| Risk | What the design does about it | What still needs proof |
|---|---|---|
| Design-business tools add this themselves | Built to sit beside them, not replace them | Whether studios pay for a second tool, or whether this ends as an acquisition or integration |
| One wrong date sent to a client destroys trust | Every value cites its source line; uncertain reads need confirmation; every change can be undone | Real-world read accuracy on messy vendor PDFs |
| Studios won't connect their email | Works from a shared orders@ inbox or forwarded mail, never a personal inbox | Whether most studios already have such an inbox |
| Small studios have small budgets | Free pilot first | Willingness to pay after the pilot |
| Time saved is unproven | Pilot measures it | Hours saved per week, in the studios' own words |

## How to test it before building software

Recruit ten residential studios placing at least twenty orders a month. For two weeks, they forward vendor emails and a person updates their tracker and drafts client notes by hand, using this prototype as the visual reference. Build the software only if, after two weeks, most studios keep forwarding emails without being reminded and say they would pay for it.

## Files

- `DESIGN.md`: the Carbon Copy design language
- `index.html`: landing page with the pilot sign-up (the form does not send anywhere yet)
- `app.html`: clickable prototype with sample data
