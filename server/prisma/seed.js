import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Athithi demo data...');

  // ── Hash a shared demo password
  const demoHash = await argon2.hash('Demo1234!');

  // ── Hotel
  const hotel = await prisma.hotel.upsert({
    where: { id: 'hotel_grand_athithi' },
    update: {},
    create: {
      id: 'hotel_grand_athithi',
      name: 'Grand Athithi Hotel',
      address: '42 Marina Drive, Mumbai, MH 400001',
      config: { timezone: 'Asia/Kolkata', escalationDeadlineMinutes: 5 },
    },
  });

  // ── Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@athithi.demo' },
    update: {},
    create: {
      name: 'Priya Sharma',
      email: 'admin@athithi.demo',
      passwordHash: demoHash,
      role: 'ADMIN',
      hotelId: hotel.id,
    },
  });

  // ── Staff
  const staff1 = await prisma.user.upsert({
    where: { email: 'staff.security@athithi.demo' },
    update: {},
    create: {
      name: 'Arjun Nair',
      email: 'staff.security@athithi.demo',
      passwordHash: demoHash,
      role: 'STAFF',
      hotelId: hotel.id,
    },
  });

  const staff2 = await prisma.user.upsert({
    where: { email: 'staff.maintenance@athithi.demo' },
    update: {},
    create: {
      name: 'Kavya Reddy',
      email: 'staff.maintenance@athithi.demo',
      passwordHash: demoHash,
      role: 'STAFF',
      hotelId: hotel.id,
    },
  });

  const staff3 = await prisma.user.upsert({
    where: { email: 'staff.housekeeping@athithi.demo' },
    update: {},
    create: {
      name: 'Ravi Kumar',
      email: 'staff.housekeeping@athithi.demo',
      passwordHash: demoHash,
      role: 'STAFF',
      hotelId: hotel.id,
    },
  });

  // ── Guests
  const guest1 = await prisma.user.upsert({
    where: { email: 'guest.ananya@athithi.demo' },
    update: {},
    create: {
      name: 'Ananya Iyer',
      email: 'guest.ananya@athithi.demo',
      passwordHash: demoHash,
      role: 'GUEST',
    },
  });

  const guest2 = await prisma.user.upsert({
    where: { email: 'guest.vikram@athithi.demo' },
    update: {},
    create: {
      name: 'Vikram Patel',
      email: 'guest.vikram@athithi.demo',
      passwordHash: demoHash,
      role: 'GUEST',
    },
  });

  const guest3 = await prisma.user.upsert({
    where: { email: 'guest.meera@athithi.demo' },
    update: {},
    create: {
      name: 'Meera Menon',
      email: 'guest.meera@athithi.demo',
      passwordHash: demoHash,
      role: 'GUEST',
    },
  });

  // ── Rooms — 3 floors, 4 rooms each
  const roomData = [
    // Floor 1
    { roomNumber: '101', floor: 1, roomType: 'SINGLE', operationalStatus: 'OCCUPIED' },
    { roomNumber: '102', floor: 1, roomType: 'DOUBLE', operationalStatus: 'OCCUPIED' },
    { roomNumber: '103', floor: 1, roomType: 'SINGLE', operationalStatus: 'AVAILABLE' },
    { roomNumber: '104', floor: 1, roomType: 'SINGLE', operationalStatus: 'MAINTENANCE' },
    // Floor 2
    { roomNumber: '201', floor: 2, roomType: 'DELUXE', operationalStatus: 'OCCUPIED' },
    { roomNumber: '202', floor: 2, roomType: 'DOUBLE', operationalStatus: 'AVAILABLE' },
    { roomNumber: '203', floor: 2, roomType: 'SINGLE', operationalStatus: 'AVAILABLE' },
    { roomNumber: '204', floor: 2, roomType: 'SUITE', operationalStatus: 'OCCUPIED' },
    // Floor 3
    { roomNumber: '301', floor: 3, roomType: 'SUITE', operationalStatus: 'OCCUPIED' },
    { roomNumber: '302', floor: 3, roomType: 'DELUXE', operationalStatus: 'AVAILABLE' },
    { roomNumber: '303', floor: 3, roomType: 'DOUBLE', operationalStatus: 'AVAILABLE' },
    { roomNumber: '304', floor: 3, roomType: 'SINGLE', operationalStatus: 'OUT_OF_SERVICE' },
  ];

  const rooms = {};
  for (const r of roomData) {
    const room = await prisma.room.upsert({
      where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber: r.roomNumber } },
      update: {},
      create: { ...r, hotelId: hotel.id },
    });
    rooms[r.roomNumber] = room;
  }

  // ── Stays
  const now = new Date();
  const checkIn = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const checkout = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

  const stay1 = await prisma.stay.upsert({
    where: { id: 'stay_ananya_101' },
    update: {},
    create: {
      id: 'stay_ananya_101',
      guestId: guest1.id,
      roomId: rooms['101'].id,
      checkInAt: checkIn,
      scheduledCheckoutAt: checkout,
      status: 'ACTIVE',
    },
  });

  const stay2 = await prisma.stay.upsert({
    where: { id: 'stay_vikram_201' },
    update: {},
    create: {
      id: 'stay_vikram_201',
      guestId: guest2.id,
      roomId: rooms['201'].id,
      checkInAt: checkIn,
      scheduledCheckoutAt: checkout,
      status: 'ACTIVE',
    },
  });

  await prisma.stay.upsert({
    where: { id: 'stay_meera_301' },
    update: {},
    create: {
      id: 'stay_meera_301',
      guestId: guest3.id,
      roomId: rooms['301'].id,
      checkInAt: checkIn,
      scheduledCheckoutAt: checkout,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Seed complete!\n');
  console.log('Demo credentials (all passwords: Demo1234!):');
  console.log('  Admin:     admin@athithi.demo');
  console.log('  Staff 1:   staff.security@athithi.demo');
  console.log('  Staff 2:   staff.maintenance@athithi.demo');
  console.log('  Staff 3:   staff.housekeeping@athithi.demo');
  console.log('  Guest 1:   guest.ananya@athithi.demo   (Room 101)');
  console.log('  Guest 2:   guest.vikram@athithi.demo   (Room 201)');
  console.log('  Guest 3:   guest.meera@athithi.demo    (Room 301)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
