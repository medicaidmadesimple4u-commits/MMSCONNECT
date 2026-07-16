export const policyRelease = {
  version: '2026.1',
  reviewedOn: 'July 16, 2026',
  jurisdiction: 'North Carolina',
  notice: 'This guide organizes information for an application. NC Medicaid and the county Department of Social Services make all eligibility decisions.'
};

export const policySources = {
  apply: {
    title: 'How to Apply for NC Medicaid',
    url: 'https://medicaid.ncdhhs.gov/apply'
  },
  eligibility: {
    title: 'NC Medicaid Eligibility',
    url: 'https://medicaid.ncdhhs.gov/eligibility'
  },
  familyManual: {
    title: "Family and Children’s Medicaid policies and manuals",
    url: 'https://policies.ncdhhs.gov/divisional-a-m/health-benefits-nc-medicaid/family-and-childrens-medicaid/fcm-policies-manuals/'
  },
  adultManual: {
    title: 'Adult Medicaid policies and manuals',
    url: 'https://policies.ncdhhs.gov/divisional-a-m/health-benefits-nc-medicaid/adult-medicaid/'
  },
  magiLimits: {
    title: '2026 MAGI Medicaid and Medicaid Expansion income limits',
    url: 'https://policies.ncdhhs.gov/document/2026-magi-medicaid-medicaid-expansion-income-limits/'
  },
  nonMagiLimits: {
    title: '2026 Non-MAGI Medicaid income and reserve limits',
    url: 'https://policies.ncdhhs.gov/document/2026-non-magi-medicaid-income-reserve-limits/'
  },
  specialAssistance: {
    title: 'NCDHHS Special Assistance policies and manuals',
    url: 'https://policies.ncdhhs.gov/divisional-n-z/social-services/special-assistance/'
  },
  specialAssistanceInHome: {
    title: 'Special Assistance In-Home Program Manual',
    url: 'https://policies.ncdhhs.gov/document/special-assistance-in-home-program-manual/'
  }
};

export const dssForms = [
  { title: 'Full NC Medicaid Application (DHB-5200)', url: 'https://policies.ncdhhs.gov/wp-content/uploads/dhb-5200-ia-9-2020.pdf' },
  { title: 'Single Adult Short Form (DHB-5201-ia)', url: 'https://policies.ncdhhs.gov/wp-content/uploads/DHB-5201-ia.pdf' },
  { title: 'Health Coverage from Jobs — Appendix A', url: 'https://policies.ncdhhs.gov/wp-content/uploads/dma-5202A-ia.pdf' },
  { title: 'Authorized Representative — Appendix C', url: 'https://policies.ncdhhs.gov/wp-content/uploads/Appendix-C_10-2022.pdf' },
  { title: 'Income and Resources — Appendix D', url: 'https://policies.ncdhhs.gov/wp-content/uploads/dma-5202D-ia.pdf' },
  { title: 'Past Medical Bills — Appendix E', url: 'https://policies.ncdhhs.gov/wp-content/uploads/Appendix-E-9-2021.pdf' },
  { title: 'North Carolina Local DSS Directory', url: 'https://www.ncdhhs.gov/divisions/social-services/local-dss-directory' },
  { title: 'Apply Online through ePASS', url: 'https://epass.nc.gov/' }
];

const formReferenceLinks = {
  'NC Medicaid application': dssForms[0].url,
  'NC Medicaid application instructions': policySources.apply.url,
  'DMA-5202-A': dssForms[2].url,
  'DHB-5202C-ia': dssForms[3].url,
  'DMA-5202D-ia': dssForms[4].url,
  'DHB-5202E-ia': dssForms[5].url
};

export function getPolicyReferenceUrl(reference) {
  if (formReferenceLinks[reference]) return formReferenceLinks[reference];
  if (reference.startsWith('SA-') || reference.includes('FL-2')) return policySources.specialAssistance.url;
  if (reference.startsWith('MA-3') || reference.includes('MAGI') || reference.includes('Third-party')) return policySources.familyManual.url;
  if (reference.startsWith('MA-2')) return policySources.adultManual.url;
  return policySources.apply.url;
}

export const intakeSections = {
  applicant: {
    title: 'Applicant information',
    summary: 'Legal name, date of birth, contact information, preferred language, and the people requesting coverage.',
    policy: ['NC Medicaid application', 'MA-3200 / MA-2300']
  },
  residency: {
    title: 'North Carolina residency',
    summary: 'Current home and mailing address, county, temporary absence, and available proof of North Carolina residence.',
    policy: ['MA-3335 / MA-2220', 'MA-3340 / MA-2221']
  },
  citizenship: {
    title: 'Citizenship or immigration status',
    summary: 'Status only for each person applying, Social Security number or application status when applicable, and available identity evidence.',
    policy: ['MA-3330–3332', 'MA-2504–2506']
  },
  household: {
    title: 'Household and tax relationships',
    summary: 'Household members, spouses, children, tax filers, dependents, and who is applying for coverage.',
    policy: ['MA-3306', 'MAGI household composition']
  },
  income: {
    title: 'Income',
    summary: 'Employment, self-employment, benefits, other income, frequency, and available verification for relevant household members.',
    policy: ['MA-3300 / MA-3306', 'MA-2250']
  },
  resources: {
    title: 'Resources',
    summary: 'Accounts, real property, vehicles, trusts, life insurance, burial arrangements, and other countable or excluded resources.',
    policy: ['MA-2230', 'DMA-5202D-ia']
  },
  transfers: {
    title: 'Transfers and property history',
    summary: 'Transfers, gifts, sales below value, trusts, annuities, and home equity information when institutional or waiver services are requested.',
    policy: ['MA-2240', 'MA-2242', 'MA-2245']
  },
  healthCoverage: {
    title: 'Health coverage and Medicare',
    summary: 'Medicare, employer coverage, other insurance, and access to job-based health coverage.',
    policy: ['DMA-5202-A', 'Third-party coverage']
  },
  pregnancy: {
    title: 'Pregnancy information',
    summary: 'Expected delivery date and number of expected children for a person requesting pregnancy coverage.',
    policy: ['MA-3240', 'MA-3245']
  },
  fosterCare: {
    title: 'Foster care history',
    summary: 'Age, state, and Medicaid status when foster care ended, plus adoption or expanded foster-care information when relevant.',
    policy: ['MA-3231–3234']
  },
  disability: {
    title: 'Age, blindness, or disability pathway',
    summary: 'SSI status, disability determination status, blindness, work activity, and whether help with a disability application is needed.',
    policy: ['MA-2000', 'MA-2525', 'MA-2531']
  },
  medicare: {
    title: 'Medicare Savings Program',
    summary: 'Medicare entitlement, premiums, and information needed to evaluate QMB, SLMB, or Qualifying Individual coverage.',
    policy: ['MA-2130', 'MA-2140', 'MA-2160']
  },
  livingArrangement: {
    title: 'Living arrangement',
    summary: 'Home, facility, hospital, adult care home, or other setting; admission dates; spouse at home; and household support.',
    policy: ['MA-2510', 'MA-3360']
  },
  longTermCare: {
    title: 'Long-term services and supports',
    summary: 'Requested setting or in-home service, level-of-care status, facility information, community spouse details, and prior coverage months.',
    policy: ['MA-2270', 'MA-2231', 'MA-3322 / MA-3325']
  },
  fl2: {
    title: 'Level of care and FL-2',
    summary: 'Facility or in-home setting, FL-2 availability and date, recommended level of care, medical signer, facility status, and special-care-unit information when applicable.',
    policy: ['SA-3100 VII', 'SA-3110', 'FL-2 requirements']
  },
  authorizedRepresentative: {
    title: 'Authorized representative',
    summary: 'Whether the applicant wants a person or organization authorized to act on the application and the scope of that authority.',
    policy: ['DHB-5202C-ia']
  },
  retroactive: {
    title: 'Past medical bills',
    summary: 'Whether coverage is requested for eligible months before the application month and the related household and financial information.',
    policy: ['DHB-5202E-ia']
  },
  documents: {
    title: 'Possible supporting information',
    summary: 'A tailored checklist of information that may help DSS process the application. The applicant may still apply when some documents are unavailable.',
    policy: ['NC Medicaid application instructions']
  }
};

const commonMagi = ['applicant', 'residency', 'citizenship', 'household', 'income', 'healthCoverage', 'authorizedRepresentative', 'retroactive', 'documents'];
const commonAdult = ['applicant', 'residency', 'citizenship', 'income', 'resources', 'healthCoverage', 'livingArrangement', 'authorizedRepresentative', 'retroactive', 'documents'];
const institutional = [...commonAdult, 'transfers', 'longTermCare'];

export const medicaidPrograms = [
  {
    id: 'expansion_adult', group: 'Family and MAGI pathways', title: 'Medicaid Expansion Adult',
    audience: 'Adults generally ages 19–64 who are not enrolled in Medicare.',
    manualRefs: ['MA-3306', 'MA-3321'], sources: ['eligibility', 'familyManual', 'magiLimits'], sections: commonMagi
  },
  {
    id: 'infants_children', group: 'Family and MAGI pathways', title: 'Infants and Children',
    audience: 'Children and young people who may qualify under a child coverage group.',
    manualRefs: ['MA-3230', 'MA-3306', 'MA-3321'], sources: ['familyManual', 'magiLimits'], sections: commonMagi
  },
  {
    id: 'pregnancy', group: 'Family and MAGI pathways', title: 'Pregnancy Coverage',
    audience: 'A pregnant person applying for pregnancy-related Medicaid coverage.',
    manualRefs: ['MA-3240', 'MA-3245', 'MA-3246'], sources: ['familyManual', 'magiLimits'], sections: [...commonMagi, 'pregnancy']
  },
  {
    id: 'caretaker', group: 'Family and MAGI pathways', title: 'Caretaker Relative or Kinship',
    audience: 'A parent or qualifying caretaker relative living with a dependent child.',
    manualRefs: ['MA-3235', 'MA-3306'], sources: ['familyManual', 'magiLimits'], sections: commonMagi
  },
  {
    id: 'former_foster', group: 'Family and MAGI pathways', title: 'Former or Current Foster Care',
    audience: 'People whose current or former foster-care status may create a Medicaid pathway.',
    manualRefs: ['MA-3232', 'MA-3233', 'MA-3234'], sources: ['familyManual'], sections: [...commonMagi, 'fosterCare']
  },
  {
    id: 'family_planning', group: 'Family and MAGI pathways', title: 'Family Planning Program',
    audience: 'People seeking limited family-planning coverage.',
    manualRefs: ['MA-3265', 'MA-2170'], sources: ['familyManual', 'adultManual', 'magiLimits'], sections: commonMagi
  },
  {
    id: 'breast_cervical', group: 'Family and MAGI pathways', title: 'Breast and Cervical Cancer Medicaid',
    audience: 'People screened through an eligible program who need treatment for breast or cervical cancer.',
    manualRefs: ['MA-3250'], sources: ['familyManual'], sections: commonMagi
  },
  {
    id: 'aged_blind_disabled', group: 'Adult and Non-MAGI pathways', title: 'Aged, Blind, or Disabled Medicaid',
    audience: 'People applying based on age, blindness, disability, SSI-related rules, or medically needy coverage.',
    manualRefs: ['MA-2000', 'MA-2100–2120', 'MA-2525', 'MA-2531'], sources: ['adultManual', 'nonMagiLimits'], sections: [...commonAdult, 'disability']
  },
  {
    id: 'medicare_savings', group: 'Adult and Non-MAGI pathways', title: 'Medicare Savings Programs',
    audience: 'Medicare beneficiaries seeking help with Medicare premiums or cost sharing.',
    manualRefs: ['MA-2130', 'MA-2140', 'MA-2160'], sources: ['adultManual', 'nonMagiLimits'], sections: [...commonAdult, 'medicare']
  },
  {
    id: 'working_disabled', group: 'Adult and Non-MAGI pathways', title: 'Health Coverage for Workers with Disabilities',
    audience: 'Working people with disabilities who may qualify under HCWD rules.',
    manualRefs: ['MA-2150', 'MA-2180'], sources: ['adultManual', 'nonMagiLimits'], sections: [...commonAdult, 'disability']
  },
  {
    id: 'long_term_care', group: 'Long-term services and supports', title: 'Nursing Facility or Institutional Long-Term Care',
    audience: 'People requesting Medicaid payment for nursing-facility or other qualifying institutional care.',
    manualRefs: ['MA-2270', 'MA-2231', 'MA-2240–2245'], sources: ['adultManual', 'nonMagiLimits'], sections: institutional
  },
  {
    id: 'cap', group: 'Long-term services and supports', title: 'Community Alternatives Program (CAP)',
    audience: 'People seeking a CAP waiver pathway for qualifying community-based services.',
    manualRefs: ['MA-2280', 'MA-3260'], sources: ['adultManual', 'familyManual', 'nonMagiLimits'], sections: institutional
  },
  {
    id: 'pace', group: 'Long-term services and supports', title: 'Program of All-Inclusive Care for the Elderly (PACE)',
    audience: 'People being evaluated for Medicaid eligibility connected to PACE enrollment.',
    manualRefs: ['MA-2275', 'MA-3270'], sources: ['adultManual', 'familyManual', 'nonMagiLimits'], sections: institutional
  },
  {
    id: 'innovations', group: 'Long-term services and supports', title: 'NC Innovations Waiver',
    audience: 'People with intellectual or developmental disabilities pursuing the Innovations waiver pathway.',
    manualRefs: ['MA-2282'], sources: ['adultManual', 'nonMagiLimits'], sections: [...institutional, 'disability']
  },
  {
    id: 'tbi', group: 'Long-term services and supports', title: 'Traumatic Brain Injury Waiver',
    audience: 'People pursuing the NC TBI waiver Medicaid eligibility pathway.',
    manualRefs: ['MA-2283'], sources: ['adultManual', 'nonMagiLimits'], sections: [...institutional, 'disability']
  },
  {
    id: 'special_assistance_facility', group: 'Related NCDHHS assistance pathways', title: 'State/County Special Assistance in a Facility',
    audience: 'Older adults or adults with disabilities seeking Special Assistance connected to an approved adult care setting.',
    manualRefs: ['SA-3100', 'SA-3110', 'SA-3200'], sources: ['specialAssistance', 'adultManual', 'nonMagiLimits'], sections: [...commonAdult, 'disability', 'fl2']
  },
  {
    id: 'special_assistance_in_home', group: 'Related NCDHHS assistance pathways', title: 'Special Assistance In-Home',
    audience: 'Older adults or adults with disabilities seeking Special Assistance while living at home.',
    manualRefs: ['SA-3100', 'SA-3110', 'SA-5200'], sources: ['specialAssistance', 'specialAssistanceInHome', 'adultManual', 'nonMagiLimits'], sections: [...commonAdult, 'disability', 'fl2']
  }
];

export function getProgram(programId) {
  return medicaidPrograms.find(program => program.id === programId) || null;
}

export function getProgramSections(programId) {
  const program = getProgram(programId);
  if (!program) return [];
  return [...new Set(program.sections)].map(sectionId => ({ id: sectionId, ...intakeSections[sectionId] }));
}

export function getProgramSources(programId) {
  const program = getProgram(programId);
  if (!program) return [];
  return [...new Set(['apply', ...program.sources])].map(sourceId => ({ id: sourceId, ...policySources[sourceId] }));
}
