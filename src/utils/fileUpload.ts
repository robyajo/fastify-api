import { FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import * as fs from "fs";
const { createWriteStream, existsSync, mkdirSync, unlinkSync } = fs;
import { join } from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import { logError, logInfo } from "./logger";
import { MultipartFile } from "@fastify/multipart";

const pump = promisify(pipeline);

// Ensure upload directory exists
const UPLOAD_DIR = join(process.cwd(), "storage", "avatars");
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface FileUpload {
  filename: string;
  mimetype: string;
  file: NodeJS.ReadableStream;
  fieldname: string;
  encoding: string;
}

interface FileUploadResult {
  filePath: string;
  fileName: string;
  fileUrl: string;
}

export async function handleFileUpload(
  req: FastifyRequest,
  userId: number
): Promise<FileUploadResult> {
  try {
    const data = await req.file();

    if (!data) {
      throw new Error("No file uploaded");
    }

    // Check if the uploaded file is an image
    if (!data.mimetype?.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }

    // Generate a unique filename with user ID
    const fileExt = data.filename.split(".").pop();
    const fileName = `user_${userId}_${randomUUID()}.${fileExt}`;
    const filePath = join(UPLOAD_DIR, fileName);
    const fileUrl = `/src/storage/avatars/${fileName}`;

    // Save the file using stream with size limit
    const writeStream = createWriteStream(filePath);
    let fileSize = 0;
    const maxSize = 5 * 1024 * 1024; // 5MB

    // Handle data events to track file size
    data.file.on("data", (chunk: Buffer) => {
      fileSize += chunk.length;
      if (fileSize > maxSize) {
        writeStream.destroy(
          new Error("File size exceeds the maximum allowed limit of 5MB")
        );
        return;
      }
      writeStream.write(chunk);
    });

    // Handle stream events
    await new Promise<void>((resolve, reject) => {
      data.file.on("end", () => {
        writeStream.end();
        resolve();
      });

      writeStream.on("error", (error) => {
        // Clean up the file if there was an error
        if (existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });

      writeStream.on("finish", () => {
        writeStream.close();
      });
    });

    logInfo(`File uploaded successfully: ${fileName}`);

    return {
      filePath,
      fileName,
      fileUrl,
    };
  } catch (error) {
    logError("Error uploading file", error);
    throw new Error("Failed to upload file");
  }
}

export function getAvatarUrl(fileName: string): string {
  return `/avatars/${fileName}`;
}
