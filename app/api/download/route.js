import ytdl from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import { NextResponse } from "next/server";
import { JSONFilePreset } from "lowdb/node";
import { scheduleJob } from "node-schedule";
import { AbortController } from "abort-controller";

// Create a JSON file adapter for lowdb with default data
const defaultData = { cache: [] };
const db = await JSONFilePreset("cache.json", defaultData);

// Track ongoing jobs
const processingJobs = new Map();

export const removeFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Failed to delete file: ${filePath}`, err);
    } else {
      console.log(`File deleted: ${filePath}`);
    }
  });
};

const ensureDirectoryExistence = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const cleanOldFiles = (directory, ageLimit) => {
  const files = fs.readdirSync(directory);
  const now = Date.now();

  files.forEach((file) => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);

    if (now - stats.mtimeMs > ageLimit) {
      removeFile(filePath);
    }
  });
};

// Schedule job to clear cache every 24 hours
scheduleJob("0 0 * * *", async () => {
  const now = Date.now();
  const ageLimit = 86400000; // 24 hours in milliseconds

  db.data.cache = db.data.cache.filter((item) => {
    if (now - item.timestamp > ageLimit) {
      removeFile(item.filePath);
      return false;
    }
    return true;
  });
  await db.write();

  // Clean the converted directory
  const convertedDir = path.resolve(process.cwd(), "public", "converted");
  cleanOldFiles(convertedDir, ageLimit);
});

const sseClients = new Set();

const sanitizeTitleForStorage = (title) => {
  return title
    .replace(/[^a-z0-9\s]/gi, "_") // Replace non-alphanumeric characters with underscores
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .toLowerCase();
};

export async function POST(request) {
  const { url, format, resolution, jobId } = await request.json();

  try {
    // Get video info to retrieve the title
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title; // Keep original title

    const sanitizedTitle = sanitizeTitleForStorage(title); // Sanitize title for storage

    const timestamp = Date.now();
    const convertedDir = path.resolve(process.cwd(), "public", "converted");
    ensureDirectoryExistence(convertedDir);

    const videoPath = path.resolve(convertedDir, `${timestamp}-video.mp4`);
    const audioPath = path.resolve(convertedDir, `${timestamp}-audio.mp4`);
    const tempOutputPath = path.resolve(
      convertedDir,
      `${timestamp}-output.mp4`
    );
    const outputPath = path.resolve(
      convertedDir,
      `${sanitizedTitle}.${format}`
    ); // Use sanitized title for storage

    // Check if the file is already cached
    const cachedItem = db.data.cache.find(
      (item) =>
        item.url === url &&
        item.format === format &&
        item.resolution === resolution
    );

    if (cachedItem) {
      console.log("File found in cache:", cachedItem.filePath);
      if (fs.existsSync(cachedItem.filePath)) {
        console.log("File was previously converted");
        return NextResponse.json({
          downloadUrl: `/converted/${path.basename(cachedItem.filePath)}`,
          originalTitle: title, // Include original title
        });
      } else {
        console.error("Cached file does not exist, removing from cache");
        db.data.cache = db.data.cache.filter(
          (item) => item.filePath !== cachedItem.filePath
        );
        db.write();
      }
    }

    const controller = new AbortController();
    const { signal } = controller;
    processingJobs.set(jobId, {
      controller,
      paths: [videoPath, audioPath, tempOutputPath, outputPath],
    });

    return new Promise((resolve, reject) => {
      const videoStream = ytdl(url, { quality: "highestvideo" }).pipe(
        fs.createWriteStream(videoPath)
      );
      const audioStream = ytdl(url, { quality: "highestaudio" }).pipe(
        fs.createWriteStream(audioPath)
      );

      const cleanUpFiles = () => {
        removeFile(videoPath);
        removeFile(audioPath);
        removeFile(tempOutputPath);
      };

      signal.addEventListener("abort", () => {
        console.log(`Aborting job: ${jobId}`);
        videoStream.destroy();
        audioStream.destroy();
        cleanUpFiles();
        reject(NextResponse.json({ error: "Job aborted" }, { status: 500 }));
      });

      let lastProgress = 0;
      let videoFinished = false;
      let audioFinished = false;
      let ffmpegProcess;

      const handleProgress = (progress) => {
        if (progress.percent && Math.floor(progress.percent) > lastProgress) {
          lastProgress = Math.floor(progress.percent);
          console.log(`Processing: ${title} ${lastProgress}% done`);
          // Send progress update to all connected clients
          sseClients.forEach((client) => {
            client.res.write(
              `data: ${JSON.stringify({
                title,
                processing: true,
                progress: lastProgress,
              })}\n\n`
            );
          });
        }
      };

      const mergeFiles = () => {
        if (videoFinished && audioFinished) {
          console.log("Merging video and audio files");

          ffmpegProcess = ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .on("progress", handleProgress)
            .on("end", async () => {
              console.log("Finished merging files");

              // Ensure tempOutputPath exists before renaming
              if (fs.existsSync(tempOutputPath)) {
                fs.renameSync(tempOutputPath, outputPath);

                if (fs.existsSync(outputPath)) {
                  console.log("Output file created successfully:", outputPath);
                } else {
                  console.error("Failed to create output file:", outputPath);
                  cleanUpFiles();
                  reject(
                    NextResponse.json(
                      { error: "Failed to create output file" },
                      { status: 500 }
                    )
                  );
                  return;
                }

                removeFile(videoPath);
                removeFile(audioPath);

                db.data.cache.push({
                  url,
                  format,
                  resolution,
                  filePath: outputPath,
                  timestamp: Date.now(),
                });
                db.write();

                // Send end processing update
                sseClients.forEach((client) => {
                  client.res.write(
                    `data: ${JSON.stringify({ title, processing: false })}\n\n`
                  );
                });

                processingJobs.delete(jobId);
                resolve(
                  NextResponse.json({
                    downloadUrl: `/converted/${path.basename(outputPath)}`,
                    originalTitle: title, // Include original title
                  })
                );
              } else {
                console.error("Temp output file not found");
                cleanUpFiles();
                reject(
                  NextResponse.json(
                    { error: "Temp output file not found" },
                    { status: 500 }
                  )
                );
              }
            })
            .on("error", (err) => {
              console.error("Error during processing:", err);
              cleanUpFiles();
              reject(
                NextResponse.json({ error: err.message }, { status: 500 })
              );
            })
            .save(tempOutputPath);

          signal.addEventListener("abort", () => {
            if (ffmpegProcess) {
              ffmpegProcess.kill("SIGINT");
            }
          });
        }
      };

      videoStream.on("finish", () => {
        videoFinished = true;
        mergeFiles();
      });

      audioStream.on("finish", () => {
        audioFinished = true;
        mergeFiles();
      });
    });
  } catch (error) {
    console.error("Error in API route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Endpoint to handle SSE connections
export function GET(request) {
  const { res } = request;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  sseClients.add({ res });

  request.on("close", () => {
    sseClients.delete({ res });
  });
}

// Endpoint to cancel processing
export async function DELETE(request) {
  const { jobId } = await request.json();

  const job = processingJobs.get(jobId);
  if (job) {
    const { controller, paths } = job;
    controller.abort();
    paths.forEach(removeFile);
    processingJobs.delete(jobId);
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
}

// Function to verify if a file exists
const fileExists = (filePath) => fs.existsSync(filePath);
