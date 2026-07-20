import HrComingSoon from './HrComingSoon';

const MODULES = {
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
