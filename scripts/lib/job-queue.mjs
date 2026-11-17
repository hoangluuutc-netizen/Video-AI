// Hàng đợi tuần tự cho việc nặng của Dashboard (FFmpeg, Remotion, TTS, Auto-Pilot, Batch).
// Việc nặng vẫn chạy LẦN LƯỢT như khi còn dùng execFileSync (không 2 FFmpeg tranh RAM / ghi đè cùng file),
// nhưng chạy bất đồng bộ nên server vẫn trả lời /api/state, trạng thái lô, KOL Studio... trong lúc chờ.
export function createJobQueue() {
  let tail = Promise.resolve();
  let pending = 0;
  return {
    run(fn) {
      pending++;
      const job = tail.then(fn).finally(() => {
        pending--;
      });
      tail = job.catch(() => {}); // việc lỗi không làm kẹt các việc sau
      return job;
    },
    pending: () => pending
  };
}
