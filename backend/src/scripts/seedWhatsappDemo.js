/**
 * Seed 10 demo WhatsApp leads with sample conversation threads.
 * Run: npm run seed:whatsapp-demo
 * Safe to re-run — skips leads that already exist by demo phone number.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
// Prefer live app DB when seeding on VPS (PM2/app.unotrips.com)
if (!process.env.MONGO_URI || /testing_unotrips_crm/i.test(process.env.MONGO_URI)) {
  process.env.MONGO_URI = process.env.APP_MONGO_URI || 'mongodb://127.0.0.1:27017/app_unotrips_crm';
}
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Lead = require('../models/Lead');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const WhatsAppConversation = require('../models/WhatsAppConversation');

const DEMO_PHONE_PREFIX = '+91 99000 000';

const DEMO_LEADS = [
  {
    phoneSuffix: '01',
    name: 'Rahul Sharma',
    destination: 'Manali',
    city: 'Delhi',
    status: 'new',
    travelers: 4,
    budget: 45000,
    threads: [
      { direction: 'incoming', text: 'Hi, Manali 4N/5D package ka rate kya hai?', hoursAgo: 48 },
      { direction: 'incoming', text: '2 adults 2 kids, June end travel', hoursAgo: 47, status: 'read' },
    ],
  },
  {
    phoneSuffix: '02',
    name: 'Priya Verma',
    destination: 'Goa',
    city: 'Mumbai',
    status: 'contacted',
    travelers: 2,
    budget: 35000,
    threads: [
      { direction: 'incoming', text: 'Goa honeymoon package chahiye', hoursAgo: 36 },
      { direction: 'outgoing', text: 'Namaste Priya ji! Beach resort + flight options share kar raha hoon.', hoursAgo: 35 },
      { direction: 'incoming', text: 'Budget 35k tak hai, 5 din', hoursAgo: 34 },
    ],
  },
  {
    phoneSuffix: '03',
    name: 'Amit Kumar',
    destination: 'Dubai',
    city: 'Chandigarh',
    status: 'follow_up',
    travelers: 3,
    budget: 120000,
    threads: [
      { direction: 'incoming', text: 'Dubai family trip July me plan kar rahe hain', hoursAgo: 72 },
      { direction: 'outgoing', text: 'Amit ji, 5N Dubai with visa assistance — quotation bhej di hai email par.', hoursAgo: 70 },
      { direction: 'incoming', text: 'WhatsApp par bhi PDF bhej do please', hoursAgo: 68 },
    ],
  },
  {
    phoneSuffix: '04',
    name: 'Sneha Patel',
    destination: 'Kerala',
    city: 'Ahmedabad',
    status: 'quotation_sent',
    travelers: 5,
    budget: 55000,
    threads: [
      { direction: 'incoming', text: 'Munnar Alleppey package rate?', hoursAgo: 24 },
      { direction: 'outgoing', text: 'Sneha ji, houseboat + hill station combo ₹52,000 per person approx.', hoursAgo: 22 },
      { direction: 'incoming', text: 'Houseboat AC room chahiye', hoursAgo: 20, status: 'read' },
    ],
  },
  {
    phoneSuffix: '05',
    name: 'Vikram Singh',
    destination: 'Shimla',
    city: 'Patiala',
    status: 'new',
    travelers: 6,
    budget: 40000,
    threads: [
      { direction: 'incoming', text: 'Shimla Kufri tour group ke liye 6 log', hoursAgo: 12 },
      { direction: 'incoming', text: 'Tempo traveller included hai?', hoursAgo: 11 },
    ],
  },
  {
    phoneSuffix: '06',
    name: 'Anjali Reddy',
    destination: 'Thailand',
    city: 'Hyderabad',
    status: 'contacted',
    travelers: 2,
    budget: 90000,
    threads: [
      { direction: 'incoming', text: 'Bangkok Pattaya 6 days couple package', hoursAgo: 96 },
      { direction: 'outgoing', text: 'Anjali ji, flights + 4* hotel options ready hain. Call karein?', hoursAgo: 94 },
    ],
  },
  {
    phoneSuffix: '07',
    name: 'Rohit Mehta',
    destination: 'Ladakh',
    city: 'Surat',
    status: 'follow_up',
    travelers: 4,
    budget: 75000,
    threads: [
      { direction: 'incoming', text: 'Leh Ladakh bike trip possible hai?', hoursAgo: 60 },
      { direction: 'outgoing', text: 'Rohit ji, bike + SUV both options available. July-Aug best season.', hoursAgo: 58 },
      { direction: 'incoming', text: 'SUV better rahega, kids bhi hain', hoursAgo: 56 },
      { direction: 'outgoing', text: 'Noted! Updated itinerary bhej raha hoon.', hoursAgo: 55 },
    ],
  },
  {
    phoneSuffix: '08',
    name: 'Kavita Nair',
    destination: 'Kashmir',
    city: 'Pune',
    status: 'new',
    travelers: 3,
    budget: 50000,
    threads: [
      { direction: 'incoming', text: 'Srinagar Gulmarg package December me', hoursAgo: 8 },
    ],
  },
  {
    phoneSuffix: '09',
    name: 'Deepak Joshi',
    destination: 'Rajasthan',
    city: 'Jaipur',
    status: 'contacted',
    travelers: 8,
    budget: 65000,
    threads: [
      { direction: 'incoming', text: 'Jaipur Jodhpur Udaipur 7 days family tour', hoursAgo: 40 },
      { direction: 'outgoing', text: 'Deepak ji, golden triangle extension ke saath best rate mil jayega.', hoursAgo: 38 },
      { direction: 'incoming', text: 'Fort hotels prefer karenge', hoursAgo: 36, status: 'read' },
    ],
  },
  {
    phoneSuffix: '10',
    name: 'Pooja Gupta',
    destination: 'Singapore',
    city: 'Noida',
    status: 'quotation_sent',
    travelers: 4,
    budget: 150000,
    threads: [
      { direction: 'incoming', text: 'Singapore Malaysia combo 8 days', hoursAgo: 18 },
      { direction: 'outgoing', text: 'Pooja ji, Universal Studios + city tour included quotation shared.', hoursAgo: 16 },
      { direction: 'incoming', text: 'Visa process kitna time lagega?', hoursAgo: 14 },
      { direction: 'outgoing', text: 'Usually 5-7 working days. Documents list bhej di hai.', hoursAgo: 13 },
    ],
  },
];

function hoursAgoDate(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function seedWhatsappDemo() {
  await connectDB();

  const admin =
    (await User.findOne({ role: 'admin' }).select('_id branchId').lean()) ||
    (await User.findOne().select('_id branchId').lean());
  if (!admin) {
    console.error('No user found. Run seed first.');
    process.exit(1);
  }

  let branchId = admin.branchId;
  if (!branchId) {
    const branch = await Branch.findOne({ status: 'active' }).sort({ createdAt: 1 }).select('_id').lean();
    branchId = branch?._id;
  }
  if (!branchId) {
    console.error('No branch found.');
    process.exit(1);
  }

  const executives = await User.find({ role: 'sales_executive', branchId })
    .select('_id name')
    .limit(5)
    .lean();

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < DEMO_LEADS.length; i += 1) {
    const demo = DEMO_LEADS[i];
    const phone = `${DEMO_PHONE_PREFIX}${demo.phoneSuffix}`;

    const existing = await Lead.findOne({ phone }).select('_id').lean();
    if (existing) {
      skipped += 1;
      console.log(`Skip (exists): ${demo.name} — ${phone}`);
      continue;
    }

    const assignedTo = executives.length ? executives[i % executives.length]._id : null;
    const travelDate = new Date();
    travelDate.setDate(travelDate.getDate() + 20 + i * 3);

    const lastThread = demo.threads[demo.threads.length - 1];
    const lastContactedAt = hoursAgoDate(lastThread.hoursAgo);

    const lead = await Lead.create({
      name: demo.name,
      phone,
      whatsapp: phone,
      email: `${demo.name.toLowerCase().replace(/\s+/g, '.')}@demo.wa`,
      destination: demo.destination,
      city: demo.city,
      branchId,
      status: demo.status,
      source: 'whatsapp',
      sourceLabel: 'WhatsApp',
      channel: 'whatsapp',
      travelers: demo.travelers,
      adults: Math.max(1, demo.travelers - 1),
      children: demo.travelers > 2 ? 1 : 0,
      budget: demo.budget,
      budgetRange: 'custom',
      leadScore: i % 3 === 0 ? 'high' : 'medium',
      temperature: i % 4 === 0 ? 'hot' : 'warm',
      priority: i % 5 === 0 ? 'high' : 'medium',
      createdBy: admin._id,
      assignedTo,
      assigneeRole: assignedTo ? 'sales_executive' : undefined,
      lastContactMethod: 'whatsapp',
      lastContactedAt,
      firstContactAt: hoursAgoDate(demo.threads[0].hoursAgo),
      travelDate,
      notes: 'Demo WhatsApp lead — safe to delete',
    });

    const phone10 = phone.replace(/\D/g, '').slice(-10);
    const conversation = await WhatsAppConversation.findOneAndUpdate(
      { phone: phone10 },
      {
        $set: {
          phone: phone10,
          waId: `91${phone10}`,
          profileName: demo.name,
          lead: lead._id,
          lastMessageText: lastThread.text,
          lastMessageAt: lastContactedAt,
          lastDirection: lastThread.direction,
          unreadCount: lastThread.direction === 'incoming' ? 1 : 0,
          branchId,
          isArchived: false,
        },
      },
      { upsert: true, new: true }
    );

    const messages = demo.threads.map((t) => ({
      conversation: conversation._id,
      lead: lead._id,
      fromPhone: phone10,
      direction: t.direction,
      type: 'text',
      text: t.text,
      status: t.status || (t.direction === 'incoming' ? 'received' : 'read'),
      timestamp: hoursAgoDate(t.hoursAgo),
      sentBy: t.direction === 'outgoing' ? (assignedTo || admin._id) : undefined,
    }));

    await WhatsAppMessage.insertMany(messages);
    created += 1;
    console.log(`Created: ${demo.name} (${phone}) — ${messages.length} messages`);
  }

  const totalWa = await Lead.countDocuments({ channel: 'whatsapp' });
  console.log(`\nDone. Created ${created}, skipped ${skipped}. Total WhatsApp leads: ${totalWa}`);
  process.exit(0);
}

seedWhatsappDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
