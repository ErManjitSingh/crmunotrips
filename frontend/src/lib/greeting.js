import { useEffect, useState } from 'react';

export const UNO_FAMILY_GREETING = 'Smile! You are part of the UNO family.';

/** Fixed brand greeting for dashboards / login */
export function getTimeGreeting() {
  return UNO_FAMILY_GREETING;
}

/** Greeting that stays on the UNO family line (no time-of-day swap) */
export function useTimeGreeting() {
  const [greeting, setGreeting] = useState(() => getTimeGreeting());

  useEffect(() => {
    setGreeting(getTimeGreeting());
  }, []);

  return greeting;
}
