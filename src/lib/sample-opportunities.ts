/**
 * Sample opportunity seeds. Used to backfill the /opportunities page when
 * the live SAM.gov radar hasn't found ≥4 real matches yet (cold-start
 * accounts, transient SAM.gov outages, NAICS codes that get few weekly
 * notices). Goal: every visitor sees a populated pipeline so they can feel
 * what's on the other side of finishing CMMC L1 — never an empty state.
 *
 * These are realistic but synthetic. We label them "Sample" in the UI and
 * disable the SAM.gov link so users don't try to bid on them. They're
 * keyed by 3-digit NAICS sector with a generic fallback bank if nothing
 * matches.
 */

export type SampleOpportunity = {
  /** Stable id for React keys. Not a real SAM notice. */
  key: string;
  title: string;
  department: string;
  type: string;
  setAside: string;
  naicsCode: string;
  placeOfPerformance: string;
  /** One-sentence summary of what the agency wants. */
  summary: string;
  /** Days from "today" the response is due. */
  responseDeadlineInDays: number;
};

const GENERIC: SampleOpportunity[] = [
  {
    key: "sample-generic-1",
    title: "IT support services for regional field office",
    department: "Department of Veterans Affairs",
    type: "Solicitation",
    setAside: "Total Small Business",
    naicsCode: "541512",
    placeOfPerformance: "Atlanta, GA",
    summary:
      "Provide on-site and remote tier-1 / tier-2 helpdesk support, endpoint patching, and asset tracking for a 250-seat regional field office.",
    responseDeadlineInDays: 18,
  },
  {
    key: "sample-generic-2",
    title: "Cloud migration & FedRAMP-aligned hosting (12-month BPA)",
    department: "General Services Administration",
    type: "Combined Synopsis/Solicitation",
    setAside: "Total Small Business",
    naicsCode: "541512",
    placeOfPerformance: "Washington, DC",
    summary:
      "Migrate three legacy LOB applications into a FedRAMP Moderate environment and operate them under a 12-month BPA with monthly utilization reporting.",
    responseDeadlineInDays: 24,
  },
  {
    key: "sample-generic-3",
    title: "Cybersecurity assessment & POA&M support",
    department: "Department of the Air Force",
    type: "Sources Sought",
    setAside: "8(a) Sole Source",
    naicsCode: "541690",
    placeOfPerformance: "San Antonio, TX",
    summary:
      "Conduct a NIST 800-171 gap assessment across two program offices, deliver a POA&M, and support quarterly remediation reviews for 12 months.",
    responseDeadlineInDays: 9,
  },
  {
    key: "sample-generic-4",
    title: "Managed network & SD-WAN refresh",
    department: "Department of Homeland Security",
    type: "Solicitation",
    setAside: "Service-Disabled Veteran-Owned Small Business",
    naicsCode: "541512",
    placeOfPerformance: "Multiple CONUS locations",
    summary:
      "Refresh and operate the agency's branch SD-WAN fabric across 38 sites, including circuit aggregation, routing, and 24x7 NOC monitoring.",
    responseDeadlineInDays: 31,
  },
];

const SECTOR_SAMPLES: Record<string, SampleOpportunity[]> = {
  // 541 — Professional / scientific / technical services (heavy fed IT bucket)
  "541": [
    {
      key: "sample-541-1",
      title: "Software engineering support for mission planning system",
      department: "U.S. Army",
      type: "Solicitation",
      setAside: "Total Small Business",
      naicsCode: "541512",
      placeOfPerformance: "Aberdeen Proving Ground, MD",
      summary:
        "Provide a 6-person software engineering cell to maintain and extend a Java/Kotlin mission planning system; agile delivery on 2-week sprints.",
      responseDeadlineInDays: 21,
    },
    {
      key: "sample-541-2",
      title: "Data analytics & dashboarding (Power BI)",
      department: "Department of Health and Human Services",
      type: "Combined Synopsis/Solicitation",
      setAside: "Women-Owned Small Business",
      naicsCode: "541511",
      placeOfPerformance: "Rockville, MD",
      summary:
        "Build and maintain Power BI dashboards summarizing grant-disbursement KPIs for 14 program offices; weekly refresh cadence.",
      responseDeadlineInDays: 14,
    },
    {
      key: "sample-541-3",
      title: "FedRAMP audit & continuous monitoring support",
      department: "Department of Treasury",
      type: "Sources Sought",
      setAside: "Total Small Business",
      naicsCode: "541512",
      placeOfPerformance: "Washington, DC",
      summary:
        "Support an existing 3PAO with FedRAMP Moderate continuous monitoring artifact preparation, monthly POA&M updates, and annual reassessment.",
      responseDeadlineInDays: 10,
    },
    {
      key: "sample-541-4",
      title: "Zero-trust architecture roadmap",
      department: "U.S. Navy",
      type: "Solicitation",
      setAside: "8(a) Competitive",
      naicsCode: "541512",
      placeOfPerformance: "Norfolk, VA",
      summary:
        "Author a zero-trust target architecture aligned to DoD ZT Reference Architecture v2.0 and a 24-month implementation roadmap with cost estimates.",
      responseDeadlineInDays: 27,
    },
  ],
  // 236/237/238 — Construction
  "236": [
    {
      key: "sample-236-1",
      title: "Renovation of administrative office building",
      department: "U.S. Army Corps of Engineers",
      type: "Solicitation",
      setAside: "Total Small Business",
      naicsCode: "236220",
      placeOfPerformance: "Fort Bragg, NC",
      summary:
        "Renovate a 22,000 sq-ft single-story administrative building including HVAC replacement, interior fit-out, and ADA-compliance upgrades.",
      responseDeadlineInDays: 35,
    },
    {
      key: "sample-236-2",
      title: "New equipment storage facility",
      department: "Department of Veterans Affairs",
      type: "Combined Synopsis/Solicitation",
      setAside: "SDVOSB Set-Aside",
      naicsCode: "236220",
      placeOfPerformance: "Phoenix, AZ",
      summary:
        "Design-build a 6,500 sq-ft pre-engineered metal storage facility with sitework, utilities, and fire-suppression on an existing campus.",
      responseDeadlineInDays: 28,
    },
    {
      key: "sample-236-3",
      title: "Flooring replacement at federal courthouse",
      department: "General Services Administration",
      type: "Solicitation",
      setAside: "WOSB Set-Aside",
      naicsCode: "238330",
      placeOfPerformance: "Cleveland, OH",
      summary:
        "Demo and replace ~14,000 sq-ft of carpet tile and resilient flooring across three courthouse floors after-hours and on weekends.",
      responseDeadlineInDays: 17,
    },
    {
      key: "sample-236-4",
      title: "Electrical infrastructure upgrade",
      department: "Department of Energy",
      type: "Sources Sought",
      setAside: "8(a) Sole Source",
      naicsCode: "238210",
      placeOfPerformance: "Oak Ridge, TN",
      summary:
        "Upgrade primary switchgear and distribution panels at a research support facility; coordinate phased outages with on-site operations.",
      responseDeadlineInDays: 22,
    },
  ],
  // 561 — Admin & support / facilities / janitorial / security
  "561": [
    {
      key: "sample-561-1",
      title: "Janitorial services at federal courthouse",
      department: "General Services Administration",
      type: "Solicitation",
      setAside: "Total Small Business",
      naicsCode: "561720",
      placeOfPerformance: "Denver, CO",
      summary:
        "Provide nightly janitorial, weekly carpet care, and monthly high-dust services across 96,000 sq-ft of courthouse common and tenant space.",
      responseDeadlineInDays: 19,
    },
    {
      key: "sample-561-2",
      title: "Armed security guard services",
      department: "Federal Protective Service",
      type: "Solicitation",
      setAside: "SDVOSB Set-Aside",
      naicsCode: "561612",
      placeOfPerformance: "Houston, TX",
      summary:
        "Staff 4 armed PSO posts (24x7 coverage) at a federal building including X-ray screening, vehicle inspection, and incident response.",
      responseDeadlineInDays: 30,
    },
    {
      key: "sample-561-3",
      title: "Records-management & digitization support",
      department: "National Archives and Records Administration",
      type: "Combined Synopsis/Solicitation",
      setAside: "WOSB Set-Aside",
      naicsCode: "561410",
      placeOfPerformance: "College Park, MD",
      summary:
        "Inventory, prep, and digitize ~2,400 cubic feet of legacy paper records to PDF/A with NARA-compliant metadata tagging.",
      responseDeadlineInDays: 16,
    },
    {
      key: "sample-561-4",
      title: "Grounds maintenance multi-year contract",
      department: "Department of Veterans Affairs",
      type: "Solicitation",
      setAside: "SDVOSB Set-Aside",
      naicsCode: "561730",
      placeOfPerformance: "Tampa, FL",
      summary:
        "Provide grounds maintenance, irrigation upkeep, and seasonal landscape services across a 220-acre VA medical campus.",
      responseDeadlineInDays: 20,
    },
  ],
  // 332/333 — Manufacturing
  "332": [
    {
      key: "sample-332-1",
      title: "Custom metal fabrication for vehicle armoring kits",
      department: "U.S. Army",
      type: "Solicitation",
      setAside: "Total Small Business",
      naicsCode: "332999",
      placeOfPerformance: "Warren, MI",
      summary:
        "Fabricate and deliver 120 sets of CNC-machined steel armoring brackets per drawing package; first-article inspection required.",
      responseDeadlineInDays: 33,
    },
    {
      key: "sample-332-2",
      title: "Replacement parts for ground support equipment",
      department: "U.S. Air Force",
      type: "Combined Synopsis/Solicitation",
      setAside: "Total Small Business",
      naicsCode: "332710",
      placeOfPerformance: "Robins AFB, GA",
      summary:
        "Manufacture and supply 8 line items of precision-machined replacement parts for legacy GSE per supplied technical data package.",
      responseDeadlineInDays: 21,
    },
    {
      key: "sample-332-3",
      title: "Welded steel storage containers",
      department: "Defense Logistics Agency",
      type: "Solicitation",
      setAside: "8(a) Competitive",
      naicsCode: "332439",
      placeOfPerformance: "Various",
      summary:
        "Produce and deliver 60 welded steel containers (8x8x10) meeting MIL-spec corrosion and load requirements; staggered delivery over 9 months.",
      responseDeadlineInDays: 25,
    },
    {
      key: "sample-332-4",
      title: "Spare parts kits for tactical generators",
      department: "U.S. Marine Corps",
      type: "Sources Sought",
      setAside: "SDVOSB Set-Aside",
      naicsCode: "333611",
      placeOfPerformance: "Albany, GA",
      summary:
        "Assemble and ship 240 spare parts kits supporting tactical generator overhauls; bills of materials supplied at award.",
      responseDeadlineInDays: 14,
    },
  ],
  // 484 — Trucking & freight
  "484": [
    {
      key: "sample-484-1",
      title: "Less-than-truckload freight services",
      department: "Defense Logistics Agency",
      type: "Solicitation",
      setAside: "Total Small Business",
      naicsCode: "484121",
      placeOfPerformance: "Multiple CONUS lanes",
      summary:
        "Provide LTL freight services across 14 East Coast lanes with electronic BOL, tracking, and 99.5% on-time delivery SLA.",
      responseDeadlineInDays: 18,
    },
    {
      key: "sample-484-2",
      title: "Refrigerated trucking for medical supplies",
      department: "Department of Veterans Affairs",
      type: "Combined Synopsis/Solicitation",
      setAside: "WOSB Set-Aside",
      naicsCode: "484230",
      placeOfPerformance: "Mid-Atlantic Region",
      summary:
        "Operate temperature-controlled trucking from a regional VA distribution center to 8 medical centers with continuous temperature logging.",
      responseDeadlineInDays: 22,
    },
    {
      key: "sample-484-3",
      title: "Heavy-haul transportation services",
      department: "U.S. Army",
      type: "Solicitation",
      setAside: "SDVOSB Set-Aside",
      naicsCode: "484220",
      placeOfPerformance: "Fort Hood, TX",
      summary:
        "Provide heavy-haul transportation of tactical vehicles between depot and exercise sites; permitted oversize/overweight loads.",
      responseDeadlineInDays: 26,
    },
    {
      key: "sample-484-4",
      title: "Local cartage & delivery (10 vans)",
      department: "U.S. Postal Service",
      type: "Solicitation",
      setAside: "Total Small Business",
      naicsCode: "484110",
      placeOfPerformance: "Phoenix, AZ",
      summary:
        "Operate 10 cargo vans Mon–Sat covering 4 metro routes; CDL not required, 2-year base + 3 option years.",
      responseDeadlineInDays: 12,
    },
  ],
  // 621 — Health care services
  "621": [
    {
      key: "sample-621-1",
      title: "Mobile dental services contract",
      department: "Department of Veterans Affairs",
      type: "Solicitation",
      setAside: "Total Small Business",
      naicsCode: "621210",
      placeOfPerformance: "Multi-state (Region 5)",
      summary:
        "Operate two mobile dental units serving rural VA outreach clinics on a published quarterly schedule; full clinical staffing included.",
      responseDeadlineInDays: 23,
    },
    {
      key: "sample-621-2",
      title: "Telehealth platform support & on-call clinicians",
      department: "Indian Health Service",
      type: "Combined Synopsis/Solicitation",
      setAside: "8(a) Sole Source",
      naicsCode: "621399",
      placeOfPerformance: "Remote",
      summary:
        "Provide a HIPAA-compliant telehealth platform plus on-call licensed clinicians across primary care and behavioral health.",
      responseDeadlineInDays: 19,
    },
    {
      key: "sample-621-3",
      title: "Medical interpretation services",
      department: "Department of Veterans Affairs",
      type: "Solicitation",
      setAside: "WOSB Set-Aside",
      naicsCode: "621999",
      placeOfPerformance: "Various",
      summary:
        "Furnish on-demand medical interpretation in 30+ languages including ASL across 12 VA medical centers; <30s connect SLA.",
      responseDeadlineInDays: 15,
    },
    {
      key: "sample-621-4",
      title: "Physical therapy staffing",
      department: "U.S. Army",
      type: "Sources Sought",
      setAside: "SDVOSB Set-Aside",
      naicsCode: "621340",
      placeOfPerformance: "Fort Carson, CO",
      summary:
        "Provide 4 licensed physical therapists supporting a soldier rehabilitation clinic; full-time, 2-year base + 1 option year.",
      responseDeadlineInDays: 28,
    },
  ],
};

/**
 * Pick the best sample bank for the given NAICS list — first 3-digit
 * sector match wins. Falls back to the generic IT/professional bank
 * if nothing matches (also used when the org has no NAICS configured).
 */
export function pickSampleOpportunities(
  naicsCodes: string[],
): SampleOpportunity[] {
  for (const code of naicsCodes) {
    const sec = code.slice(0, 3);
    const bank = SECTOR_SAMPLES[sec];
    if (bank && bank.length > 0) return bank;
  }
  return GENERIC;
}
