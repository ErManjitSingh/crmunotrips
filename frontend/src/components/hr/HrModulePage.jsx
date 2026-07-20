import HrComingSoon from './HrComingSoon';

const MODULES = {
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
