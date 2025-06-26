import Fastify, { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import fastifyMultipart, { FastifyMultipartOptions } from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { logError } from "./utils/logger";

// Get current directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import prisma from "./config/database";

// Load environment variables
dotenv.config();

// Register static file serving
const UPLOAD_DIR = path.join(process.cwd(), "storage", "img", "avatar");

// Create a function to create a new server instance
function createServer() {
  return Fastify({
    logger: false, // We're using our own logger
    disableRequestLogging: true, // Disable default request logging
    ignoreTrailingSlash: true, // /route and /route/ are treated the same
    caseSensitive: false, // /Route and /route are treated the same
    maxParamLength: 100, // Maximum length of URL parameters
    return503OnClosing: true, // Return 503 when server is closing
    forceCloseConnections: true, // Force close connections when server is closed
    pluginTimeout: 30000, // Extend plugin timeout
  });
}

// Track server instance and startup state
let server = createServer();
let isServerStarting = false;
let isServerListening = false;

// Add hook to log all requests
server.addHook("onRequest", async (request, reply) => {
  const { method, url, id, body } = request;
  console.log(`[${new Date().toISOString()}] ${method} ${url} (ID: ${id})`);
  if (body) {
    console.log("Request body:", JSON.stringify(body, null, 2));
  }
});

// Add hook to log all responses
server.addHook("onSend", async (request, reply, payload) => {
  const { method, url, id } = request;
  console.log(
    `[${new Date().toISOString()}] ${method} ${url} (ID: ${id}) -> ${
      reply.statusCode
    }`
  );
  if (payload) {
    const responseData =
      typeof payload === "string" ? JSON.parse(payload) : payload;
    console.log("Response:", JSON.stringify(responseData, null, 2));
  }
});

// Add hook to log validation errors
server.setErrorHandler(
  (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const { code, validation, statusCode } = error;
    const errorMessage = error.message || "An unexpected error occurred";

    // Create error details object
    const errorDetails = {
      url: request.url,
      method: request.method,
      statusCode: statusCode || 500,
      validation: validation || undefined,
      body: request.body,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    };

    // Log the error
    logError(`Request error: ${errorMessage}`, error, errorDetails);

    // Send appropriate response
    if (code === "FST_ERR_VALIDATION") {
      // Format validation errors to be more readable
      const formattedErrors =
        validation?.map((err) => ({
          field: err.instancePath.replace(/^\//, "") || "body",
          message: err.message,
          params: err.params,
          schema: err.keyword,
        })) || [];

      reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid request data",
        validationErrors: formattedErrors,
        details: {
          method: request.method,
          url: request.url,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      const response: Record<string, any> = {
        error: "Internal Server Error",
        message: errorMessage,
      };

      // Add validation details if available
      if (validation) {
        response.details = validation;
      }

      reply.status(statusCode || 500).send(response);
    }
  }
);

// Track if we're already starting the server
let isStarting = false;

const start = async () => {
  // Prevent multiple concurrent starts
  if (isServerStarting) {
    console.log("Server is already starting, skipping duplicate start");
    return;
  }

  isServerStarting = true;

  try {
    // If server is already listening, close it first
    if (isServerListening) {
      try {
        await server.close();
        isServerListening = false;
      } catch (err) {
        console.error("Error while closing server:", err);
      }
    }

    // Create a fresh server instance
    server = createServer();

    // Set up error handling for the new server instance
    server.setErrorHandler((error, request, reply) => {
      const statusCode = error.statusCode || 500;
      const message = error.message || "Internal Server Error";

      logError(`Request error: ${message}`, error, {
        url: request.url,
        method: request.method,
        statusCode,
        body: request.body,
      });

      reply.status(statusCode).send({
        error: statusCode === 500 ? "Internal Server Error" : error.name,
        message,
        ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
      });
    });

    // No need to clear routes as we're creating a fresh server instance

    // Register CORS
    await server.register(cors, {
      origin: true,
      credentials: true,
    });

    // Register JWT
    await server.register(jwt, {
      secret: process.env.JWT_SECRET || "your-secret-key",
    });

    // Add JSON content type parser
    server.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      function (req, body: string, done) {
        try {
          const json = JSON.parse(body);
          done(null, json);
        } catch (error) {
          const err = error as Error & { statusCode?: number };
          err.statusCode = 400;
          done(err, undefined);
        }
      }
    );

    // Register Multipart for file uploads
    const multipartOptions: FastifyMultipartOptions = {
      attachFieldsToBody: false, // Don't attach to body, we'll handle it manually
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1,
      },
      throwFileSizeLimit: true, // Throw error if file size exceeds the limit
    };
    await server.register(fastifyMultipart, multipartOptions);

    // Register Swagger with explicit schema
    await server.register(swagger, {
      openapi: {
        info: {
          title: "Fastify API",
          description: "API documentation for Fastify TypeScript application",
          version: "1.0.0",
        },
        servers: [
          {
            url: "http://localhost:3000",
            description: "Development server",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "Enter JWT token with Bearer prefix",
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: [
          { name: "Auth", description: "Authentication endpoints" },
          { name: "Users", description: "User management endpoints" },
        ],
      },
      hideUntagged: false,
    });

    // Register Swagger UI with configuration
    await server.register(swaggerUI, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        persistAuthorization: true,
        displayRequestDuration: true,
      },
      uiHooks: {
        onRequest: function (request, reply, next) {
          next();
        },
        preHandler: function (request, reply, next) {
          next();
        },
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject) => swaggerObject,
      transformSpecificationClone: true,
    });

    // Health check route
    server.get("/", async (request, reply) => {
      return {
        message: "Fastify API is running!",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        docs: "/docs",
      };
    });

    // Health check route
    server.get("/health", async (request, reply) => {
      try {
        // Check database connection
        await prisma.$queryRaw`SELECT 1`;
        return {
          status: "OK",
          database: "Connected",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        reply.status(503).send({
          status: "Error",
          database: "Disconnected",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Register static file serving for avatars
    const uploadsPath = path.join(process.cwd(), "storage", "img", "avatar");
    server.register(fastifyStatic, {
      root: uploadsPath,
      prefix: "/src/storage/avatars/",
      decorateReply: false,
    });

    // Register routes with logging
    server.addHook("onRoute", (routeOptions) => {
      console.log(
        `Registering route: ${routeOptions.method} ${routeOptions.url}`
      );
    });

    // Register routes with a guard to prevent duplicates
    const routesRegistered = Symbol("routesRegistered");
    // @ts-ignore - Adding custom property to track route registration
    if (!server[routesRegistered]) {
      // Register all routes under /api prefix
      server.register(async (instance) => {
        // Register auth routes with /api prefix
        instance.register(authRoutes, { prefix: "/api/auth" });
        // Register user routes with /api prefix
        instance.register(userRoutes, { prefix: "/api/users" });
      });
      // Mark routes as registered
      // @ts-ignore
      server[routesRegistered] = true;
    }

    // Serve static files from storage directory
    const storagePath = path.join(process.cwd(), "storage");
    console.log(`Serving static files from: ${storagePath}`);

    // Ensure storage directory exists
    try {
      await fs.promises.mkdir(path.join(storagePath, "avatars"), {
        recursive: true,
      });
      console.log(`Ensured storage directory exists: ${storagePath}`);
    } catch (err) {
      console.error(`Failed to ensure storage directory exists:`, err);
    }

    // Serve static files using a dedicated route handler
    server.get(
      "/src/storage/avatars/:filename",
      async (request: any, reply) => {
        const { filename } = request.params;
        const filePath = path.join(storagePath, "avatars", filename);

        try {
          // Check if file exists and get its stats
          const stats = await fs.promises.stat(filePath);

          if (!stats.isFile()) {
            throw new Error("Not a file");
          }

          // Set appropriate content type based on file extension
          const ext = path.extname(filename).toLowerCase();
          let contentType = "application/octet-stream";

          if (ext === ".png") contentType = "image/png";
          else if (ext === ".jpg" || ext === ".jpeg")
            contentType = "image/jpeg";
          else if (ext === ".gif") contentType = "image/gif";
          else if (ext === ".svg") contentType = "image/svg+xml";

          // Set cache headers
          reply.header("Cache-Control", "public, max-age=31536000");
          reply.header("Last-Modified", stats.mtime.toUTCString());
          reply.header("ETag", `"${stats.size}-${stats.mtime.getTime()}"`);

          // Stream the file with proper error handling
          const stream = fs.createReadStream(filePath);

          // Handle stream errors
          stream.on("error", (streamError: NodeJS.ErrnoException) => {
            console.error(`Error reading file ${filename}:`, streamError);
            if (!reply.sent) {
              reply.status(500).send({
                error: "Internal Server Error",
                message: "Error reading file",
              });
            }
          });

          return reply.type(contentType).send(stream);
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          console.error(`Error serving file ${filename}:`, err);

          // Check if headers were already sent
          if (reply.sent) return;

          // Check if file doesn't exist
          if (err.code === "ENOENT" || err.message === "Not a file") {
            return reply.status(404).send({
              error: "File not found",
              message: `The requested file ${filename} does not exist`,
            });
          }

          // Other errors
          return reply.status(500).send({
            error: "Internal Server Error",
            message: "An error occurred while processing your request",
            details:
              process.env.NODE_ENV === "development" ? err.message : undefined,
          });
        }
      }
    );

    // Health check endpoint
    server.get("/storage/health-check", (request, reply) => {
      reply.send({
        status: "ok",
        storagePath,
        timestamp: new Date().toISOString(),
      });
    });

    // Add schema for authentication header
    server.addSchema({
      $id: "authHeader",
      type: "object",
      properties: {
        Authorization: {
          type: "string",
          description: "Bearer token",
        },
      },
    });

    // Start server
    const host = process.env.HOST || "localhost";
    const port = parseInt(process.env.PORT || "3000");

    // Function to check if a port is available
    const checkPort = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const tester = require("net")
          .createServer()
          .once("error", () => resolve(false))
          .once("listening", () => {
            tester.once("close", () => resolve(true)).close();
          })
          .listen(port, host);
      });
    };

    // Try to start the server
    const MAX_RETRIES = 3;
    let attempts = 0;
    let serverStarted = false;

    while (attempts < MAX_RETRIES && !serverStarted) {
      attempts++;
      const currentPort = attempts > 1 ? port + attempts - 1 : port;

      try {
        // Check if port is available
        const isPortAvailable = await checkPort(currentPort);

        if (!isPortAvailable && attempts < MAX_RETRIES) {
          console.log(`Port ${currentPort} is in use, trying next port...`);
          continue;
        }

        // Start the server
        await server.listen({ port: currentPort, host });
        isServerListening = true;
        serverStarted = true;

        console.log(
          `\n🚀 Server is running!\n📍 API: http://${host}:${currentPort}\n📚 Documentation: http://${host}:${currentPort}/docs\n🏥 Health Check: http://${host}:${currentPort}/health\n`
        );
      } catch (err) {
        if (attempts >= MAX_RETRIES) {
          console.error(
            `Failed to start server after ${MAX_RETRIES} attempts:`,
            err
          );
          throw err;
        }
        console.log(`Attempt ${attempts} failed, retrying...`);
      }
    }

    if (!serverStarted) {
      throw new Error(`Failed to start server after ${MAX_RETRIES} attempts`);
    }

    isServerStarting = false;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Track if we're already shutting down
let isShuttingDown = false;

async function gracefulShutdown() {
  // Prevent multiple concurrent shutdowns
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("Shutting down gracefully...");

  try {
    // Close Prisma connection
    await prisma.$disconnect();
    console.log("Prisma connection closed");

    // Close the server
    if (server) {
      await new Promise<void>((resolve, reject) => {
        // Use type assertion to handle the callback signature
        (server.close as (cb: (err?: Error | null) => void) => void)((err) => {
          if (err) {
            console.error("Error closing server:", err);
            reject(err);
          } else {
            console.log("Server closed");
            resolve();
          }
        });
      });
    }

    console.log("Shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}

// Handle different shutdown signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown();
});

start();
