import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WORKER_ID = `worker-${Deno.env.get('HOSTNAME') || 'edge'}-${Date.now()}`;

interface DetectionJob {
  id: string;
  profile_id: string;
  job_type: 'transfer' | 'cc_payment' | 'ai_category' | 'ai_contact';
  batch_id: string;
  transaction_ids: string[];
  status: string;
  attempts: number;
  reason: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });

    // Process jobs continuously
    const { action } = await req.json().catch(() => ({ action: 'process' }));

    if (action === 'process') {
      let jobsProcessed = 0;
      const maxJobs = 10; // Process up to 10 jobs per invocation

      while (jobsProcessed < maxJobs) {
        // Claim next job
        const { data: jobs, error: claimError } = await supabase.rpc('claim_next_job', {
          p_worker_id: WORKER_ID,
          p_lock_duration_seconds: 300 // 5 minute lock
        });

        if (claimError) {
          console.error('Error claiming job:', claimError);
          break;
        }

        if (!jobs || jobs.length === 0) {
          // No more jobs available
          break;
        }

        const job: DetectionJob = jobs[0];
        console.log(`[${WORKER_ID}] Processing job ${job.id} (${job.job_type}) for profile ${job.profile_id}`);
        console.log(`[${WORKER_ID}] Transaction count: ${job.transaction_ids.length}`);

        // Process job based on type
        try {
          let matchesFound = 0;
          let suggestionsCreated = 0;

          switch (job.job_type) {
            case 'transfer':
              const transferResult = await processTransferDetection(supabase, job);
              matchesFound = transferResult.matchCount;
              break;

            case 'cc_payment':
              const ccResult = await processCCPaymentDetection(supabase, job);
              matchesFound = ccResult.matchCount;
              break;

            case 'ai_category':
              const categoryResult = await processAICategoryBatch(supabase, job);
              suggestionsCreated = categoryResult.suggestionsCount;
              break;

            case 'ai_contact':
              const contactResult = await processAIContactBatch(supabase, job);
              suggestionsCreated = contactResult.suggestionsCount;
              break;

            default:
              throw new Error(`Unknown job type: ${job.job_type}`);
          }

          // Mark job as complete
          await supabase.rpc('complete_job', {
            p_job_id: job.id,
            p_status: 'done',
            p_error: null,
            p_matches_found: matchesFound,
            p_suggestions_created: suggestionsCreated
          });

          console.log(`[${WORKER_ID}] Completed job ${job.id}: ${matchesFound} matches, ${suggestionsCreated} suggestions`);
          jobsProcessed++;

        } catch (error) {
          console.error(`[${WORKER_ID}] Job ${job.id} failed:`, error);

          // Mark job as failed
          await supabase.rpc('complete_job', {
            p_job_id: job.id,
            p_status: 'failed',
            p_error: error.message,
            p_matches_found: 0,
            p_suggestions_created: 0
          });
        }
      }

      return new Response(
        JSON.stringify({
          worker_id: WORKER_ID,
          jobs_processed: jobsProcessed,
          message: jobsProcessed > 0 ? `Processed ${jobsProcessed} jobs` : 'No jobs available'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({
        error: 'Worker error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function processTransferDetection(supabase: any, job: DetectionJob) {
  const { data, error } = await supabase.rpc('auto_detect_transfers_optimized', {
    p_profile_id: job.profile_id,
    p_transaction_ids: job.transaction_ids
  });

  if (error) {
    throw new Error(`Transfer detection failed: ${error.message}`);
  }

  return {
    matchCount: data?.[0]?.pair_count || 0
  };
}

async function processCCPaymentDetection(supabase: any, job: DetectionJob) {
  const { data, error } = await supabase.rpc('auto_detect_credit_card_payments_optimized', {
    p_profile_id: job.profile_id,
    p_transaction_ids: job.transaction_ids
  });

  if (error) {
    throw new Error(`CC payment detection failed: ${error.message}`);
  }

  return {
    matchCount: data?.[0]?.pair_count || 0
  };
}

async function processAICategoryBatch(supabase: any, job: DetectionJob) {
  // Fetch transactions
  const { data: transactions, error: txnError } = await supabase
    .from('transactions')
    .select('id, description, amount, original_description')
    .in('id', job.transaction_ids)
    .eq('profile_id', job.profile_id)
    .eq('status', 'pending')
    .is('category_account_id', null);

  if (txnError) {
    throw new Error(`Failed to fetch transactions: ${txnError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    return { suggestionsCreated: 0 };
  }

  // Fetch categories
  const { data: categories, error: catError } = await supabase
    .from('user_chart_of_accounts')
    .select('id, account_number, display_name, account_detail, class')
    .eq('profile_id', job.profile_id)
    .eq('is_active', true)
    .in('class', ['income', 'expense'])
    .order('account_number');

  if (catError || !categories || categories.length === 0) {
    throw new Error('No categories available');
  }

  // For now, use the existing fallback logic for each transaction
  // In production, this would be a single batched AI call
  const suggestions = [];

  for (const txn of transactions) {
    const suggestion = suggestCategoryFallback(txn.description, txn.amount, categories);
    if (suggestion) {
      suggestions.push({
        transaction_id: txn.id,
        suggested_category_account_id: suggestion.id,
        confidence_score: 0.7,
        profile_id: job.profile_id,
        model_version: 'fallback-v1',
        prompt_version: 'v1',
        status: 'suggested'
      });
    }
  }

  if (suggestions.length > 0) {
    const { error: insertError } = await supabase
      .from('ai_category_suggestions')
      .upsert(suggestions, { onConflict: 'transaction_id' });

    if (insertError) {
      console.error('Failed to save AI suggestions:', insertError);
    }
  }

  return { suggestionsCreated: suggestions.length };
}

async function processAIContactBatch(supabase: any, job: DetectionJob) {
  // Contact suggestions implementation (placeholder)
  // Similar pattern to category suggestions
  return { suggestionsCreated: 0 };
}

function suggestCategoryFallback(description: string, amount: number, categories: any[]): any {
  const descLower = description.toLowerCase();

  const patterns = [
    { keywords: ['grocery', 'food', 'market', 'safeway', 'whole foods', 'trader', 'costco', 'kroger'], categoryNames: ['groceries'] },
    { keywords: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'chipotle', 'dining', 'pizza', 'burger'], categoryNames: ['dining out'] },
    { keywords: ['chevron', 'shell', 'exxon', 'mobil', 'bp', '76 gas', 'arco'], categoryNames: ['gas & fuel', 'gas', 'fuel'] },
    { keywords: ['uber', 'lyft', 'taxi', 'transit', 'parking'], categoryNames: ['transportation', 'travel'] },
    { keywords: ['amazon', 'target', 'walmart', 'best buy'], categoryNames: ['shopping'] },
    { keywords: ['netflix', 'spotify', 'hulu', 'apple music'], categoryNames: ['subscriptions'] },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => descLower.includes(keyword))) {
      for (const categoryName of pattern.categoryNames) {
        const match = categories.find(c =>
          c.display_name && c.display_name.toLowerCase().includes(categoryName)
        );
        if (match) return match;
      }
    }
  }

  return null;
}
