import { sweep } from './realtime/calls';
import { battleQueueTick } from './realtime/battles';
import { runReminderJob } from './services/reminders';

const timers: NodeJS.Timeout[] = [];

export function startJobs() {
  timers.push(setInterval(() => void sweep().catch((e) => console.error('sweep', e)), 2000));
  timers.push(setInterval(() => battleQueueTick(), 2000));
  timers.push(setInterval(() => void runReminderJob().catch((e) => console.error('reminders', e)), 5 * 60 * 1000));
}

export function stopJobs() {
  timers.forEach(clearInterval);
  timers.length = 0;
}
