import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial ReachInbox data...');

  // 1. Create or find default developer user
  const user = await prisma.user.upsert({
    where: { email: 'developer@reachinbox.ai' },
    create: {
      googleId: 'dev-google-seed-001',
      email: 'developer@reachinbox.ai',
      name: 'ReachInbox Lead Engineer',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox',
    },
    update: {},
  });

  console.log(`User seeded: ${user.email} (${user.id})`);

  // 2. Create Ethereal test account for default sender
  console.log('Generating Ethereal SMTP test account for seed sender...');
  let etherealUser = 'dev@ethereal.email';
  let etherealPass = 'devpass';
  try {
    const testAccount = await nodemailer.createTestAccount();
    etherealUser = testAccount.user;
    etherealPass = testAccount.pass;
    console.log(`Ethereal credentials obtained: ${etherealUser}`);
  } catch (err: any) {
    console.log('Using default mock ethereal credentials:', err.message);
  }

  const sender = await prisma.sender.upsert({
    where: {
      userId_email: {
        userId: user.id,
        email: user.email,
      },
    },
    create: {
      userId: user.id,
      email: user.email,
      displayName: user.name,
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: etherealUser,
      smtpPass: etherealPass,
      isDefault: true,
    },
    update: {
      smtpUser: etherealUser,
      smtpPass: etherealPass,
    },
  });

  console.log(`Sender seeded: ${sender.email} (${sender.id})`);

  // 3. Create a sample campaign with a couple of scheduled emails
  const campaign = await prisma.emailCampaign.create({
    data: {
      userId: user.id,
      subject: 'Welcome to ReachInbox High-Performance Scheduler',
      body: 'Hello!\n\nThis is a sample scheduled campaign verifying persistent BullMQ queues, rate limiting, and Redis state recovery.',
      startTime: new Date(),
      delayBetweenEmails: 2000,
      hourlyLimit: 200,
      status: 'scheduled',
      emails: {
        create: [
          {
            userId: user.id,
            senderId: sender.id,
            recipientEmail: 'alex.product@example.com',
            subject: 'Welcome to ReachInbox High-Performance Scheduler',
            body: 'Hello Alex!\n\nThis is a sample scheduled email.',
            scheduledAt: new Date(Date.now() + 60000), // 1 min in future
            status: 'scheduled',
            idempotencyKey: `seed-idemp-${Date.now()}-1`,
            bullJobId: `email-job-seed-1`,
          },
          {
            userId: user.id,
            senderId: sender.id,
            recipientEmail: 'sarah.growth@example.com',
            subject: 'Welcome to ReachInbox High-Performance Scheduler',
            body: 'Hello Sarah!\n\nThis is a sample scheduled email.',
            scheduledAt: new Date(Date.now() + 120000), // 2 min in future
            status: 'scheduled',
            idempotencyKey: `seed-idemp-${Date.now()}-2`,
            bullJobId: `email-job-seed-2`,
          },
        ],
      },
    },
  });

  console.log(`Sample campaign seeded with ID: ${campaign.id}`);
  console.log('Database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
