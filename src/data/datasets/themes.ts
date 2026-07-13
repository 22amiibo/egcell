import type { DatasetTheme } from "@/domain/datasets/datasetTypes";

/**
 * Themes are pure content: headers and value pools. They may change what a table says, never how
 * a challenge is validated. Every theme carries all eight roles so any template can use any theme,
 * and name pools hold at least 24 entries so names stay unique at the largest difficulty.
 */

const PEOPLE = [
  "Alice", "Bruno", "Chidi", "Dara", "Eli", "Farah", "Gus", "Hana", "Ivan", "Jia",
  "Kofi", "Lena", "Marc", "Nia", "Omar", "Pia", "Quinn", "Rosa", "Sam", "Tara",
  "Uma", "Vik", "Wes", "Xena", "Yara", "Zane",
] as const;

const VENDORS = [
  "Acme Supplies", "Brightline", "Cobalt Print", "Dunmore Media", "Everfield", "Fulcrum Labs",
  "Glasswing", "Harbor Freight Co", "Ironvale", "Junction Foods", "Kestrel Air", "Lumen Works",
  "Meridian Legal", "Northgate IT", "Orchard Web", "Pillar Events", "Quartz Data", "Redline Auto",
  "Silverbirch", "Trellis HR", "Umber Design", "Vantage Travel", "Westbrook Cafe", "Yellowstone Ads",
] as const;

const PROJECTS = [
  "Apollo", "Beacon", "Cascade", "Drift", "Ember", "Falcon", "Granite", "Horizon", "Ivory", "Jetstream",
  "Krakatoa", "Lighthouse", "Meridian", "Nimbus", "Onyx", "Pinnacle", "Quasar", "Redwood", "Summit",
  "Tundra", "Umbra", "Vertex", "Wildfire", "Zephyr",
] as const;

const COMPANIES = [
  "Acme Corp", "Blue Peak", "Cobalt Labs", "Delta Freight", "Eastlake Co", "Fernwood", "Gable & Sons",
  "Highrise Media", "Inland Foods", "Jetty Software", "Kilnworks", "Lakeshore Bank", "Mosaic Health",
  "Northwind", "Oakum Partners", "Prairie Goods", "Quill & Page", "Riverbend", "Stonebridge",
  "Tidewater", "Union Metrics", "Vista Retail", "Wexford Group", "Zenith Tools",
] as const;

const NOTES = [
  "Follow up", "Needs review", "On track", "Waiting", "Escalated", "See email", "OK", "Check twice",
] as const;

export const salesPipelineTheme: DatasetTheme = {
  id: "sales-pipeline",
  label: "Sales pipeline",
  columns: [
    { role: "category", header: "Region", type: "text", values: ["East", "West", "North", "South", "Central"] },
    { role: "name", header: "Rep", type: "text", values: PEOPLE },
    { role: "amount", header: "Revenue", type: "number", numberFormat: "currency", range: [40_000, 250_000], confusable: "Revenue LY" },
    { role: "count", header: "Units", type: "number", range: [40, 900], confusable: "Units LY" },
    { role: "rate", header: "Margin", type: "number", numberFormat: "percent", range: [5, 95], confusable: "Margin LY" },
    { role: "status", header: "Status", type: "text", values: ["Complete", "Pending", "At Risk"] },
    { role: "date", header: "Close Date", type: "date", numberFormat: "date" },
    { role: "note", header: "Notes", type: "text", values: NOTES },
  ],
};

export const expensesTheme: DatasetTheme = {
  id: "expenses",
  label: "Expenses",
  columns: [
    { role: "category", header: "Department", type: "text", values: ["Marketing", "Ops", "Sales", "Finance", "IT", "HR"] },
    { role: "name", header: "Vendor", type: "text", values: VENDORS },
    { role: "amount", header: "Spend", type: "number", numberFormat: "currency", range: [500, 90_000], confusable: "Spend LY" },
    { role: "count", header: "Items", type: "number", range: [1, 400], confusable: "Items LY" },
    { role: "rate", header: "Reimbursed", type: "number", numberFormat: "percent", range: [5, 95], confusable: "Reimbursed LY" },
    { role: "status", header: "Status", type: "text", values: ["Approved", "Submitted", "Rejected"] },
    { role: "date", header: "Posted", type: "date", numberFormat: "date" },
    { role: "note", header: "Memo", type: "text", values: NOTES },
  ],
};

export const projectsTheme: DatasetTheme = {
  id: "projects",
  label: "Projects",
  columns: [
    { role: "category", header: "Team", type: "text", values: ["Core", "Platform", "Growth", "Infra", "Design"] },
    { role: "name", header: "Project", type: "text", values: PROJECTS },
    { role: "amount", header: "Budget", type: "number", numberFormat: "currency", range: [10_000, 500_000], confusable: "Budget LY" },
    { role: "count", header: "Tasks", type: "number", range: [3, 120], confusable: "Tasks Done" },
    { role: "rate", header: "Progress", type: "number", numberFormat: "percent", range: [5, 95], confusable: "Progress Q1" },
    { role: "status", header: "Status", type: "text", values: ["Active", "Done", "Blocked"] },
    { role: "date", header: "Due", type: "date", numberFormat: "date" },
    { role: "note", header: "Owner Notes", type: "text", values: NOTES },
  ],
};

export const customersTheme: DatasetTheme = {
  id: "customers",
  label: "Customers",
  columns: [
    { role: "category", header: "Segment", type: "text", values: ["SMB", "Mid-Market", "Enterprise", "Startup"] },
    { role: "name", header: "Customer", type: "text", values: COMPANIES },
    { role: "amount", header: "ARR", type: "number", numberFormat: "currency", range: [1_000, 300_000], confusable: "ARR LY" },
    { role: "count", header: "Seats", type: "number", range: [1, 500], confusable: "Seats LY" },
    { role: "rate", header: "Renewal", type: "number", numberFormat: "percent", range: [5, 95], confusable: "Renewal LY" },
    { role: "status", header: "Tier", type: "text", values: ["Gold", "Silver", "Bronze"] },
    { role: "date", header: "Signed", type: "date", numberFormat: "date" },
    { role: "note", header: "CSM Notes", type: "text", values: NOTES },
  ],
};

export const DATASET_THEMES: DatasetTheme[] = [
  salesPipelineTheme,
  expensesTheme,
  projectsTheme,
  customersTheme,
];
