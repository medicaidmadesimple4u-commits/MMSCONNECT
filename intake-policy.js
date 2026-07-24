export const policyRelease = {
  version: '2026.2',
  reviewedOn: 'July 23, 2026',
  jurisdiction: 'North Carolina',
  notice: 'This guide organizes official resources for an application. NC Medicaid, the county Department of Social Services, and the applicable program coordinator make all eligibility and form-requirement decisions.'
};

export const policySources = {
  apply: { title: 'How to Apply for NC Medicaid', url: 'https://medicaid.ncdhhs.gov/apply' },
  eligibility: { title: 'NC Medicaid Eligibility', url: 'https://medicaid.ncdhhs.gov/eligibility' },
  familyManual: { title: 'Family and Children’s Medicaid policies and manuals', url: 'https://policies.ncdhhs.gov/divisional-a-m/health-benefits-nc-medicaid/family-and-childrens-medicaid/' },
  adultManual: { title: 'Adult Medicaid policies and manuals', url: 'https://policies.ncdhhs.gov/divisional-a-m/health-benefits-nc-medicaid/adult-medicaid/' },
  dhbForms: { title: 'NC Medicaid (DHB) forms library', url: 'https://policies.ncdhhs.gov/divisional-a-m/health-benefits-nc-medicaid/dhb-forms/' },
  magiLimits: { title: '2026 MAGI Medicaid and Medicaid Expansion income limits', url: 'https://policies.ncdhhs.gov/document/2026-magi-medicaid-medicaid-expansion-income-limits/' },
  nonMagiLimits: { title: '2026 Non-MAGI Medicaid income and reserve limits', url: 'https://policies.ncdhhs.gov/document/2026-non-magi-medicaid-income-reserve-limits/' },
  specialAssistance: { title: 'NCDHHS Special Assistance policies and manuals', url: 'https://policies.ncdhhs.gov/divisional-n-z/social-services/special-assistance/' },
  specialAssistanceInHome: { title: 'Special Assistance In-Home Program Manual', url: 'https://policies.ncdhhs.gov/document/special-assistance-in-home-program-manual/' }
};

export const programManuals = [
  { id: 'ma3236', title: 'MA-3236 — MAGI Adult Medicaid Expansion', url: 'https://policies.ncdhhs.gov/document/ma-3236-magi-adult-medicaid-expansion/' },
  { id: 'ma3230', title: 'MA-3230 — Auto Newborn', url: 'https://policies.ncdhhs.gov/document/ma-3230-auto-newborn/' },
  { id: 'ma3240', title: 'MA-3240 — Pregnant Woman Coverage', url: 'https://policies.ncdhhs.gov/document/ma-3240-pregnant-woman-coverage/' },
  { id: 'ma3235', title: 'MA-3235 — Caretaker Relatives / Kinship', url: 'https://policies.ncdhhs.gov/document/ma-3235-caretaker-relatives-kinship/' },
  { id: 'ma3233', title: 'MA-3233 — Former Foster Care Children', url: 'https://policies.ncdhhs.gov/document/ma-3233-former-foster-care-children-mfc/' },
  { id: 'ma3234', title: 'MA-3234 — Expanded Foster Care Program', url: 'https://policies.ncdhhs.gov/document/ma-3234-expanded-foster-care-program-efcp/' },
  { id: 'ma3265', title: 'MA-3265 — Family Planning Program', url: 'https://policies.ncdhhs.gov/document/ma-3265-family-planning-program/' },
  { id: 'ma3250', title: 'MA-3250 — Breast and Cervical Cancer Medicaid', url: 'https://policies.ncdhhs.gov/document/ma-3250-breast-and-cervical-cancer-medicaid-bccm/' },
  { id: 'ma3200', title: 'MA-3200 — Family and Children’s Medicaid Application', url: 'https://policies.ncdhhs.gov/document/ma-3200-application/' },
  { id: 'ma2000', title: 'MA-2000 — Non-SSI Eligibility Regulations', url: 'https://policies.ncdhhs.gov/document/ma-2000-non-ssi-eligibility-regulations/' },
  { id: 'ma2130', title: 'MA-2130 — Qualified Medicare Beneficiaries (Q)', url: 'https://policies.ncdhhs.gov/document/ma-2130-qualified-medicare-beneficiaries-q/' },
  { id: 'ma2140', title: 'MA-2140 — Qualified Medicare Beneficiaries (B)', url: 'https://policies.ncdhhs.gov/document/ma-2140-qualified-medicare-beneficiaries-b/' },
  { id: 'ma2160', title: 'MA-2160 — Qualifying Individual (MQB-E)', url: 'https://policies.ncdhhs.gov/document/ma-2160-qualified-individual-mqb-e/' },
  { id: 'ma2180', title: 'MA-2180 — Health Coverage for Workers with Disabilities', url: 'https://policies.ncdhhs.gov/document/ma-2180-health-coverage-for-workers-with-disabilities/' },
  { id: 'ma2270', title: 'MA-2270 — Long-Term Care Need and Budgeting', url: 'https://policies.ncdhhs.gov/document/ma-2270-long-term-care-need-and-budgeting/' },
  { id: 'ma2280', title: 'MA-2280 — Community Alternatives Program', url: 'https://policies.ncdhhs.gov/document/ma-2280-community-alternatives-program-cap/' },
  { id: 'ma2275', title: 'MA-2275 — Program of All-Inclusive Care for the Elderly', url: 'https://policies.ncdhhs.gov/document/ma-2275-program-of-all-inclusive-care-for-the-elderly-pace/' },
  { id: 'ma2282', title: 'MA-2282 — Innovations', url: 'https://policies.ncdhhs.gov/document/ma-2282-innovations/' },
  { id: 'ma2283', title: 'MA-2283 — Traumatic Brain Injury Waiver', url: 'https://policies.ncdhhs.gov/document/ma-2283-traumatic-brain-injury-tbi/' },
  { id: 'ma2300', title: 'MA-2300 — Adult Medicaid Application', url: 'https://policies.ncdhhs.gov/document/ma-2300-application/' },
  { id: 'saManual', title: 'State/County Special Assistance Manual', url: 'https://policies.ncdhhs.gov/wp-content/uploads/Special-Assistance-Manual-Rev-July-2024.pdf' },
  { id: 'saihManual', title: 'Special Assistance In-Home Program Manual', url: 'https://policies.ncdhhs.gov/document/special-assistance-in-home-program-manual/' }
];

export const dssForms = [
  { id: 'dhb5200', title: 'DHB-5200 — Application for Health Coverage', kind: 'Application start', when: 'General full NC Medicaid application.', url: 'https://policies.ncdhhs.gov/document/dhb-5200-iaapplication-for-health-coverage-help-paying-costs/' },
  { id: 'dhb5201', title: 'DHB-5201 — Single-Adult Short Form', kind: 'Application option', when: 'May be used by an eligible single adult; DSS determines whether it fits the case.', url: 'https://policies.ncdhhs.gov/document/dhb-5201-iaapplication-for-health-coverage-help-paying-costs-short-form/' },
  { id: 'appendixA', title: 'Appendix A — Health Coverage from Jobs', kind: 'Conditional supplement', when: 'Use when an applicant has or can obtain job-based coverage.', url: 'https://policies.ncdhhs.gov/document/dma-5202a-iahealth-coverage-from-jobs-appendix-a/' },
  { id: 'appendixB', title: 'Appendix B — American Indian / Alaska Native', kind: 'Conditional supplement', when: 'Use when an applicant or household member is American Indian or Alaska Native.', url: 'https://policies.ncdhhs.gov/document/dma-5202b-iaamerican-indian-or-alaska-native-family-member-ai-an-appendix-b/' },
  { id: 'appendixC', title: 'Appendix C — Authorized Representative', kind: 'Optional designation', when: 'Use when the applicant appoints a person or organization to act for them.', url: 'https://policies.ncdhhs.gov/document/dhb-5202c-iadesignation-of-authorized-representative-appendix-c/' },
  { id: 'appendixD', title: 'Appendix D — Income and Resources', kind: 'Conditional supplement', when: 'Commonly used for non-MAGI, aged/blind/disabled, and long-term-care financial information.', url: 'https://policies.ncdhhs.gov/document/dma-5202d-iaincome-resources-appendix-d/' },
  { id: 'appendixE', title: 'Appendix E — Medical Bills', kind: 'Conditional supplement', when: 'Use when requesting evaluation for eligible past medical bills.', url: 'https://policies.ncdhhs.gov/document/dhb-5202e-iamedical-bills-appendix-e/' },
  { id: 'dhb5203', title: 'DHB-5203 — Transfer of Assets Evaluation', kind: 'Conditional LTC form', when: 'Used for transfer-of-assets review when institutional or waiver rules require it.', url: 'https://policies.ncdhhs.gov/document/dhb-5203-transfer-of-assets-evaluation-form/' },
  { id: 'dhb5079', title: 'DHB-5079 — Breast and Cervical Cancer Medicaid Application', kind: 'Navigator/coordinator form', when: 'The BCCCP navigator coordinates this form; do not send it directly to DSS on your own.', url: 'https://policies.ncdhhs.gov/document/dhb-5079breast-and-cervical-cancer-medicaid-application/' },
  { id: 'dhb5081', title: 'DHB-5081 — BCCM Screening, Diagnosis and Treatment Verification', kind: 'Navigator/coordinator form', when: 'Completed as part of the BCCCP-coordinated BCCM packet.', url: 'https://policies.ncdhhs.gov/document/dhb-5081-iabreast-and-cervical-cancer-verification-screening-diagnosis-and-treatment/' },
  { id: 'bcccpReferral', title: 'BCCM Referral and Navigator Instructions', kind: 'Program entry', when: 'Start with an NC BCCCP navigator; the navigator submits the BCCM packet.', url: 'https://www.dph.ncdhhs.gov/programs/chronic-disease-and-injury/cancer-prevention-and-control-branch/nc-cancer-screening-and-support-programs/providers/refer-patient-breast-and-cervical-cancer-medicaid' },
  { id: 'capReferral', title: 'CAP/C and CAP/DA Referral Request', kind: 'Program entry', when: 'Request entry to CAP/C or CAP/DA; this is separate from the Medicaid financial application.', url: 'https://medicaid.ncdhhs.gov/documents/providers/programs-services/capda/cap-paper-referral-form-2021/open' },
  { id: 'paceProgram', title: 'PACE Program and Enrollment Information', kind: 'Program entry', when: 'Contact a local PACE organization for assessment and enrollment steps.', url: 'https://medicaid.ncdhhs.gov/beneficiaries/long-term-services-and-supports/program-all-inclusive-care-elderly' },
  { id: 'dhb5166', title: 'DHB-5166 — PACE Application Report', kind: 'PACE/DSS staff form', when: 'Program and DSS staff use this report in PACE application coordination.', url: 'https://policies.ncdhhs.gov/document/dhb-5166pace-application-report/' },
  { id: 'innovationsEntry', title: 'How to Apply for the NC Innovations Waiver', kind: 'Program entry', when: 'Contact the Local Management Entity/Managed Care Organization; there is no single statewide applicant PDF.', url: 'https://medicaid.ncdhhs.gov/beneficiaries/nc-innovations-waiver/how-apply-nc-innovations-waiver' },
  { id: 'tbiEntry', title: 'NC Traumatic Brain Injury Waiver', kind: 'Program entry', when: 'Use the official waiver page for current counties, eligibility, and Alliance Health entry contacts.', url: 'https://medicaid.ncdhhs.gov/behavioral-health-and-intellectual-developmental-disabilities-tailored-plan/traumatic-brain-injury-tbi-waiver' },
  { id: 'dss8190', title: 'DAAS-8190 — Special Assistance Application Workbook', kind: 'Application workbook', when: 'Used for State/County Special Assistance applications.', url: 'https://policies.ncdhhs.gov/document/daas-8190-ssi-non-ssi-application-workbook/' },
  { id: 'dss0031', title: 'DAAS-0031 — SAIH Interagency Referral', kind: 'Agency/DSS referral form', when: 'Used for Special Assistance In-Home interagency referral and coordination.', url: 'https://policies.ncdhhs.gov/document/daas-0031-saih-program-interagency-referral-form/' },
  { id: 'fl2', title: 'FL-2 — Adult Care Home Level-of-Care Form', kind: 'Clinical form', when: 'Completed by an authorized medical provider when the pathway requires level-of-care documentation.', url: 'https://policies.ncdhhs.gov/document/dma-372-124-ach-ia-adult-care-home-fl2-form/' },
  { id: 'hcwdRelease', title: 'DHB-5151 — HCWD Medical Information Release', kind: 'Conditional authorization', when: 'Used when HCWD needs authorization to obtain medical information.', url: 'https://policies.ncdhhs.gov/document/dhb-5151-health-coverage-for-workers-with-disabilities-hcwd-medical-information-release-authorization/' },
  { id: 'dssDirectory', title: 'North Carolina Local DSS Directory', kind: 'Official contact', when: 'Find the county DSS that accepts and processes the application.', url: 'https://www.ncdhhs.gov/divisions/social-services/local-dss-directory' },
  { id: 'epass', title: 'Apply Online through ePASS', kind: 'Official application portal', when: 'Submit an eligible NC Medicaid application online.', url: 'https://epass.nc.gov/' }
];

const manualsById = new Map(programManuals.map(item => [item.id, item]));
const formsById = new Map(dssForms.map(item => [item.id, item]));

const policyReferenceLinks = {
  'NC Medicaid application': formsById.get('dhb5200').url,
  'NC Medicaid application instructions': policySources.apply.url,
  'DHB-5200': formsById.get('dhb5200').url,
  'DHB-5201': formsById.get('dhb5201').url,
  'DMA-5202-A': formsById.get('appendixA').url,
  'DHB-5202C-ia': formsById.get('appendixC').url,
  'DMA-5202D-ia': formsById.get('appendixD').url,
  'DHB-5202E-ia': formsById.get('appendixE').url,
  'FL-2 requirements': formsById.get('fl2').url,
  'MA-3236': manualsById.get('ma3236').url,
  'MA-3230': manualsById.get('ma3230').url,
  'MA-3240': manualsById.get('ma3240').url,
  'MA-3235': manualsById.get('ma3235').url,
  'MA-3233': manualsById.get('ma3233').url,
  'MA-3234': manualsById.get('ma3234').url,
  'MA-3265': manualsById.get('ma3265').url,
  'MA-3250': manualsById.get('ma3250').url,
  'MA-2000': manualsById.get('ma2000').url,
  'MA-2130': manualsById.get('ma2130').url,
  'MA-2140': manualsById.get('ma2140').url,
  'MA-2160': manualsById.get('ma2160').url,
  'MA-2180': manualsById.get('ma2180').url,
  'MA-2270': manualsById.get('ma2270').url,
  'MA-2275': manualsById.get('ma2275').url,
  'MA-2280': manualsById.get('ma2280').url,
  'MA-2282': manualsById.get('ma2282').url,
  'MA-2283': manualsById.get('ma2283').url
};

export function getPolicyReferenceUrl(reference) {
  if (policyReferenceLinks[reference]) return policyReferenceLinks[reference];
  const direct = Object.entries(policyReferenceLinks).find(([key]) => reference.includes(key));
  if (direct) return direct[1];
  if (reference.startsWith('SA-') || reference.includes('FL-2')) return policySources.specialAssistance.url;
  if (reference.startsWith('MA-3') || reference.includes('MAGI') || reference.includes('Third-party')) return policySources.familyManual.url;
  if (reference.startsWith('MA-2')) return policySources.adultManual.url;
  return policySources.apply.url;
}

export const intakeSections = {
  applicant: { title: 'Applicant information', summary: 'Legal name, date of birth, contact information, preferred language, and the people requesting coverage.', policy: ['NC Medicaid application', 'MA-3200 / MA-2300'] },
  residency: { title: 'North Carolina residency', summary: 'Current home and mailing address, county, temporary absence, and available proof of North Carolina residence.', policy: ['MA-3335 / MA-2220', 'MA-3340 / MA-2221'] },
  citizenship: { title: 'Citizenship or immigration status', summary: 'Status only for each person applying and available identity evidence.', policy: ['MA-3330–3332', 'MA-2504–2506'] },
  household: { title: 'Household and tax relationships', summary: 'Household members, spouses, children, tax filers, dependents, and who is applying for coverage.', policy: ['MA-3306', 'MAGI household composition'] },
  income: { title: 'Income', summary: 'Employment, self-employment, benefits, other income, frequency, and available verification.', policy: ['MA-3300 / MA-3306', 'MA-2250'] },
  resources: { title: 'Resources', summary: 'Accounts, real property, vehicles, trusts, life insurance, burial arrangements, and other countable or excluded resources.', policy: ['MA-2230', 'DMA-5202D-ia'] },
  transfers: { title: 'Transfers and property history', summary: 'Transfers, gifts, sales below value, trusts, annuities, and home equity information when institutional or waiver services are requested.', policy: ['MA-2240', 'MA-2242', 'MA-2245'] },
  healthCoverage: { title: 'Health coverage and Medicare', summary: 'Medicare, employer coverage, other insurance, and access to job-based health coverage.', policy: ['DMA-5202-A', 'Third-party coverage'] },
  pregnancy: { title: 'Pregnancy information', summary: 'Expected delivery date and number of expected children for a person requesting pregnancy coverage.', policy: ['MA-3240'] },
  fosterCare: { title: 'Foster care history', summary: 'Age, state, and Medicaid status when foster care ended, plus adoption or expanded foster-care information when relevant.', policy: ['MA-3233', 'MA-3234'] },
  disability: { title: 'Age, blindness, or disability pathway', summary: 'SSI status, disability determination status, blindness, work activity, and whether help with a disability application is needed.', policy: ['MA-2000', 'MA-2525', 'MA-2531'] },
  medicare: { title: 'Medicare Savings Program', summary: 'Medicare entitlement, premiums, and information needed to evaluate QMB, SLMB, or Qualifying Individual coverage.', policy: ['MA-2130', 'MA-2140', 'MA-2160'] },
  livingArrangement: { title: 'Living arrangement', summary: 'Home, facility, hospital, adult care home, or other setting; admission dates; spouse at home; and household support.', policy: ['MA-2510', 'MA-3360'] },
  longTermCare: { title: 'Long-term services and supports', summary: 'Requested setting or in-home service, level-of-care status, facility information, community spouse details, and prior coverage months.', policy: ['MA-2270', 'MA-2231', 'MA-3322 / MA-3325'] },
  fl2: { title: 'Level of care and FL-2', summary: 'Facility or in-home setting, FL-2 availability and date, recommended level of care, medical signer, and facility status.', policy: ['SA-3100 VII', 'SA-3110', 'FL-2 requirements'] },
  authorizedRepresentative: { title: 'Authorized representative', summary: 'Whether the applicant wants a person or organization authorized to act on the application and the scope of that authority.', policy: ['DHB-5202C-ia'] },
  additionalSupport: { title: 'Additional support and community referrals', summary: 'Whether help beyond Medicaid is needed, requested services, urgency, preferred follow-up, and permission for MMS to coordinate.', policy: ['MMS service coordination — not an eligibility factor'] },
  retroactive: { title: 'Past medical bills', summary: 'Whether coverage is requested for eligible months before the application month and the related information.', policy: ['DHB-5202E-ia'] },
  documents: { title: 'Possible supporting information', summary: 'A tailored checklist of information that may help DSS process the application. A person may still apply when some documents are unavailable.', policy: ['NC Medicaid application instructions'] }
};

const commonMagi = ['applicant', 'residency', 'citizenship', 'household', 'income', 'healthCoverage', 'authorizedRepresentative', 'additionalSupport', 'retroactive', 'documents'];
const commonAdult = ['applicant', 'residency', 'citizenship', 'income', 'resources', 'healthCoverage', 'livingArrangement', 'authorizedRepresentative', 'additionalSupport', 'retroactive', 'documents'];
const institutional = [...commonAdult, 'transfers', 'longTermCare'];
const magiForms = ['dhb5200', 'dhb5201', 'appendixA', 'appendixB', 'appendixC', 'appendixE', 'epass', 'dssDirectory'];
const adultForms = ['dhb5200', 'dhb5201', 'appendixA', 'appendixB', 'appendixC', 'appendixD', 'appendixE', 'epass', 'dssDirectory'];
const ltcForms = [...adultForms, 'dhb5203'];

export const medicaidPrograms = [
  { id: 'expansion_adult', group: 'Family and MAGI pathways', title: 'Medicaid Expansion Adult', audience: 'Adults generally ages 19–64 who are not enrolled in Medicare.', manualRefs: ['MA-3236', 'MA-3306'], manualIds: ['ma3236', 'ma3200'], formIds: magiForms, sources: ['eligibility', 'familyManual', 'magiLimits'], sections: commonMagi },
  { id: 'infants_children', group: 'Family and MAGI pathways', title: 'Infants and Children', audience: 'Children and young people who may qualify under a child coverage group.', manualRefs: ['MA-3230', 'MA-3200'], manualIds: ['ma3230', 'ma3200'], formIds: magiForms, sources: ['familyManual', 'magiLimits'], sections: commonMagi },
  { id: 'pregnancy', group: 'Family and MAGI pathways', title: 'Pregnancy Coverage', audience: 'A pregnant person applying for pregnancy-related Medicaid coverage.', manualRefs: ['MA-3240'], manualIds: ['ma3240', 'ma3200'], formIds: magiForms, sources: ['familyManual', 'magiLimits'], sections: [...commonMagi, 'pregnancy'] },
  { id: 'caretaker', group: 'Family and MAGI pathways', title: 'Caretaker Relative or Kinship', audience: 'A parent or qualifying caretaker relative living with a dependent child.', manualRefs: ['MA-3235'], manualIds: ['ma3235', 'ma3200'], formIds: magiForms, sources: ['familyManual', 'magiLimits'], sections: commonMagi },
  { id: 'former_foster', group: 'Family and MAGI pathways', title: 'Former or Current Foster Care', audience: 'People whose current or former foster-care status may create a Medicaid pathway.', manualRefs: ['MA-3233', 'MA-3234'], manualIds: ['ma3233', 'ma3234', 'ma3200'], formIds: magiForms, sources: ['familyManual'], sections: [...commonMagi, 'fosterCare'] },
  { id: 'family_planning', group: 'Family and MAGI pathways', title: 'Family Planning Program', audience: 'People seeking limited family-planning coverage.', manualRefs: ['MA-3265'], manualIds: ['ma3265', 'ma3200'], formIds: magiForms, sources: ['familyManual', 'magiLimits'], sections: commonMagi },
  { id: 'breast_cervical', group: 'Family and MAGI pathways', title: 'Breast and Cervical Cancer Medicaid', audience: 'People screened through an eligible program who need treatment for breast or cervical cancer.', manualRefs: ['MA-3250'], manualIds: ['ma3250'], formIds: ['bcccpReferral', 'dhb5079', 'dhb5081', 'appendixC', 'dssDirectory'], sources: ['familyManual'], sections: commonMagi },
  { id: 'aged_blind_disabled', group: 'Adult and Non-MAGI pathways', title: 'Aged, Blind, or Disabled Medicaid', audience: 'People applying based on age, blindness, disability, SSI-related rules, or medically needy coverage.', manualRefs: ['MA-2000', 'MA-2300'], manualIds: ['ma2000', 'ma2300'], formIds: adultForms, sources: ['adultManual', 'nonMagiLimits'], sections: [...commonAdult, 'disability'] },
  { id: 'medicare_savings', group: 'Adult and Non-MAGI pathways', title: 'Medicare Savings Programs', audience: 'Medicare beneficiaries seeking help with Medicare premiums or cost sharing.', manualRefs: ['MA-2130', 'MA-2140', 'MA-2160'], manualIds: ['ma2130', 'ma2140', 'ma2160', 'ma2300'], formIds: adultForms, sources: ['adultManual', 'nonMagiLimits'], sections: [...commonAdult, 'medicare'] },
  { id: 'working_disabled', group: 'Adult and Non-MAGI pathways', title: 'Health Coverage for Workers with Disabilities', audience: 'Working people with disabilities who may qualify under HCWD rules.', manualRefs: ['MA-2180'], manualIds: ['ma2180', 'ma2300'], formIds: [...adultForms, 'hcwdRelease'], sources: ['adultManual', 'nonMagiLimits'], sections: [...commonAdult, 'disability'] },
  { id: 'long_term_care', group: 'Long-term services and supports', title: 'Nursing Facility or Institutional Long-Term Care', audience: 'People requesting Medicaid payment for nursing-facility or other qualifying institutional care.', manualRefs: ['MA-2270', 'MA-2240–2245'], manualIds: ['ma2270', 'ma2300'], formIds: ltcForms, sources: ['adultManual', 'nonMagiLimits'], sections: institutional },
  { id: 'cap', group: 'Long-term services and supports', title: 'Community Alternatives Program (CAP)', audience: 'People seeking a CAP waiver pathway for qualifying community-based services.', manualRefs: ['MA-2280'], manualIds: ['ma2280', 'ma2300'], formIds: [...ltcForms, 'capReferral'], sources: ['adultManual', 'nonMagiLimits'], sections: institutional },
  { id: 'pace', group: 'Long-term services and supports', title: 'Program of All-Inclusive Care for the Elderly (PACE)', audience: 'People being evaluated for Medicaid eligibility connected to PACE enrollment.', manualRefs: ['MA-2275'], manualIds: ['ma2275', 'ma2300'], formIds: [...ltcForms, 'paceProgram', 'dhb5166'], sources: ['adultManual', 'nonMagiLimits'], sections: institutional },
  { id: 'innovations', group: 'Long-term services and supports', title: 'NC Innovations Waiver', audience: 'People with intellectual or developmental disabilities pursuing the Innovations waiver pathway.', manualRefs: ['MA-2282'], manualIds: ['ma2282', 'ma2300'], formIds: [...ltcForms, 'innovationsEntry'], sources: ['adultManual', 'nonMagiLimits'], sections: [...institutional, 'disability'] },
  { id: 'tbi', group: 'Long-term services and supports', title: 'Traumatic Brain Injury Waiver', audience: 'People pursuing the NC TBI waiver Medicaid eligibility pathway.', manualRefs: ['MA-2283'], manualIds: ['ma2283', 'ma2300'], formIds: [...ltcForms, 'tbiEntry'], sources: ['adultManual', 'nonMagiLimits'], sections: [...institutional, 'disability'] },
  { id: 'special_assistance_facility', group: 'Related NCDHHS assistance pathways', title: 'State/County Special Assistance in a Facility', audience: 'Older adults or adults with disabilities seeking Special Assistance connected to an approved adult care setting.', manualRefs: ['SA-3100', 'SA-3110', 'SA-3200'], manualIds: ['saManual'], formIds: ['dss8190', 'fl2', 'appendixC', 'dssDirectory'], sources: ['specialAssistance', 'nonMagiLimits'], sections: [...commonAdult, 'disability', 'fl2'] },
  { id: 'special_assistance_in_home', group: 'Related NCDHHS assistance pathways', title: 'Special Assistance In-Home', audience: 'Older adults or adults with disabilities seeking Special Assistance while living at home.', manualRefs: ['SA-3100', 'SA-3110', 'SAIH Manual'], manualIds: ['saManual', 'saihManual'], formIds: ['dss8190', 'dss0031', 'fl2', 'appendixC', 'dssDirectory'], sources: ['specialAssistance', 'specialAssistanceInHome', 'nonMagiLimits'], sections: [...commonAdult, 'disability', 'fl2'] }
];

export function getProgram(programId) {
  return medicaidPrograms.find(program => program.id === programId) || null;
}

export function getProgramSections(programId) {
  const program = getProgram(programId);
  return program ? [...new Set(program.sections)].map(sectionId => ({ id: sectionId, ...intakeSections[sectionId] })) : [];
}

export function getProgramSources(programId) {
  const program = getProgram(programId);
  return program ? [...new Set(['apply', 'dhbForms', ...program.sources])].map(sourceId => ({ id: sourceId, ...policySources[sourceId] })) : [];
}

export function getProgramManuals(programId) {
  const program = getProgram(programId);
  return program ? [...new Set(program.manualIds)].map(id => manualsById.get(id)).filter(Boolean) : [];
}

export function getProgramForms(programId) {
  const program = getProgram(programId);
  return program ? [...new Set(program.formIds)].map(id => formsById.get(id)).filter(Boolean) : [];
}
