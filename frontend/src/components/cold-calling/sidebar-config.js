import { LayoutDashboard, PhoneCall } from 'lucide-react';
import { COLD_CALLING_HOME_PATH, COLD_CALLING_LEADS_PATH } from '../../lib/coldCallingWorkspace';

/** Everything a Cold Calling user can navigate to. Add Phase 3 destinations here, nowhere else. */
export const coldCallingNavItems = [
  { section: 'COLD CALLING', path: COLD_CALLING_HOME_PATH, label: 'Dashboard', icon: LayoutDashboard },
  { section: 'COLD CALLING', path: COLD_CALLING_LEADS_PATH, label: 'My Leads', icon: PhoneCall },
];
