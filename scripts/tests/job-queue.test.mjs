import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobQueue } from '../lib/job-queue.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('createJobQueue: việc nặng chạy LẦN LƯỢT (không bao giờ 2 việc cùng lúc)', async () => {
  const q = createJobQueue();
  let running = 0;
  let maxRunning = 0;
  const order = [];
  const job = (name, ms) => async () => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    order.push(`bắt đầu ${name}`);
    await sleep(ms);
    order.push(`xong ${name}`);
    running--;
    return name;
  };
  const results = await Promise.all([q.run(job('A', 30)), q.run(job('B', 5)), q.run(job('C', 5))]);
  assert.deepEqual(results, ['A', 'B', 'C']);
  assert.equal(maxRunning, 1);
  assert.deepEqual(order, ['bắt đầu A', 'xong A', 'bắt đầu B', 'xong B', 'bắt đầu C', 'xong C']);
});

test('createJobQueue: 1 việc lỗi không làm kẹt hàng đợi', async () => {
  const q = createJobQueue();
  await assert.rejects(q.run(async () => { throw new Error('hỏng'); }), /hỏng/);
  assert.equal(await q.run(async () => 'vẫn chạy'), 'vẫn chạy');
});

test('createJobQueue: trong lúc việc nặng chạy, event loop vẫn rảnh và biết đang bận', async () => {
  const q = createJobQueue();
  const p = q.run(() => sleep(40));
  assert.equal(q.pending(), 1);
  let ticked = false;
  setTimeout(() => (ticked = true), 5);
  await sleep(15);
  assert.equal(ticked, true);
  await p;
  assert.equal(q.pending(), 0);
});
