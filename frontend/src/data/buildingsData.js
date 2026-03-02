// Buildings data extracted from app.js buildingsDatabase
export const buildingsDatabase = {
  'main-building':     { name: 'Main Building',     category: 'academic',  description: 'Heart of IITB\'s academic and administrative operations.', departments: ['Director\'s Office','Dean Academic Affairs','Academic Section','Registrar'], timings: '8:00 AM – 6:00 PM (Mon-Fri)', contact: '022-2576-4994', features: ['Conference Rooms','Auditorium','AC'] },
  'central-library':   { name: 'Central Library',   category: 'academic',  description: 'Over 4 lakh books, e-journals and digital resources.', departments: ['Reading Hall','Reference','Digital Library'], timings: '8 AM – 2 AM (24/7 exams)', contact: '022-2576-7096', capacity: '1000+ seats', features: ['24x7 Reading Room','Wi-Fi','Group Study Rooms'] },
  'lt-hall':           { name: 'Lecture Theatre',   category: 'academic',  description: 'Large lecture halls with AV equipment.', departments: ['LT 101-105','Tutorial Rooms'], timings: '8 AM – 6 PM', capacity: '300 seats per LT', features: ['Projectors','Audio','AC'] },
  'som':               { name: 'School of Management', category: 'academic', description: 'Premier management school offering MBA and PhD.', departments: ['MBA','Executive Education','Research'], timings: '8 AM – 8 PM', contact: '022-2576-7700', features: ['Case Study Rooms','Computer Labs','Cafeteria'] },
  'idc':               { name: 'Industrial Design Centre (IDC)', category: 'academic', description: 'India\'s premier design school.', departments: ['Product Design','Visual Communication','Animation','Interaction Design'], timings: '9 AM – 6 PM', contact: '022-2576-7801', features: ['Design Studios','Workshops','Fabrication Labs'] },
  'hospital':          { name: 'Hospital',           category: 'facility',  description: 'Campus health center for students and staff.', departments: ['General Physician','Dental','Pathology','Emergency'], timings: '24/7 Emergency, 9 AM – 5 PM OPD', contact: '022-2576-7777', features: ['Emergency','Ambulance','Pharmacy','X-Ray'] },
  'sports-ground':     { name: 'Sports Ground',     category: 'facility',  description: 'Main sports complex for football, cricket and athletics.', departments: ['Football','Cricket','Athletics'], timings: '6 AM – 10 PM', features: ['Floodlights','Spectator Stand'] },
  'gymkhana':          { name: 'Gymkhana',           category: 'facility',  description: 'Sports and recreation center.', departments: ['Gymnasium','Courts','Swimming Pool'], timings: '6 AM – 10 PM', features: ['Pool','Badminton','TT','Gym'] },
  'convocation-hall':  { name: 'Convocation Hall',  category: 'admin',     description: 'Large auditorium for ceremonies and events.', capacity: '2000+', timings: 'Event-based', features: ['Stage','AV System','AC'] },
  'ncair':             { name: 'NCAIR',              category: 'admin',     description: 'National Centre for Aerospace Innovation and Research.', departments: ['Aerospace Research','Testing Labs'], features: ['Wind Tunnel'] },
  'sameer':            { name: 'SAMEER',             category: 'admin',     description: 'Society for Applied Microwave Electronics Engineering & Research.', departments: ['Microwave Research'], features: ['Research Labs'] },
  'drdo':              { name: 'DRDO Complex',       category: 'admin',     description: 'Defence Research and Development Organisation.', features: ['Restricted Access'] },
  'post-office':       { name: 'Post Office',        category: 'facility',  description: 'Campus post office for mail and couriers.', timings: '9 AM – 5 PM (Mon-Sat)', features: ['Mail','Speed Post','Courier'] },
  'market-gate':       { name: 'Market Gate',        category: 'facility',  description: 'Campus market with shops and ATMs.', timings: '24/7', features: ['Food Stalls','Shops','ATMs','Bus Stop'] },
  'power-house':       { name: 'Power House',        category: 'facility',  description: 'Campus power generation center.', features: ['Restricted'] },
  'boat-house':        { name: 'Boat House',         category: 'recreational', description: 'Boating on Powai Lake.', timings: '4 PM – 7 PM weekends', features: ['Rowing','Kayaking','Lake View'] },
  'temple':            { name: 'Temple',             category: 'recreational', description: 'Hindu temple on campus.', timings: '6 AM – 8 PM', features: ['Daily Aarti','Festivals'] },
  'campus-school':     { name: 'Campus School',      category: 'academic',  description: 'School for IIT Bombay staff and faculty children.', timings: '8 AM – 3 PM', features: ['KG to 12th'] },
};

export const hostelData = {
  'hostel-12':    { name: 'Hostel 12',   category: 'hostel', description: 'Student residential facility.', capacity: '300 students', features: ['Mess','Common Room','Sports'], timings: '24/7', contact: 'Warden' },
  'hostel-13':    { name: 'Hostel 13',   category: 'hostel', description: 'Student residential facility.', capacity: '320 students', features: ['Mess','Library','Common Room'], timings: '24/7', contact: 'Warden' },
  'hostel-14':    { name: 'Hostel 14',   category: 'hostel', description: 'Student residential facility.', capacity: '350 students', features: ['Mess','Gym','Reading Room'], timings: '24/7', contact: 'Warden' },
  'hostel-17':    { name: 'Hostel 17',   category: 'hostel', description: 'Student residential facility.', capacity: '340 students', features: ['Mess','Gym'], timings: '24/7', contact: 'Warden' },
  'hostel-18':   { name: 'Hostel 18',  category: 'hostel', description: 'Student residential facility.', capacity: '400 students', features: ['Mess','Gym','Common Room'], timings: '24/7', contact: 'Warden' },
  'tansa-house': { name: 'Tansa House', category: 'hostel', description: 'Large hostel with modern amenities.', capacity: '450 students', features: ['Mess','Gym','Library','Common Room'], timings: '24/7', contact: 'Warden' },
};
