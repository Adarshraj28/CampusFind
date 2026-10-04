/* ============================================================
   CampusFind — seed.js
   Baseline dataset shipped with the app. All people, IDs,
   case numbers and addresses below are fictional.
   20 users · 15 lost reports · 15 found reports ·
   10 claims · 10 notifications · 10 audit events
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const iso = (daysAgo, hour, minute) => {
    const d = new Date(now - daysAgo * DAY);
    if (hour !== undefined) d.setHours(hour, minute || 0, 0, 0);
    return d.toISOString();
  };
  const dateOnly = (daysAgo) => iso(daysAgo).slice(0, 10);

  /* Simple one-way digest used by the browser-only build.
     Supabase Auth replaces this in production (see process.md). */
  function digestPassword(email, password) {
    const input = `${String(email).toLowerCase()}|${password}|campusfind-auth-v1`;
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    for (let i = 0; i < input.length; i += 1) {
      h1 = Math.imul(h1 ^ input.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + input.charCodeAt(i) * (i + 7), 2654435761) >>> 0;
    }
    return `cf1$${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
  }    const U = (id, name, email, collegeId, role, daysAgo, extra) => {
    const pw = (extra && extra.password) || (role === 'admin' ? 'Admin@123' : role === 'staff' ? 'Staff@123' : role === 'faculty' ? 'Faculty@123' : 'Student@123');
    const base = {
    id,
    name,
    email,
    collegeId,
    role,
    status: 'active',
    phone: '+91 98000 00000',
    department: role === 'admin' ? 'Campus Administration'
      : role === 'faculty' ? SCHOOLS.SCSE
        : role === 'staff' ? 'Campus Security'
          : 'B.Tech Computer Science & Engineering',
    passwordHash: digestPassword(email, pw),
    createdAt: iso(daysAgo, 9, 30),
    lastLogin: iso(Math.max(0, daysAgo - 1), 10, 15),
  };
    const patched = Object.assign({}, base, extra || {});
    delete patched.password;
    return patched;
  };

  function buildUsers() {
    const users = [
      U('u-student-1', 'Aarav Sharma', 'aarav.sharma@galgotiasuniversity.edu.in', roll(2024, 'SCSE', '101', 457), 'student', 210, { password: 'Student@123' }),
      U('u-staff-1', 'Neha Gupta', 'neha.gupta@galgotiasuniversity.edu.in', 'STSEC2019042', 'staff', 900, { password: 'Staff@123' }),
      U('u-admin-1', 'Dr. R. Menon', 'r.menon@galgotiasuniversity.edu.in', 'ADMN2015001', 'admin', 1400, { password: 'Admin@123' }),
      U('u-faculty-1', 'Prof. Kabir Rao', 'kabir.rao@galgotiasuniversity.edu.in', 'FASC2018088', 'faculty', 700, { password: 'Faculty@123' }),
      U('u-student-2', 'Diya Patel', 'diya.patel@galgotiasuniversity.edu.in', roll(2023, 'SCSE', '101', 512), 'student', 400),
      U('u-student-3', 'Rohan Verma', 'rohan.verma@galgotiasuniversity.edu.in', roll(2024, 'SCSE', '101', 619), 'student', 300),
      U('u-student-4', 'Ananya Iyer', 'ananya.iyer@galgotiasuniversity.edu.in', roll(2022, 'SCSE', '101', 208), 'student', 540),
      U('u-student-5', 'Kabir Singh', 'kabir.singh@galgotiasuniversity.edu.in', roll(2024, 'SCSE', '103', 774), 'student', 180),
      U('u-student-6', 'Meera Nair', 'meera.nair@galgotiasuniversity.edu.in', roll(2023, 'SBOM', '205', 341), 'student', 365),
      U('u-student-7', 'Aditya Kulkarni', 'aditya.k@galgotiasuniversity.edu.in', roll(2025, 'SCSE', '101', 903), 'student', 90),
      U('u-student-8', 'Sara Khan', 'sara.khan@galgotiasuniversity.edu.in', roll(2023, 'SBAS', '107', 288), 'student', 320),
      U('u-student-9', 'Vikram Reddy', 'vikram.r@galgotiasuniversity.edu.in', roll(2022, 'SCSE', '101', 155), 'student', 610),
      U('u-student-10', 'Ishita Bose', 'ishita.bose@galgotiasuniversity.edu.in', roll(2024, 'SBOM', '201', 632), 'student', 240),
      U('u-student-11', 'Arjun Nair', 'arjun.nair@galgotiasuniversity.edu.in', roll(2025, 'SCSE', '101', 117), 'student', 70),
      U('u-student-12', 'Tanvi Desai', 'tanvi.desai@galgotiasuniversity.edu.in', roll(2023, 'SLAS', '112', 409), 'student', 390),
      U('u-student-13', 'Zaid Ansari', 'zaid.ansari@galgotiasuniversity.edu.in', roll(2024, 'SCSE', '104', 826), 'student', 205),
      U('u-student-14', 'Nikita Joshi', 'nikita.joshi@galgotiasuniversity.edu.in', roll(2022, 'SBOM', '201', 573), 'student', 580),
      U('u-student-15', 'Farhan Sheikh', 'farhan.s@galgotiasuniversity.edu.in', roll(2025, 'SCSE', '102', 245), 'student', 55),
      U('u-student-16', 'Riya Malhotra', 'riya.malhotra@galgotiasuniversity.edu.in', roll(2023, 'SCSE', '103', 731), 'student', 350),
      U('u-staff-2', 'Prakash Yadav', 'prakash.yadav@galgotiasuniversity.edu.in', 'STSEC2021006', 'staff', 820),
    ];

    // Sample-account convention: student accounts use Student@123,
    // staff use Staff@123, faculty use Faculty@123, admin uses Admin@123.
    users[14].status = 'inactive';
    return users;
  }

  /* ============================================================
     Item photographs

     Each category has two illustrations in assets/items/ so
     two items of the same category do not look identical.
     They are shipped as files rather than generated at run
     time so a report always has a picture, even when the
     student who filed it uploaded none.
     ============================================================ */
  const photoFor = (category, seedValue) => {
    const slug = String(category || 'other').toLowerCase().replace(/[^a-z]/g, '') || 'other';
    const variant = (Number(seedValue) % 2) + 1;
    return `assets/items/${slug}-${variant}.svg`;
  };

  /* Both illustrations of the category, so the detail gallery has
     a second thumbnail to switch between. */
  const photoPair = (category, seedValue) => {
    const slug = String(category || 'other').toLowerCase().replace(/[^a-z]/g, '') || 'other';
    const first = (Number(String(seedValue).replace(/\D/g, '').slice(-3)) % 2) + 1;
    const second = first === 1 ? 2 : 1;
    return [`assets/items/${slug}-${first}.svg`, `assets/items/${slug}-${second}.svg`];
  };

  /* ============================================================
     Galgotias University roll numbers

     CampusFind accepts the university roll number format:

       24SCSE1010457
       |  |    |  |
       |  |    |  +-- serial (4 digits)
       |  |    +----- programme code (3 digits)
       |  +---------- school code (SCSE = Computing Science & Eng.)
       +------------- year of admission (2 digits)

     Staff and faculty carry an employee number in the same
     shape, prefixed ST/FA, e.g. STSEC2019042.
     ============================================================ */
  const SCHOOLS = {
    SCSE: 'School of Computing Science & Engineering',
    SBOM: 'School of Business & Organisation Management',
    SBAS: 'School of Basic & Applied Sciences',
    SEA:  'School of Engineering & Architecture',
    SLAS: 'School of Liberal Arts & Sciences',
  };

  /* Builds a roll number: admissionYear, school, programme, serial. */
  const roll = (year, school, programme, serial) =>
    `${String(year).slice(-2)}${school}${programme}${String(serial).padStart(4, '0')}`;

  /* ---------- Reports ---------- */
  const L = (id, ownerId, name, category, location, daysAgo, extra) => Object.assign({
    id,
    type: 'lost',
    ownerId,
    itemName: name,
    category,
    location,
    dateLost: dateOnly(daysAgo),
    timeLost: '16:30',
    color: 'Black',
    brand: 'Generic',
    model: '',
    description: '',
    features: '',
    images: photoPair(category, id),
    status: 'open',
    createdAt: iso(daysAgo, 17, 10),
    updatedAt: iso(daysAgo, 17, 10),
    custody: [{
      ts: iso(daysAgo, 17, 10), actor: 'System', action: 'Report submitted',
      location, description: 'Lost report registered in CampusFind.',
    }],
  }, extra || {});

  const F = (id, finderId, name, category, location, daysAgo, extra) => Object.assign({
    id,
    type: 'found',
    finderId,
    ownerId: finderId,
    itemName: name,
    category,
    location,
    dateFound: dateOnly(daysAgo),
    timeFound: '13:00',
    color: 'Black',
    brand: 'Generic',
    model: '',
    description: '',
    features: '',
    images: photoPair(category, id),
    status: 'available',
    storageStatus: 'With Finder',
    privateInfo: {},
    createdAt: iso(daysAgo, 14, 5),
    updatedAt: iso(daysAgo, 14, 5),
    custody: [{
      ts: iso(daysAgo, 14, 5), actor: 'System', action: 'Report submitted',
      location, description: 'Found report registered in CampusFind.',
    }],
  }, extra || {});

  function buildReports() {
    const lost = [
      L('LF-GU-2026-00101', 'u-student-1', 'Black Backpack', 'Bag', 'Central Library', 3, {
        color: 'Black', brand: 'Wildcraft', model: 'Hoodie 35L',
        description: 'Black Wildcraft backpack with a small blue keychain and two textbooks inside. One side pocket has a torn zip pull.',
        features: 'Blue star keychain, torn zip pull on side pocket',
        dateLost: dateOnly(3), timeLost: '17:40',
      }),
      L('LF-GU-2026-00102', 'u-student-1', 'Silver Laptop Charger', 'Electronics', 'Academic Block A', 9, {
        color: 'Silver', brand: 'Dell', model: '65W USB-C',
        description: 'Dell 65W USB-C charger with a white adapter and frayed cable near the connector.',
        features: 'Frayed cable near connector',
      }),
      L('LF-GU-2026-00103', 'u-student-2', 'Brown Leather Wallet', 'Wallet', 'Canteen', 2, {
        color: 'Brown', brand: 'Horizon',
        description: 'Brown leather bi-fold wallet containing student ID and a metro card. No cash inside.',
        features: 'Scratch on the front lower-right corner',
      }),
      L('LF-GU-2026-00104', 'u-student-3', 'Keys with Red Keychain', 'Keys', 'Hostel Block C', 5, {
        color: 'Silver', brand: 'Yale',
        description: 'Set of three hostel keys on a ring with a red rubber keychain shaped like a rocket.',
        features: 'Red rocket keychain',
      }),
      L('LF-GU-2026-00105', 'u-student-4', 'iPhone 14 (Blue)', 'Electronics', 'Sports Complex', 1, {
        color: 'Blue', brand: 'Apple', model: 'iPhone 14',
        description: 'Blue iPhone 14 in a transparent case with a cracked bottom-right corner of the case.',
        features: 'Cracked transparent case corner',
      }),
      L('LF-GU-2026-00106', 'u-faculty-1', 'Reading Glasses', 'Accessories', 'Auditorium', 7, {
        color: 'Black', brand: 'Titan',
        description: 'Black rectangular reading glasses in a hard grey case. Left temple has a small tape mark.',
        features: 'Tape mark on left temple',
      }),
      L('LF-GU-2026-00107', 'u-student-5', 'Grey Hoodie', 'Clothing', 'Gymnasium', 4, {
        color: 'Grey', brand: 'Nike',
        description: 'Grey Nike hoodie size M with the campus club logo stitched on the left chest.',
        features: 'Club logo on left chest',
      }),
      L('LF-GU-2026-00108', 'u-student-6', 'USB Drive 64GB', 'Electronics', 'Computer Lab 2', 6, {
        color: 'Black', brand: 'SanDisk', model: 'Cruzer Blade 64GB',
        description: 'Small black SanDisk 64GB USB drive with a silver carabiner clip attached.',
        features: 'Silver carabiner clip',
      }),
      L('LF-GU-2026-00109', 'u-student-7', 'Student ID Card', 'Documents', 'Registrar Office', 2, {
        color: 'White', brand: 'Campus ID',
        description: 'Student ID card in a blue lanyard with "Batch 2025" printed on it.',
        features: 'Blue Batch 2025 lanyard',
      }),
      L('LF-GU-2026-00110', 'u-student-8', 'Silver Ring', 'Jewellery', 'Central Library', 8, {
        color: 'Silver', brand: 'Generic',
        description: 'Thin silver ring with a small blue stone, found missing after a study session near the reading hall.',
        features: 'Small blue stone',
      }),
      L('LF-GU-2026-00111', 'u-student-9', 'Scientific Calculator', 'Electronics', 'Academic Block B', 11, {
        color: 'Grey', brand: 'Casio', model: 'fx-991EX',
        description: 'Casio fx-991EX scientific calculator with the owner initials "V.R." written on the back.',
        features: 'Initials V.R. on back cover',
      }),
      L('LF-GU-2026-00112', 'u-student-10', 'Blue Water Bottle', 'Accessories', 'Sports Complex', 3, {
        color: 'Blue', brand: 'Milton',
        description: 'Blue Milton steel water bottle with a sticker of a rocket on the body.',
        features: 'Rocket sticker',
      }),
      L('LF-GU-2026-00113', 'u-student-11', 'Prescription Document Set', 'Documents', 'Health Centre', 13, {
        color: 'White', brand: 'Generic',
        description: 'Envelope containing prescription papers and a pharmacy bill, addressed to campus health centre.',
        features: 'Sealed envelope marked "Health Centre"',
      }),
      L('LF-GU-2026-00114', 'u-student-13', 'Wireless Earbuds', 'Electronics', 'Canteen', 4, {
        color: 'White', brand: 'boAt', model: 'Airdopes 141',
        description: 'White boAt Airdopes case with a small scratch on the lid and a lanyard loop attached.',
        features: 'Scratch on lid, lanyard loop',
      }),
      L('LF-GU-2026-00115', 'u-student-16', 'Library Book: Operating Systems', 'Books', 'Central Library', 6, {
        color: 'White', brand: 'Galgotia Publications',
        description: 'Operating Systems textbook with handwritten notes on the first three chapters and a bus pass tucked inside.',
        features: 'Handwritten notes, bus pass tucked inside',
      }),
    ];

    const found = [
      F('FF-GU-2026-00121', 'u-student-5', 'Black Backpack', 'Bag', 'Central Library', 2, {
        color: 'Black', brand: 'Wildcraft', model: 'Hoodie 35L',
        description: 'Black Wildcraft backpack left on a reading hall desk. Contains two textbooks and a blue star keychain.',
        features: 'Blue star keychain, torn zip pull',
        storageStatus: 'Stored by Staff',
        privateInfo: {
          serial: 'WL-35L-77213', marks: 'Torn zip pull on side pocket',
          contents: 'Two textbooks, one notebook, blue star keychain', deviceId: '',
        },
      }),
      F('FF-GU-2026-00122', 'u-student-6', 'Brown Leather Wallet', 'Wallet', 'Canteen', 1, {
        color: 'Brown', brand: 'Horizon',
        description: 'Brown leather wallet found near the canteen payment counter.',
        features: 'Scratch on front lower-right corner',
        storageStatus: 'Handed to Security',
        privateInfo: {
          serial: '', marks: 'Scratch on lower-right corner',
          contents: 'Student ID (name hidden for verification), metro card, two photos', deviceId: '',
        },
      }),
      F('FF-GU-2026-00123', 'u-student-9', 'iPhone 14 (Blue)', 'Electronics', 'Sports Complex', 1, {
        color: 'Blue', brand: 'Apple', model: 'iPhone 14',
        description: 'Blue iPhone 14 found on the basketball court bench in a transparent case.',
        features: 'Cracked case bottom-right corner',
        storageStatus: 'Handed to Security',
        privateInfo: {
          serial: 'F17X-K2Q9L-IMEI-REDACTED', marks: 'Cracked transparent case corner',
          contents: 'None accessible (locked device)', deviceId: 'device-id-hidden',
        },
      }),
      F('FF-GU-2026-00124', 'u-staff-1', 'Keys with Red Keychain', 'Keys', 'Hostel Block C', 3, {
        color: 'Silver', brand: 'Yale',
        description: 'Three keys on a ring with a red rubber rocket keychain, handed over near hostel reception.',
        features: 'Red rocket keychain',
        storageStatus: 'Stored by Staff',
        privateInfo: { serial: '', marks: 'Worn keyring', contents: '3 keys (hostel block C)', deviceId: '' },
      }),
      F('FF-GU-2026-00125', 'u-student-10', 'Silver Laptop Charger', 'Electronics', 'Academic Block A', 5, {
        color: 'Silver', brand: 'Dell', model: '65W USB-C',
        description: 'Dell 65W USB-C charger found under a seminar hall seat.',
        features: 'Frayed cable near connector',
        storageStatus: 'With Finder',
        privateInfo: { serial: 'DL-65W-4419', marks: 'Frayed cable', contents: 'Adapter plus cable', deviceId: '' },
      }),
      F('FF-GU-2026-00126', 'u-staff-2', 'Grey Hoodie', 'Clothing', 'Gymnasium', 4, {
        color: 'Grey', brand: 'Nike',
        description: 'Grey Nike hoodie size M left in the gym changing room, club logo on the chest.',
        features: 'Club logo on left chest',
        storageStatus: 'Stored by Staff',
        privateInfo: { serial: '', marks: 'Small stain on right sleeve', contents: '', deviceId: '' },
      }),
      F('FF-GU-2026-00127', 'u-student-11', 'Student ID Card', 'Documents', 'Registrar Office', 2, {
        color: 'White', brand: 'Campus ID',
        description: 'Student ID card on a blue "Batch 2025" lanyard found at the registrar counter.',
        features: 'Blue Batch 2025 lanyard',
        storageStatus: 'Handed to Security',
        privateInfo: { serial: 'ID-STU-7741', marks: '', contents: 'ID card only', deviceId: '' },
      }),
      F('FF-GU-2026-00128', 'u-student-2', 'Wireless Earbuds', 'Electronics', 'Canteen', 3, {
        color: 'White', brand: 'boAt', model: 'Airdopes 141',
        description: 'White boAt earbuds case found on an outdoor canteen table, small scratch on the lid.',
        features: 'Scratch on lid, lanyard loop',
        storageStatus: 'With Finder',
        privateInfo: { serial: 'BT-141-88231', marks: 'Scratch on lid', contents: 'Earbuds inside', deviceId: '' },
      }),
      F('FF-GU-2026-00129', 'u-student-3', 'Scientific Calculator', 'Electronics', 'Academic Block B', 6, {
        color: 'Grey', brand: 'Casio', model: 'fx-991EX',
        description: 'Casio fx-991EX calculator found on a lecture hall desk after the last class.',
        features: 'Initials V.R. on back cover',
        storageStatus: 'Stored by Staff',
        privateInfo: { serial: 'CX-991-51127', marks: 'Initials V.R.', contents: '', deviceId: '' },
      }),
      F('FF-GU-2026-00130', 'u-student-8', 'Blue Water Bottle', 'Accessories', 'Sports Complex', 2, {
        color: 'Blue', brand: 'Milton',
        description: 'Blue Milton steel bottle with a rocket sticker, found near the tennis court.',
        features: 'Rocket sticker',
        storageStatus: 'With Finder',
        privateInfo: { serial: '', marks: 'Dent near base', contents: '', deviceId: '' },
      }),
      F('FF-GU-2026-00131', 'u-staff-1', 'Reading Glasses', 'Accessories', 'Auditorium', 5, {
        color: 'Black', brand: 'Titan',
        description: 'Black rectangular reading glasses in a grey case, left in row 4 of the auditorium.',
        features: 'Tape mark on left temple',
        storageStatus: 'Stored by Staff',
        privateInfo: { serial: '', marks: 'Tape mark on left temple', contents: 'Glasses plus case', deviceId: '' },
      }),
      F('FF-GU-2026-00132', 'u-student-14', 'USB Drive 64GB', 'Electronics', 'Computer Lab 2', 4, {
        color: 'Black', brand: 'SanDisk', model: 'Cruzer Blade 64GB',
        description: 'Black SanDisk 64GB USB drive with a silver carabiner left in lab workstation 12.',
        features: 'Silver carabiner clip',
        storageStatus: 'Stored by Staff',
        privateInfo: { serial: 'SD-64-30211', marks: '', contents: 'Owner data — access restricted', deviceId: '' },
      }),
      F('FF-GU-2026-00133', 'u-student-4', 'Silver Ring', 'Jewellery', 'Central Library', 6, {
        color: 'Silver', brand: 'Generic',
        description: 'Thin silver ring with a small blue stone handed in at the library help desk.',
        features: 'Small blue stone',
        storageStatus: 'Handed to Security',
        privateInfo: { serial: '', marks: 'Engraving inside band', contents: '', deviceId: '' },
      }),
      F('FF-GU-2026-00134', 'u-staff-2', 'Campus Bus Pass', 'Documents', 'Bus Stop', 8, {
        color: 'Blue', brand: 'Campus Transport',
        description: 'Semester bus pass in a plastic sleeve found at the main bus stop shelter.',
        features: 'Laminated sleeve',
        status: 'returned',
        storageStatus: 'Stored by Staff',
        privateInfo: { serial: 'PASS-2026-4419', marks: '', contents: 'Bus pass only', deviceId: '' },
      }),
      F('FF-GU-2026-00135', 'u-staff-1', 'Prescription Document Set', 'Documents', 'Health Centre', 9, {
        color: 'White', brand: 'Generic',
        description: 'Sealed envelope of prescription papers found on the health centre counter.',
        features: 'Envelope marked "Health Centre"',
        status: 'returned',
        storageStatus: 'Stored by Staff',
        privateInfo: { serial: '', marks: 'Sealed envelope', contents: 'Medical documents (confidential)', deviceId: '' },
      }),
    ];

    /* Attach a completed custody history to returned items */
    const returned1 = found.find((r) => r.id === 'FF-GU-2026-00134');
    returned1.custody = [
      { ts: iso(8, 14, 5), actor: 'Sana Ali (Staff)', action: 'Item reported', location: 'Bus Stop', description: 'Passenger handed the pass to campus staff.' },
      { ts: iso(8, 15, 0), actor: 'Sana Ali (Staff)', action: 'Item received', location: 'Security Desk', description: 'Item logged into the lost & found register.' },
      { ts: iso(8, 15, 10), actor: 'Prakash Yadav (Staff)', action: 'Item stored', location: 'Storage Rack B-2', description: 'Placed in secure storage.' },
      { ts: iso(7, 11, 0), actor: 'Ritika Sen (Student)', action: 'Claim submitted', location: 'Online', description: 'Ownership claim with verification answers.' },
      { ts: iso(7, 16, 30), actor: 'Dr. R. Menon (Admin)', action: 'Claim approved', location: 'Online', description: 'Answers matched the finder report.' },
      { ts: iso(6, 10, 15), actor: 'Prakash Yadav (Staff)', action: 'Item handed over', location: 'Security Desk', description: 'Released to owner after ID verification.' },
    ];
    returned1.returnedAt = iso(6, 10, 15);

    const returned2 = found.find((r) => r.id === 'FF-GU-2026-00135');
    returned2.custody = [
      { ts: iso(9, 12, 20), actor: 'Health Centre Desk', action: 'Item reported', location: 'Health Centre', description: 'Envelope left on the counter.' },
      { ts: iso(9, 12, 40), actor: 'Neha Gupta (Staff)', action: 'Item received', location: 'Health Centre', description: 'Countersigned with the doctor on duty.' },
      { ts: iso(9, 13, 0), actor: 'Neha Gupta (Staff)', action: 'Item stored', location: 'Storage Rack C-1', description: 'Confidential envelope sealed and stored.' },
      { ts: iso(8, 9, 30), actor: 'Prof. Kabir Rao (Faculty)', action: 'Claim submitted', location: 'Online', description: 'Owner identified contents without prompting.' },
      { ts: iso(8, 14, 0), actor: 'Dr. R. Menon (Admin)', action: 'Claim approved', location: 'Online', description: 'Verified against health centre records.' },
      { ts: iso(8, 17, 20), actor: 'Neha Gupta (Staff)', action: 'Item handed over', location: 'Health Centre', description: 'Returned directly to faculty member.' },
    ];
    returned2.returnedAt = iso(8, 17, 20);

    return lost.concat(found);
  }

  /* ---------- Claims ---------- */
  function buildClaims() {
    return [
      {
        id: 'CLM-GU-2026-00031',
        itemId: 'FF-GU-2026-00121',
        lostReportId: 'LF-GU-2026-00101',
        claimantId: 'u-student-1',
        matchScore: 91,
        status: 'UNDER_REVIEW',
        answers: {
          color: 'Black',
          brand: 'Wildcraft Hoodie 35L',
          unique: 'Blue star keychain on the zip, torn zip pull on side pocket',
          contents: 'Two textbooks, a notebook and a blue star keychain',
          damage: 'Zip pull on the side pocket is torn',
        },
        notes: [],
        timeline: [
          { step: 'Claim Submitted', status: 'done', ts: iso(1, 10, 10), actor: 'Aarav Sharma (Student)', note: 'Claim with 5 verification answers.' },
          { step: 'Under Review', status: 'current', ts: iso(1, 11, 5), actor: 'Neha Gupta (Staff)', note: 'Review started by campus staff.' },
        ],
        createdAt: iso(1, 10, 10),
        updatedAt: iso(1, 11, 5),
      },
      {
        id: 'CLM-GU-2026-00032',
        itemId: 'FF-GU-2026-00123',
        lostReportId: 'LF-GU-2026-00105',
        claimantId: 'u-student-4',
        matchScore: 94,
        status: 'PENDING',
        answers: {
          color: 'Blue',
          brand: 'Apple iPhone 14',
          unique: 'Transparent case with cracked bottom-right corner',
          contents: 'Lock screen shows a photo of my dog; emergency contacts enabled',
          damage: 'Cracked case corner, small scuff near charging port',
        },
        notes: [],
        timeline: [
          { step: 'Claim Submitted', status: 'current', ts: iso(0, 9, 45), actor: 'Ananya Iyer (Student)', note: 'Awaiting staff review.' },
        ],
        createdAt: iso(0, 9, 45),
        updatedAt: iso(0, 9, 45),
      },
      {
        id: 'CLM-GU-2026-00033',
        itemId: 'FF-GU-2026-00122',
        lostReportId: 'LF-GU-2026-00103',
        claimantId: 'u-student-2',
        matchScore: 89,
        status: 'APPROVED',
        answers: {
          color: 'Brown',
          brand: 'Horizon bi-fold',
          unique: 'Scratch on the front lower-right corner',
          contents: 'Student ID, metro card, two photos, no cash',
          damage: 'Scratch on lower-right corner',
        },
        notes: [{ ts: iso(0, 12, 0), actor: 'Dr. R. Menon (Admin)', text: 'Answers verified against finder statement. Pickup window: Security Desk, 10 AM–5 PM.' }],
        timeline: [
          { step: 'Claim Submitted', status: 'done', ts: iso(2, 9, 0), actor: 'Diya Patel (Student)', note: '' },
          { step: 'Under Review', status: 'done', ts: iso(2, 15, 30), actor: 'Neha Gupta (Staff)', note: 'Review started.' },
          { step: 'Verification', status: 'done', ts: iso(1, 11, 15), actor: 'Dr. R. Menon (Admin)', note: 'Photo evidence of scratch matches.' },
          { step: 'Approved', status: 'current', ts: iso(0, 12, 0), actor: 'Dr. R. Menon (Admin)', note: 'Ready for pickup scheduling.' },
        ],
        createdAt: iso(2, 9, 0),
        updatedAt: iso(0, 12, 0),
      },
      {
        id: 'CLM-GU-2026-00034',
        itemId: 'FF-GU-2026-00124',
        lostReportId: 'LF-GU-2026-00104',
        claimantId: 'u-student-3',
        matchScore: 96,
        status: 'PENDING',
        answers: {
          color: 'Silver with a red keychain',
          brand: 'Yale',
          unique: 'Red rubber rocket keychain on the ring',
          contents: 'Three hostel block C keys',
          damage: 'Keyring is slightly worn',
        },
        notes: [],
        timeline: [
          { step: 'Claim Submitted', status: 'current', ts: iso(0, 14, 20), actor: 'Rohan Verma (Student)', note: '' },
        ],
        createdAt: iso(0, 14, 20),
        updatedAt: iso(0, 14, 20),
      },
      {
        id: 'CLM-GU-2026-00035',
        itemId: 'FF-GU-2026-00129',
        lostReportId: 'LF-GU-2026-00111',
        claimantId: 'u-student-9',
        matchScore: 88,
        status: 'REJECTED',
        rejectionReason: 'Verification answers did not match the finder report: the owner initials and calculator model were both incorrect.',
        answers: {
          color: 'Grey',
          brand: 'Casio fx-991EX',
          unique: 'No distinctive marks',
          contents: '',
          damage: '',
        },
        notes: [{ ts: iso(1, 16, 45), actor: 'Dr. R. Menon (Admin)', text: 'Rejected: answers did not match. Claimant may re-file with correct details.' }],
        timeline: [
          { step: 'Claim Submitted', status: 'done', ts: iso(3, 10, 0), actor: 'Vikram Reddy (Student)', note: '' },
          { step: 'Under Review', status: 'done', ts: iso(3, 14, 12), actor: 'Prakash Yadav (Staff)', note: '' },
          { step: 'Rejected', status: 'failed', ts: iso(1, 16, 45), actor: 'Dr. R. Menon (Admin)', note: 'Answers did not match the finder report.' },
        ],
        createdAt: iso(3, 10, 0),
        updatedAt: iso(1, 16, 45),
      },
      {
        id: 'CLM-GU-2026-00036',
        itemId: 'FF-GU-2026-00128',
        lostReportId: 'LF-GU-2026-00114',
        claimantId: 'u-student-13',
        matchScore: 84,
        status: 'ITEM_RETURNED',
        answers: {
          color: 'White',
          brand: 'boAt Airdopes 141',
          unique: 'Small scratch on the lid and a lanyard loop',
          contents: 'Both earbuds plus a charging cable',
          damage: 'Scratch on the lid',
        },
        notes: [{ ts: iso(0, 10, 5), actor: 'Prakash Yadav (Staff)', text: 'Handed over at Security Desk after ID check.' }],
        timeline: [
          { step: 'Claim Submitted', status: 'done', ts: iso(4, 11, 0), actor: 'Zaid Ansari (Student)', note: '' },
          { step: 'Under Review', status: 'done', ts: iso(4, 16, 40), actor: 'Neha Gupta (Staff)', note: '' },
          { step: 'Verification', status: 'done', ts: iso(3, 10, 20), actor: 'Dr. R. Menon (Admin)', note: 'Serial number matched.' },
          { step: 'Approved', status: 'done', ts: iso(2, 12, 0), actor: 'Dr. R. Menon (Admin)', note: '' },
          { step: 'Pickup Scheduled', status: 'done', ts: iso(1, 9, 30), actor: 'Prakash Yadav (Staff)', note: 'Pickup slot booked for the next morning.' },
          { step: 'Item Returned', status: 'done', ts: iso(0, 10, 5), actor: 'Prakash Yadav (Staff)', note: 'Released after ID verification.' },
        ],
        createdAt: iso(4, 11, 0),
        updatedAt: iso(0, 10, 5),
      },
      {
        id: 'CLM-GU-2026-00037',
        itemId: 'FF-GU-2026-00126',
        lostReportId: 'LF-GU-2026-00107',
        claimantId: 'u-student-5',
        matchScore: 72,
        status: 'UNDER_REVIEW',
        answers: {
          color: 'Grey',
          brand: 'Nike',
          unique: 'Campus club logo stitched on the left chest',
          contents: 'Nothing in the pockets',
          damage: 'Small stain on the right sleeve',
        },
        notes: [{ ts: iso(0, 9, 0), actor: 'Neha Gupta (Staff)', text: 'Requested a photo of the claimant wearing the hoodie for comparison.' }],
        timeline: [
          { step: 'Claim Submitted', status: 'done', ts: iso(2, 13, 40), actor: 'Kabir Singh (Student)', note: '' },
          { step: 'Under Review', status: 'current', ts: iso(1, 9, 15), actor: 'Neha Gupta (Staff)', note: 'Additional evidence requested.' },
        ],
        createdAt: iso(2, 13, 40),
        updatedAt: iso(1, 9, 15),
      },
      {
        id: 'CLM-GU-2026-00038',
        itemId: 'FF-GU-2026-00127',
        lostReportId: 'LF-GU-2026-00109',
        claimantId: 'u-student-7',
        matchScore: 93,
        status: 'APPROVED',
        answers: {
          color: 'White card on a blue lanyard',
          brand: 'Campus ID',
          unique: 'Blue lanyard with Batch 2025 printed on it',
          contents: 'Student ID card only',
          damage: 'Corner of the card is slightly bent',
        },
        notes: [{ ts: iso(0, 15, 20), actor: 'Dr. R. Menon (Admin)', text: 'Approved. Claimant must collect from Security Desk with college ID.' }],
        timeline: [
          { step: 'Claim Submitted', status: 'done', ts: iso(1, 10, 30), actor: 'Aditya Kulkarni (Student)', note: '' },
          { step: 'Under Review', status: 'done', ts: iso(1, 12, 0), actor: 'Neha Gupta (Staff)', note: '' },
          { step: 'Verification', status: 'done', ts: iso(1, 17, 10), actor: 'Dr. R. Menon (Admin)', note: 'Photo on ID matches claimant profile.' },
          { step: 'Approved', status: 'current', ts: iso(0, 15, 20), actor: 'Dr. R. Menon (Admin)', note: 'Awaiting pickup.' },
        ],
        createdAt: iso(1, 10, 30),
        updatedAt: iso(0, 15, 20),
      },
      {
        id: 'CLM-GU-2026-00039',
        itemId: 'FF-GU-2026-00130',
        lostReportId: 'LF-GU-2026-00112',
        claimantId: 'u-student-10',
        matchScore: 79,
        status: 'CANCELLED',
        answers: {
          color: 'Blue',
          brand: 'Milton steel bottle',
          unique: 'Rocket sticker on the body',
          contents: 'Empty',
          damage: 'Dent near the base',
        },
        notes: [{ ts: iso(1, 8, 0), actor: 'Ishita Bose (Student)', text: 'Found the bottle in my hostel room — cancelling the claim.' }],
        timeline: [
          { step: 'Claim Submitted', status: 'done', ts: iso(2, 16, 0), actor: 'Ishita Bose (Student)', note: '' },
          { step: 'Cancelled', status: 'failed', ts: iso(1, 8, 0), actor: 'Ishita Bose (Student)', note: 'Claimant found the item themselves.' },
        ],
        createdAt: iso(2, 16, 0),
        updatedAt: iso(1, 8, 0),
      },
      {
        id: 'CLM-GU-2026-00040',
        itemId: 'FF-GU-2026-00125',
        lostReportId: 'LF-GU-2026-00102',
        claimantId: 'u-student-1',
        matchScore: 86,
        status: 'PENDING',
        answers: {
          color: 'Silver Dell adapter with a white plug',
          brand: 'Dell 65W USB-C',
          unique: 'Frayed cable right near the connector head',
          contents: 'Just the adapter and cable',
          damage: 'Cable fraying near connector',
        },
        notes: [],
        timeline: [
          { step: 'Claim Submitted', status: 'current', ts: iso(0, 16, 50), actor: 'Aarav Sharma (Student)', note: '' },
        ],
        createdAt: iso(0, 16, 50),
        updatedAt: iso(0, 16, 50),
      },
    ];
  }

  /* ---------- Notifications (10) ---------- */
  function buildNotifications() {
    return [
      { id: 'n-1', userId: 'u-student-1', type: 'match', title: 'Potential match found for your backpack', message: 'A black Wildcraft backpack was found at Central Library with a 91% Smart Match Score.', link: 'item-details.html?id=FF-GU-2026-00121', read: false, createdAt: iso(1, 9, 30) },
      { id: 'n-2', userId: 'u-student-1', type: 'claim', title: 'Your claim is under review', message: 'Staff started reviewing claim CLM-GU-2026-00031 for the black backpack.', link: 'claim-details.html?id=CLM-GU-2026-00031', read: false, createdAt: iso(1, 11, 6) },
      { id: 'n-3', userId: 'u-student-2', type: 'approval', title: 'Your claim has been approved', message: 'Claim CLM-GU-2026-00033 for the brown leather wallet was approved. Schedule your pickup.', link: 'claim-details.html?id=CLM-GU-2026-00033', read: false, createdAt: iso(0, 12, 1) },
      { id: 'n-4', userId: 'u-student-7', type: 'pickup', title: 'Your item is ready for pickup', message: 'Your student ID card can be collected from the Security Desk with your college ID.', link: 'claim-details.html?id=CLM-GU-2026-00038', read: false, createdAt: iso(0, 15, 21) },
      { id: 'n-5', userId: 'u-student-9', type: 'rejection', title: 'Your claim was rejected', message: 'Claim CLM-GU-2026-00035 was rejected because the answers did not match the report.', link: 'claim-details.html?id=CLM-GU-2026-00035', read: true, createdAt: iso(1, 16, 46) },
      { id: 'n-6', userId: 'u-student-13', type: 'returned', title: 'Item returned — case closed', message: 'Your wireless earbuds were handed over at the Security Desk. Thank you for using CampusFind.', link: 'claim-details.html?id=CLM-GU-2026-00036', read: true, createdAt: iso(0, 10, 6) },
      { id: 'n-7', userId: 'u-admin-1', type: 'claim', title: 'New claim awaiting approval', message: 'Rohan Verma submitted a claim with a 96% Smart Match Score for keys with a red keychain.', link: 'admin-claims.html', read: false, createdAt: iso(0, 14, 21) },
      { id: 'n-8', userId: 'u-staff-1', type: 'storage', title: 'Storage update required', message: 'Three found items are still marked "With Finder" and should be moved to secure storage.', link: 'admin-reports.html', read: false, createdAt: iso(0, 8, 30) },
      { id: 'n-9', userId: 'u-student-4', type: 'match', title: 'Potential match found for your iPhone', message: 'A blue iPhone 14 was found near the Sports Complex. Review the Smart Match breakdown.', link: 'item-details.html?id=FF-GU-2026-00123', read: false, createdAt: iso(1, 8, 15) },
      { id: 'n-10', userId: 'u-student-5', type: 'report', title: 'Lost report published', message: 'Your lost report LF-GU-2026-00107 for the grey hoodie is now live on the campus board.', link: 'my-reports.html', read: true, createdAt: iso(4, 17, 45) },
    ];
  }

  /* ---------- Audit events (10) ---------- */
  function buildAudit() {
    return [
      { id: 'a-1', ts: iso(0, 15, 20), userId: 'u-admin-1', userName: 'Dr. R. Menon', action: 'Admin approved claim', caseId: 'CLM-GU-2026-00038', ip: '10.24.6.14', status: 'Success' },
      { id: 'a-2', ts: iso(0, 14, 21), userId: 'u-student-3', userName: 'Rohan Verma', action: 'Student submitted claim', caseId: 'CLM-GU-2026-00034', ip: '10.24.31.88', status: 'Success' },
      { id: 'a-3', ts: iso(0, 10, 5), userId: 'u-staff-2', userName: 'Prakash Yadav', action: 'Staff marked item returned', caseId: 'CLM-GU-2026-00036', ip: '10.24.8.21', status: 'Success' },
      { id: 'a-4', ts: iso(0, 9, 45), userId: 'u-student-4', userName: 'Ananya Iyer', action: 'Student submitted lost report', caseId: 'LF-GU-2026-00105', ip: '10.24.44.7', status: 'Success' },
      { id: 'a-5', ts: iso(1, 16, 45), userId: 'u-admin-1', userName: 'Dr. R. Menon', action: 'Admin rejected claim', caseId: 'CLM-GU-2026-00035', ip: '10.24.6.14', status: 'Success' },
      { id: 'a-6', ts: iso(1, 11, 5), userId: 'u-staff-1', userName: 'Neha Gupta', action: 'Staff updated storage status', caseId: 'FF-GU-2026-00124', ip: '10.24.8.19', status: 'Success' },
      { id: 'a-7', ts: iso(1, 9, 15), userId: 'u-staff-1', userName: 'Neha Gupta', action: 'Staff requested more information', caseId: 'CLM-GU-2026-00037', ip: '10.24.8.19', status: 'Success' },
      { id: 'a-8', ts: iso(2, 16, 30), userId: 'u-student-9', userName: 'Vikram Reddy', action: 'Repeated failed login attempt', caseId: '—', ip: '10.24.51.2', status: 'Blocked' },
      { id: 'a-9', ts: iso(3, 10, 10), userId: 'u-admin-1', userName: 'Dr. R. Menon', action: 'Admin archived duplicate report', caseId: 'LF-GU-2026-00113', ip: '10.24.6.14', status: 'Success' },
      { id: 'a-10', ts: iso(4, 9, 0), userId: 'u-student-1', userName: 'Aarav Sharma', action: 'Student logged out', caseId: '—', ip: '10.24.29.61', status: 'Success' },
    ];
  }

  window.CF.seed = { buildUsers, buildReports, buildClaims, buildNotifications, buildAudit, digestPassword };
})();
