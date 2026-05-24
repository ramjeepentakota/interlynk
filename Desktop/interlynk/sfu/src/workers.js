'use strict';

const mediasoup = require('mediasoup');
const config = require('./config');

/**
 * Pool of mediasoup workers. mediasoup runs media handling in C++ subprocess
 * "workers"; a single Node process can't use more than one CPU core, so we
 * spawn one worker per core and round-robin rooms across them. A room (router)
 * lives entirely on one worker — media within a room is never piped across
 * workers, which keeps routing cheap.
 */
let workers = [];
let nextWorkerIdx = 0;

async function createWorkers() {
  const { numWorkers, worker: workerSettings } = config.mediasoup;
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      rtcMinPort: workerSettings.rtcMinPort,
      rtcMaxPort: workerSettings.rtcMaxPort,
      logLevel: workerSettings.logLevel,
      logTags: workerSettings.logTags,
    });

    // A dead worker is unrecoverable (its rooms are gone). Crash loudly so the
    // process manager (systemd) restarts us rather than limping on silently.
    worker.on('died', () => {
      // eslint-disable-next-line no-console
      console.error(`[sfu] mediasoup worker ${worker.pid} died — exiting for restart`);
      setTimeout(() => process.exit(1), 1000);
    });

    workers.push(worker);
  }
  // eslint-disable-next-line no-console
  console.log(`[sfu] created ${workers.length} mediasoup worker(s)`);
  return workers;
}

/** Round-robin the next worker for a new room. */
function getWorker() {
  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
}

function getWorkers() {
  return workers;
}

module.exports = { createWorkers, getWorker, getWorkers };
