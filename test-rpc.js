const { createClient } = require('@supabase/supabase-js');

// I'll hardcode the URL and Key from environment.ts
const SUPABASE_URL = 'https://zrwsntszylgkkmtlhmrf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable___OqZH6Hi5DNnEf2lQDa0A_Cx5_hhYN';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest() {
  console.log('Calling get_board_members...');
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_board_members', { b_id: '00000000-0000-0000-0000-000000000000' });
  
  if (rpcErr) {
    console.error('RPC Error:', rpcErr);
  } else {
    console.log('RPC Result:', rpcData);
  }
}

runTest();
