const Queue = require('bull');
require('dotenv').config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
};

const emailQueue = new Queue('email-queue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});

const campaignQueue = new Queue('campaign-queue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000
    },
    removeOnComplete: 50,
    removeOnFail: 100
  }
});

const reportQueue = new Queue('report-queue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 50,
    removeOnFail: 100
  }
});

const reminderQueue = new Queue('reminder-queue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});

emailQueue.on('completed', (job, result) => {
  console.log(`[EmailQueue] Job ${job.id} completado:`, result);
});

emailQueue.on('failed', (job, err) => {
  console.error(`[EmailQueue] Job ${job.id} fallido:`, err.message);
});

campaignQueue.on('completed', (job, result) => {
  console.log(`[CampaignQueue] Job ${job.id} completado:`, result);
});

campaignQueue.on('failed', (job, err) => {
  console.error(`[CampaignQueue] Job ${job.id} fallido:`, err.message);
});

campaignQueue.on('progress', (job, progress) => {
  console.log(`[CampaignQueue] Job ${job.id} progreso: ${progress}%`);
});

reportQueue.on('completed', (job, result) => {
  console.log(`[ReportQueue] Job ${job.id} completado`);
});

reportQueue.on('failed', (job, err) => {
  console.error(`[ReportQueue] Job ${job.id} fallido:`, err.message);
});

reminderQueue.on('completed', (job, result) => {
  console.log(`[ReminderQueue] Job ${job.id} completado`);
});

reminderQueue.on('failed', (job, err) => {
  console.error(`[ReminderQueue] Job ${job.id} fallido:`, err.message);
});

const emailWorker = require('./workers/emailWorker');
const campaignWorker = require('./workers/campaignWorker');
const reportWorker = require('./workers/reportWorker');

emailWorker(emailQueue);
campaignWorker(campaignQueue);
reportWorker(reportQueue);

async function startQueues() {
  console.log('[Queue] Sistema de colas iniciado');
  console.log('[Queue]   - Email Queue: Listo');
  console.log('[Queue]   - Campaign Queue: Listo');
  console.log('[Queue]   - Report Queue: Listo');
  console.log('[Queue]   - Reminder Queue: Listo');
}

if (require.main === module) {
  startQueues();
}

module.exports = {
  emailQueue,
  campaignQueue,
  reportQueue,
  reminderQueue,
  startQueues
};
