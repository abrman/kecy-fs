import { Zip, ZipPassThrough } from "fflate";

export interface ZipEntry {
  entryName: string;
  diskPath: string;
}

/**
 * Streams a ZIP of the given files without holding them all in memory.
 * Files are stored uncompressed (images/videos are already compressed).
 */
export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      try {
        for (const entry of entries) {
          const file = Bun.file(entry.diskPath);
          if (!(await file.exists())) continue;
          const zf = new ZipPassThrough(entry.entryName);
          zf.mtime = new Date();
          zip.add(zf);
          // Bun's ReadableStream is async-iterable at runtime; the DOM lib types don't know that.
          for await (const chunk of file.stream() as unknown as AsyncIterable<Uint8Array>) {
            zf.push(chunk);
          }
          zf.push(new Uint8Array(0), true);
        }
        zip.end();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
