const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const connection = new IORedis({ host: process.env.REDIS_HOST, port: process.env.REDIS_PORT });

const worker = new Worker('orders', async job => {
  if (job.name === 'orderCreated') {
    // send notification, generate invoice, etc
    console.log('Processing orderCreated', job.data);
  } else if (job.name === 'orderStatusChanged') {
    console.log('Processing orderStatusChanged', job.data);
  }
}, { connection });

module.exports = worker;
