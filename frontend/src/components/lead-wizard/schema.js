import { z } from 'zod';

const phoneSchema = z.string().refine((val) => {
  const digits = String(val || '').replace(/\D/g, '');
  return digits.length === 10 && /^[6-9]/.test(digits);
}, 'Enter valid 10-digit Indian mobile number');

const optionalEmail = z.union([
  z.literal(''),
  z.string().email('Invalid email address'),
]);

/** Coerce form strings / empty / NaN into numbers for Zod v4 */
function numberField(min, message) {
  return z.preprocess(
    (val) => {
      if (val === '' || val == null) return undefined;
      const n = typeof val === 'number' ? val : Number(val);
      return Number.isNaN(n) ? undefined : n;
    },
    z.number({ error: message }).min(min, message)
  );
}

export const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: phoneSchema,
  whatsapp: z.string().optional().or(z.literal('')),
  email: optionalEmail,
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
});

export const travelFieldsSchema = z.object({
  leadType: z.enum(['fit', 'group', 'corporate']).optional(),
  companyName: z.string().optional(),
  destination: z.string().min(2, 'Destination is required'),
  travelDate: z.string().min(1, 'Travel date is required'),
  returnDate: z.string().min(1, 'Return date is required'),
  adults: numberField(1, 'At least 1 adult required'),
  children: numberField(0, 'Children cannot be negative'),
  infants: numberField(0, 'Infants cannot be negative'),
});

export const travelSchema = travelFieldsSchema.refine(
  (d) => !d.travelDate || !d.returnDate || d.returnDate >= d.travelDate,
  { message: 'Return date must be on or after travel date', path: ['returnDate'] }
);

export const budgetSchema = z.object({
  budget: z.preprocess(
    (val) => {
      if (val === '' || val == null) return 0;
      const n = typeof val === 'number' ? val : Number(val);
      return Number.isNaN(n) ? 0 : n;
    },
    z.number().min(0).optional()
  ),
  hotelCategory: z.string().min(1, 'Select hotel category'),
  mealPreference: z.string().min(1, 'Select meal preference'),
  transportRequirement: z.string().min(1, 'Select transport requirement'),
  specialRequirements: z.string().optional(),
});

export const leadInfoSchema = z.object({
  leadSource: z.string().min(1, 'Select lead source'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  branchId: z.string().optional(),
});

export const assignmentSchema = z.object({
  assignedExecutive: z.string().min(1, 'Assign an executive'),
  assignedManager: z.string().min(1, 'Assign a manager'),
});

export const followUpSchema = z.object({
  followUpDate: z.string().min(1, 'Follow-up date is required'),
  followUpTime: z.string().min(1, 'Follow-up time is required'),
  followUpRemarks: z.string().min(3, 'Add follow-up remarks'),
});

export const fullWizardSchema = customerSchema
  .merge(travelFieldsSchema)
  .merge(budgetSchema)
  .merge(leadInfoSchema)
  .merge(assignmentSchema)
  .merge(followUpSchema)
  .refine(
    (d) => !d.travelDate || !d.returnDate || d.returnDate >= d.travelDate,
    { message: 'Return date must be on or after travel date', path: ['returnDate'] }
  );

export const stepSchemas = [
  customerSchema,
  travelSchema,
  budgetSchema,
  leadInfoSchema,
  assignmentSchema,
  followUpSchema,
  fullWizardSchema,
];

export const stepFields = [
  ['name', 'phone', 'whatsapp', 'email', 'city', 'state'],
  ['destination', 'travelDate', 'returnDate', 'adults', 'children', 'infants'],
  ['budget', 'hotelCategory', 'mealPreference', 'transportRequirement', 'specialRequirements'],
  ['leadSource', 'priority'],
  ['assignedExecutive', 'assignedManager'],
  ['followUpDate', 'followUpTime', 'followUpRemarks'],
  [
    'name', 'phone', 'whatsapp', 'email', 'city', 'state',
    'destination', 'travelDate', 'returnDate', 'adults', 'children', 'infants',
    'budget', 'hotelCategory', 'mealPreference', 'transportRequirement', 'specialRequirements',
    'leadSource', 'priority', 'branchId', 'assignedExecutive', 'assignedManager',
    'followUpDate', 'followUpTime', 'followUpRemarks',
  ],
];
