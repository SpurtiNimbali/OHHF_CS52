import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL in .env");
}

if (!supabaseKey) {
  throw new Error(
    "Missing Supabase key. Add SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);


const OUTPUT_DIR = path.join(process.cwd(), "supabase_data_scripts", "data_pipeline", "output");

async function uploadJson(table: string, file: string, conflictKey: string) {
  const filePath = path.join(OUTPUT_DIR, file);
  const rows = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`Skipping ${file}: no rows`);
    return;
  }

  const { error, data } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictKey })
    .select();

  if (error) {
    console.error(`Error uploading ${file} → ${table}:`, error);
    process.exitCode = 1;
    return;
  }

  console.log(`Uploaded ${data?.length ?? rows.length} rows from ${file} → ${table}`);
}

async function main() {
  await uploadJson("support_resources", "resources.json", "link");
  await uploadJson("glossary_terms", "glossary.json", "term");
  await uploadJson("chatbot_resources", "chat_knowledge.json", "url");
}

main().catch((error) => {
    console.error("Upload script failed:", error);
    process.exit(1);
  });