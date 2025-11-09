import { loadEnvConfig } from "@next/env";
import { getMinioBucketName, getMinioClient } from "@/lib/minio";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildBookAssetsPrefix,
  buildPageImageKey,
  getObjectKeyFromPublicUrl,
} from "@/lib/minioUtils";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  writeFileSync,
  unlinkSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  existsSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

loadEnvConfig(process.cwd());

const ARG_HELP = `Usage: npm run render:book-images [--bookId=123] [--limit=1]
  --bookId   Process a specific book (creates a job if needed)
  --limit    Maximum number of pending jobs to process (default: 1)
`;

type JobRecord = {
  id: number;
  book_id: number;
  status: string;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result: { bookId?: number; limit: number } = { limit: 1 };
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      console.info(ARG_HELP);
      process.exit(0);
    }
    if (arg.startsWith("--bookId=")) {
      result.bookId = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--limit=")) {
      result.limit = Number(arg.split("=")[1]);
    }
  }
  return result;
};

const streamToBuffer = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};

const ensureJobForBook = async (supabase: SupabaseClient, bookId: number) => {
  const { data: existing } = await supabase
    .from("book_render_jobs")
    .select("id, status")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    existing &&
    existing.status !== "failed" &&
    existing.status !== "completed"
  ) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("book_render_jobs")
    .insert({ book_id: bookId, status: "pending" })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to enqueue job.");
  }

  return data.id;
};

const processJob = async (job: JobRecord) => {
  const supabase = getSupabaseAdminClient();
  const minio = getMinioClient();
  const bucketName = getMinioBucketName();

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, pdf_url, page_images_prefix, page_images_count")
    .eq("id", job.book_id)
    .single();

  if (bookError || !book?.pdf_url) {
    throw new Error("Book record missing or PDF URL unavailable.");
  }

  await supabase
    .from("book_render_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      processed_pages: 0,
    })
    .eq("id", job.id);

  const pdfObjectKey = getObjectKeyFromPublicUrl(book.pdf_url);
  if (!pdfObjectKey) {
    throw new Error("Unable to derive MinIO object key for PDF.");
  }

  // Download PDF to temporary file
  const tempDir = mkdtempSync(join(tmpdir(), "pdf-render-"));
  const tempPdfPath = join(tempDir, "book.pdf");

  const pdfStream = await minio.getObject(bucketName, pdfObjectKey);
  const pdfBuffer = await streamToBuffer(pdfStream);
  writeFileSync(tempPdfPath, pdfBuffer);

  console.log(`Downloaded PDF: ${pdfBuffer.length} bytes`);

  try {
    const pagePrefix = buildBookAssetsPrefix(book.id);

    // Use pdftocairo for reliable PDF rendering with proper color space handling
    // -jpeg: output format
    // -r 150: resolution (DPI)
    // -jpegopt quality=95: maximum JPEG quality
    // -singlefile: process one page at a time for better compatibility
    const outputPrefix = join(tempDir, "page");

    console.log("Converting PDF to images using pdftocairo...");

    // First, get the page count
    const pdfInfoOutput = execSync(`pdfinfo "${tempPdfPath}"`, {
      encoding: "utf-8",
    });
    const pageCountMatch = pdfInfoOutput.match(/Pages:\s+(\d+)/);
    const totalPages = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 0;

    if (!totalPages) {
      throw new Error("Could not determine page count from PDF");
    }

    console.log(`PDF has ${totalPages} pages`);

    // Convert each page individually for better control
    // Note: pdftocairo appends the page number to the filename, so
    // "page" becomes "page-1.jpg", "page-2.jpg", etc.
    // Fail immediately if any page fails to convert

    for (let page = 1; page <= totalPages; page++) {
      const pageOutput = join(tempDir, "page");

      // Update progress in database before converting
      await supabase
        .from("book_render_jobs")
        .update({
          processed_pages: page - 1,
          total_pages: totalPages,
        })
        .eq("id", job.id);

      try {
        execSync(
          `pdftocairo -jpeg -r 150 -f ${page} -l ${page} -jpegopt quality=95 "${tempPdfPath}" "${pageOutput}"`,
          { stdio: "pipe" },
        );

        // Rename the generated file to our expected format
        // pdftocairo creates files with 2-digit padding: page-01.jpg, page-02.jpg, etc.
        // For pages > 99, it uses 3-digit padding, and for pages > 999, it uses 4-digit
        let generatedFile: string | null = null;

        // Try different padding formats
        for (const padding of [2, 3, 4]) {
          const candidate = join(
            tempDir,
            `page-${String(page).padStart(padding, "0")}.jpg`,
          );
          if (existsSync(candidate)) {
            generatedFile = candidate;
            break;
          }
        }

        if (!generatedFile) {
          throw new Error(
            `Generated file not found for page ${page} (tried 2, 3, and 4-digit padding formats)`,
          );
        }

        const targetFile = join(
          tempDir,
          `page-${String(page).padStart(4, "0")}.jpg`,
        );

        execSync(`mv "${generatedFile}" "${targetFile}"`);
        console.log(`✓ Converted page ${page}/${totalPages}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `✗ Error converting page ${page}/${totalPages}:`,
          errorMsg,
        );
        throw new Error(
          `❌ RENDERING FAILED at page ${page}/${totalPages}: ${errorMsg}`,
        );
      }
    }

    console.log(`✅ All ${totalPages} pages successfully converted`);

    // Get list of generated images - only get the renamed 4-digit format
    const generatedFiles = readdirSync(tempDir)
      .filter((file) => file.match(/^page-\d{4}\.jpg$/))
      .sort();

    console.log(
      `Generated ${generatedFiles.length} page images out of ${totalPages} total pages`,
    );
    console.log(`First 5 files:`, generatedFiles.slice(0, 5));

    if (generatedFiles.length === 0) {
      throw new Error(
        "No page images were generated. Check PDF file integrity.",
      );
    }

    // Validate that ALL pages were converted
    if (generatedFiles.length !== totalPages) {
      const missingPages: number[] = [];
      const generatedPageNumbers = new Set(
        generatedFiles.map((file) => {
          const match = file.match(/page-(\d{4})\.jpg/);
          return match ? parseInt(match[1], 10) : 0;
        }),
      );

      for (let page = 1; page <= totalPages; page++) {
        if (!generatedPageNumbers.has(page)) {
          missingPages.push(page);
        }
      }

      const errorMessage = `❌ INCOMPLETE RENDERING: Expected ${totalPages} pages but only generated ${generatedFiles.length} images. Missing pages: ${missingPages.join(", ")}`;

      throw new Error(errorMessage);
    }

    // Upload each page to MinIO
    for (let i = 0; i < generatedFiles.length; i++) {
      const pageNumber = i + 1;
      const localFilePath = join(tempDir, generatedFiles[i]);
      const buffer = readFileSync(localFilePath);

      const objectKey = buildPageImageKey(book.id, pageNumber);

      console.log(
        `Uploading page ${pageNumber}: ${buffer.length} bytes to ${objectKey}`,
      );

      await minio.putObject(bucketName, objectKey, buffer, buffer.length, {
        "Content-Type": "image/jpeg",
      });

      await supabase
        .from("book_render_jobs")
        .update({
          processed_pages: pageNumber,
          total_pages: totalPages,
        })
        .eq("id", job.id);

      console.log(`✓ Uploaded page ${pageNumber}`);

      // Clean up local file
      unlinkSync(localFilePath);
    }

    // At this point, we've validated that generatedFiles.length === totalPages
    await supabase
      .from("books")
      .update({
        page_images_prefix: pagePrefix,
        page_images_count: totalPages,
        page_images_rendered_at: new Date().toISOString(),
      })
      .eq("id", book.id);

    await supabase
      .from("book_render_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        total_pages: totalPages,
      })
      .eq("id", job.id);

    console.info(
      `✅ Successfully rendered all ${totalPages} pages for book ${book.id}`,
    );

    console.log(`DEBUG: Temp directory preserved: ${tempDir}`);
    console.log(`DEBUG: You can inspect the PDF at: ${tempPdfPath}`);
  } finally {
    // Clean up temp files - DISABLED FOR DEBUGGING
    // try {
    //   unlinkSync(tempPdfPath);
    // } catch (e) {
    //   // Ignore cleanup errors
    // }
  }
};

const main = async () => {
  const { bookId, limit } = parseArgs();
  const supabase = getSupabaseAdminClient();

  if (bookId) {
    const jobId = await ensureJobForBook(supabase, bookId);
    const { data: job } = await supabase
      .from("book_render_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (job) {
      await processJob(job as JobRecord);
      return;
    }
    throw new Error("Unable to load job that was just created.");
  }

  const { data: jobs, error } = await supabase
    .from("book_render_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  if (!jobs?.length) {
    console.info("No pending jobs found.");
    return;
  }

  for (const job of jobs as JobRecord[]) {
    try {
      await processJob(job);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("book_render_jobs")
        .update({
          status: "failed",
          error_message: message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      console.error(`Job ${job.id} failed:`, message);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
