import { loadEnvConfig } from "@next/env";
import { getSupabaseAdminClient } from "../src/lib/supabase/admin";

loadEnvConfig(process.cwd());

const main = async () => {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('books')
    .select('id, title, page_count, page_images_count')
    .order('id', { ascending: true });
  
  console.log('\nAll books in database:\n');
  data?.forEach(book => {
    const status = book.page_images_count ? '✅' : '❌';
    console.log(`${status} ID ${book.id}: "${book.title?.substring(0, 50)}" - ${book.page_count} pages (${book.page_images_count || 0} rendered)`);
  });
  
  const booksToRender = data?.filter(book => book.id !== 15).map(b => b.id) || [];
  console.log(`\nBooks to re-render (excluding 15): ${booksToRender.join(', ')}`);
};

main();
