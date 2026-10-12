// Minimal typings for the parts of sherpa-onnx-node this app uses.
declare module 'sherpa-onnx-node' {
  export class OfflineTts {
    constructor(config: Record<string, unknown>)
    sampleRate: number
    generate(req: { text: string; sid: number; speed: number }): { samples: Float32Array; sampleRate: number }
  }
  export class OfflineStream {
    acceptWaveform(w: { sampleRate: number; samples: Float32Array }): void
  }
  export class OfflineRecognizer {
    constructor(config: Record<string, unknown>)
    createStream(): OfflineStream
    decode(s: OfflineStream): void
    decodeAsync(s: OfflineStream): Promise<unknown>
    getResult(s: OfflineStream): { text: string; timestamps?: number[]; tokens?: string[] }
  }
  export class Vad {
    constructor(config: Record<string, unknown>, bufferSizeInSeconds: number)
    acceptWaveform(samples: Float32Array): void
    isEmpty(): boolean
    front(enableExternalBuffer?: boolean): { start: number; samples: Float32Array }
    pop(): void
    flush(): void
  }
}
