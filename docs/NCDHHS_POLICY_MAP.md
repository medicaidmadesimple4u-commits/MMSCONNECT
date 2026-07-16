# NCDHHS policy map for MMS Connect

Policy release: `2026.1`  
Reviewed: July 16, 2026

MMS Connect uses official North Carolina Department of Health and Human Services material to organize an intake. It does not make an NC Medicaid eligibility decision and is not a replacement for ePASS, a county Department of Social Services, or an official signed application.

## Authoritative sources

- [How to Apply for NC Medicaid](https://medicaid.ncdhhs.gov/apply)
- [NC Medicaid Eligibility](https://medicaid.ncdhhs.gov/eligibility)
- [Family and Children’s Medicaid policies and manuals](https://policies.ncdhhs.gov/divisional-a-m/health-benefits-nc-medicaid/family-and-childrens-medicaid/fcm-policies-manuals/)
- [Adult Medicaid policies and manuals](https://policies.ncdhhs.gov/divisional-a-m/health-benefits-nc-medicaid/adult-medicaid/)
- [2026 MAGI Medicaid and Medicaid Expansion income limits](https://policies.ncdhhs.gov/document/2026-magi-medicaid-medicaid-expansion-income-limits/)
- [2026 Non-MAGI Medicaid income and reserve limits](https://policies.ncdhhs.gov/document/2026-non-magi-medicaid-income-reserve-limits/)
- [NCDHHS Special Assistance policies and manuals](https://policies.ncdhhs.gov/divisional-n-z/social-services/special-assistance/)
- [Special Assistance In-Home Program Manual](https://policies.ncdhhs.gov/document/special-assistance-in-home-program-manual/)

## Program coverage

| Intake pathway | Primary manual sections |
| --- | --- |
| Medicaid Expansion Adult | MA-3306, MA-3321 |
| Infants and Children | MA-3230, MA-3306, MA-3321 |
| Pregnancy Coverage | MA-3240, MA-3245, MA-3246 |
| Caretaker Relative or Kinship | MA-3235, MA-3306 |
| Former or Current Foster Care | MA-3232, MA-3233, MA-3234 |
| Family Planning Program | MA-3265, MA-2170 |
| Breast and Cervical Cancer Medicaid | MA-3250 |
| Aged, Blind, or Disabled Medicaid | MA-2000, MA-2100–2120, MA-2525, MA-2531 |
| Medicare Savings Programs | MA-2130, MA-2140, MA-2160 |
| Health Coverage for Workers with Disabilities | MA-2150, MA-2180 |
| Nursing Facility / Institutional Long-Term Care | MA-2270, MA-2231, MA-2240–2245 |
| Community Alternatives Program | MA-2280, MA-3260 |
| PACE | MA-2275, MA-3270 |
| NC Innovations Waiver | MA-2282 |
| Traumatic Brain Injury Waiver | MA-2283 |
| State/County Special Assistance in a Facility | SA-3100, SA-3110, SA-3200 |
| Special Assistance In-Home | SA-3100, SA-3110, SA-5200 |

## Implementation rules

1. Store the policy version used for every future application.
2. Treat income and resource amounts as versioned reference data, never permanent constants in a form.
3. Show the applicable policy section beside staff review prompts.
4. Ask only questions required by the selected pathway and its conditional branches.
5. Describe documents as possible supporting information unless NCDHHS explicitly requires them for the situation.
6. Never tell a user that MMS Connect has approved, denied, or officially determined Medicaid eligibility.
7. Route applicants to ePASS or their county DSS for the official application and determination unless an approved submission integration exists.

## Release boundary

The current application page is a policy preview. It displays the program-specific intake map but does not collect or save answers. Confidential intake storage remains disabled until access controls, encryption, audit coverage, retention, incident response, vendor agreements, and privacy review are approved.
