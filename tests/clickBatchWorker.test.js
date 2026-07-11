const { createClickBatchWorker } = require("../src/services/clickBatchWorker");
const { bulkIncrementUrlClicks, createClicksBatch } = require("../src/data");
const { Worker, Queue } = require("bullmq");

jest.mock("bullmq");
jest.mock("../src/data");

describe("clickBatchWorker Graceful Shutdown", () => {
  let workerInstance;
  let mockWorker;
  let mockQueue;
  const redisConnection = { host: "localhost", port: 6379 };

  beforeEach(() => {
    jest.clearAllMocks();

    mockWorker = {
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    Worker.mockImplementation(() => mockWorker);

    mockQueue = {
      close: jest.fn().mockResolvedValue(undefined),
    };
    Queue.mockImplementation(() => mockQueue);

    createClicksBatch.mockResolvedValue(undefined);
    bulkIncrementUrlClicks.mockResolvedValue(undefined);

    workerInstance = createClickBatchWorker("test-queue", redisConnection);
  });

  it("should flush pending jobs on close", async () => {
    // Simulate some jobs in the buffer
    // The worker processor is the second argument to Worker constructor
    const processor = Worker.mock.calls[0][1];
    
    const job1 = { data: { slug: "slug1" }, id: "1" };
    const job2 = { data: { slug: "slug2" }, id: "2" };

    // We need to resolve the promises returned by the processor to simulate job completion
    // but the processor in clickBatchWorker returns a promise that resolves when the batch is flushed.
    // Since we are testing shutdown, we just want to fill the buffer.
    
    // We have to manually push to state because the processor is async and waits for flush.
    // But createClickBatchWorker returns the state!
    workerInstance.state.pendingJobs.push(
      { data: job1.data, resolve: jest.fn(), reject: jest.fn() },
      { data: job2.data, resolve: jest.fn(), reject: jest.fn() }
    );

    await workerInstance.close();

    expect(createClicksBatch).toHaveBeenCalledWith([job1.data, job2.data]);
    expect(bulkIncrementUrlClicks).toHaveBeenCalled();
    expect(mockWorker.close).toHaveBeenCalled();
    expect(workerInstance.state.pendingJobs.length).toBe(0);
  });

  it("should log error and lost events when shutdown times out", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    
    // Make flushBatch hang
    createClicksBatch.mockImplementation(() => new Promise((resolve) => {
      // Never resolves
    }));

    workerInstance.state.pendingJobs.push(
      { data: { slug: "slug1" }, resolve: jest.fn(), reject: jest.fn() }
    );

    // Use a short timeout for testing
    await workerInstance.close(100);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"worker_shutdown_failed"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"lostEvents":1')
    );

    consoleSpy.mockRestore();
  });

  it("should close DLQ if owned", async () => {
    await workerInstance.close();
    expect(mockQueue.close).toHaveBeenCalled();
  });
});
