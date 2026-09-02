const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bfjjyhokcndjnvvlayqf.supabase.co';
const supabaseAnonKey = 'sb_publishable_e5i-iB572Xr8hziSu28DbQ_LzilEv_9';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const email = 'reviewer@remlays.com';
  const password = 'ReviewerPassword2026!';

  console.log(`Attempting to create test user: ${email}`);

  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password
  });

  if (error) {
    console.error('Error creating user:', error.message);
  } else {
    console.log('\n✅ User created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    
    if (data?.session === null) {
      console.log('\n⚠️ IMPORTANT: It looks like Email Confirmations are ENABLED for this Supabase project.');
      console.log('The Google Play reviewer cannot click a confirmation link.');
      console.log('Please go to your Supabase Dashboard -> Authentication -> Users, and manually confirm this user (or temporarily disable email confirmation during review).');
    } else {
      console.log('\nUser is ready to use!');
    }
  }
}

main();
