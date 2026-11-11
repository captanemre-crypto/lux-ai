// AudioWorkletProcessor for off-main-thread PCM chunk capture (VAD & Dictation)
class LuxPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const customSize = options?.processorOptions?.chunkSize;
    this.chunkSize = Number.isInteger(customSize) && customSize >= 128 ? customSize : 1024;
    this.buffer = new Float32Array(this.chunkSize);
    this.offset = 0;
    this.active = true;
    this.port.onmessage = (ev) => {
      if (ev?.data === "stop") this.active = false;
    };
  }

  process(inputs) {
    if (!this.active) return false;
    const input = inputs?.[0]?.[0];
    if (!input || input.length === 0) return true;

    let readPos = 0;
    while (readPos < input.length) {
      const remaining = this.chunkSize - this.offset;
      const copyCount = Math.min(remaining, input.length - readPos);
      this.buffer.set(input.subarray(readPos, readPos + copyCount), this.offset);
      this.offset += copyCount;
      readPos += copyCount;

      if (this.offset >= this.chunkSize) {
        const out = this.buffer;
        this.port.postMessage(out, [out.buffer]);
        this.buffer = new Float32Array(this.chunkSize);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("lux-pcm-capture", LuxPcmCaptureProcessor);
