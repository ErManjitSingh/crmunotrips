import HrComingSoon from './HrComingSoon';

const MODULES = {
  payroll: {
    title: 'Payroll',
    description: 'Monthly salary runs, payslips, PF/ESIC and deductions',
    features: ['Salary processing', 'Payslip PDF + email', 'Tax & PF', 'Advances & loans'],
  },
  'salary-structure': {
    title: 'Salary Structure',
    description: 'Basic, HRA, allowances and component templates',
    features: ['Component library', 'Grade-wise structures', 'Revisions'],
  },
  incentives: {
    title: 'Incentives',
    description: 'Sales incentives, bonuses and commissions',
    features: ['Sales incentive plans', 'Bonus cycles', 'Approvals'],
  },
  performance: {
    title: 'Performance',
    description: 'Reviews, KPIs, feedback and promotion insights',
    features: ['Monthly / quarterly reviews', 'KPI tracking', '360 feedback'],
  },
  recruitment: {
    title: 'Recruitment',
    description: 'Hiring pipeline from application to offer',
    features: ['Candidate pipeline', 'Resume bank', 'Offer letters'],
  },
  'job-openings': {
    title: 'Job Openings',
    description: 'Publish and manage open positions',
    features: ['Job posts', 'Hiring managers', 'Headcount plans'],
  },
  interviews: {
    title: 'Interviews',
    description: 'Schedule rounds and capture interviewer feedback',
    features: ['Interview calendar', 'Scorecards', 'Feedback forms'],
  },
  assets: {
    title: 'Assets',
    description: 'Assign laptops, SIMs, ID cards and track returns',
    features: ['Asset inventory', 'Assignment history', 'Lost / return'],
  },
  documents: {
    title: 'Documents',
    description: 'Aadhaar, PAN, offers, slips and expiry reminders',
    features: ['Multi-upload', 'Preview', 'Expiry alerts'],
  },
  expenses: {
    title: 'Expenses',
    description: 'Travel, hotel, fuel claims with approval flow',
    features: ['Receipt upload', 'Approvals', 'Reimbursement status'],
  },
  events: {
    title: 'Events',
    description: 'Office events, celebrations and townhalls',
    features: ['Event calendar', 'RSVPs', 'Gallery'],
  },
  training: {
    title: 'Training',
    description: 'Courses, assessments and completion tracking',
    features: ['Course catalog', 'Certificates', 'Progress %'],
  },
  exit: {
    title: 'Exit Management',
    description: 'Resignation, clearance, settlement and letters',
    features: ['Notice period', 'Asset clearance', 'Relieving letter'],
  },
  reports: {
    title: 'HR Reports',
    description: 'Attendance, salary, attrition and hiring analytics',
    features: ['Export Excel/PDF', 'Department filters', 'Trends'],
  },
  settings: {
    title: 'HR Settings',
    description: 'Working days, leave rules, payroll and notifications',
    features: ['Office timings', 'Leave policies', 'Email templates'],
  },
};

export default function HrModulePage({ moduleKey }) {
  const cfg = MODULES[moduleKey] || { title: 'HR Module', description: '', features: [] };
  return <HrComingSoon title={cfg.title} description={cfg.description} features={cfg.features} />;
}
