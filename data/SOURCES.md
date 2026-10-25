# Sources and attribution

Seed data compiled 2026-09-21/22. Each row's `sources` field lists the URLs it was built from, and `data_source_license` names any CC BY dataset it uses.

## Open datasets (CC BY 4.0)

These datasets are licensed under Creative Commons Attribution 4.0 International (https://creativecommons.org/licenses/by/4.0/). Values were selected and in some cases combined with other sources (adapted). The data comes with no warranty.

- **Robot Price Index**: Source: [Robot Price Index](https://robotpriceindex.com). Dataset: https://github.com/tdvchina/robot-price-index-data (`data/robot-price-index.csv`, as_of 2026-09). Published by The Dream View Co., Ltd. Used for price ranges, availability, launch year, height and weight.
- **humanoidrecord.com**: Data from humanoidrecord.com, CC BY 4.0. Retrieved 2026-09-21 from https://github.com/siebej/humanoidrecord-data (`robots.json`). Used for price history, order type and delivery-status notes on humanoids.
- **Integrarobot Robotics Database**: Integrarobot, https://github.com/integrarobot/integrarobot-robotics-database (`data/humanoids.csv`). Used to cross-check official URLs and specs.

## Other sources (facts only, not redistributed content)

- FCC equipment authorization: the seed grant dates were read from the mirrors fccid.io and fcc.report (each row's `sources`); the weekly collector reads FCC PSHSB public notices as PDFs from docs.fcc.gov and extracts Appendix B, and `us_status.source_url` points at the FCC document it came from. The OET Laboratory Services API (KDB 953436, `getFCCIDList`) was tried first and abandoned: apps.fcc.gov is Akamai-blocked from CI runners and from every other origin tried, and no bypass was used. Covered List and Conditional Approval facts come from the FCC public notices DA 26-786, DA 26-789, DA 26-957 and DA 26-996 (docs.fcc.gov); see `context/fcc-api-notes.md`.
- Secondary FCC-ID listings: RoboZaps (https://blog.robozaps.com/b/humanoid-robots-legal-in-us) and Global Drone HQ (https://globaldronehq.com/blogs/guides/agibot-robot-price-guide-2026). These are flagged in `resale_policy_note`.
- The FCC Covered List action on foreign-produced advanced robotic devices (2026-07-28): National Law Review and Sidley Austin summaries.
- Manufacturer and store pages: unitree.com, shop.unitree.com, 1x.tech, booster.tech, pollen-robotics.com, huggingface.co, petoi.com, keyirobot.com, anki.bot, seeedstudio.com, bostondynamics.com, deeprobotics.us and others.
