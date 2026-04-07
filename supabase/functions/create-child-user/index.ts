import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateChildRequest {
  childProfileId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user: parentUser }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !parentUser) {
      throw new Error('Unauthorized');
    }

    const { childProfileId }: CreateChildRequest = await req.json();

    if (!childProfileId) {
      throw new Error('childProfileId is required');
    }

    const { data: childProfile, error: childProfileError } = await supabaseAdmin
      .from('child_profiles')
      .select('*')
      .eq('id', childProfileId)
      .single();

    if (childProfileError || !childProfile) {
      throw new Error('Child profile not found');
    }

    if (childProfile.user_id) {
      throw new Error('Child profile already has an associated user account');
    }

    if (!childProfile.username || !childProfile.pin_plaintext) {
      throw new Error('Child profile must have username and PIN set before creating auth account');
    }

    const childEmail = `child_${childProfileId}@firstsavvy.internal`;
    const childPassword = childProfile.pin_plaintext;
    const childName = childProfile.display_name || childProfile.child_name || `${childProfile.first_name} ${childProfile.last_name}`;

    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: childEmail,
      password: childPassword,
      email_confirm: true,
      user_metadata: {
        full_name: childName,
        is_child_account: true,
        child_profile_id: childProfileId,
      },
    });

    if (signUpError || !signUpData.user) {
      throw new Error(`Failed to create user: ${signUpError?.message || 'Unknown error'}`);
    }

    const childUserId = signUpData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: childUserId,
        profile_type: 'personal',
        display_name: childName,
        is_deleted: false,
      })
      .select()
      .single();

    if (profileError) {
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    const { error: membershipError } = await supabaseAdmin
      .from('profile_memberships')
      .insert({
        profile_id: profile.id,
        user_id: childUserId,
        role: 'owner',
      });

    if (membershipError) {
      throw new Error(`Failed to create membership: ${membershipError.message}`);
    }

    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('chart_of_accounts_templates')
      .select('*')
      .order('account_number');

    if (templatesError) {
      throw new Error(`Failed to fetch templates: ${templatesError.message}`);
    }

    const chartAccountsToInsert = templates.map((template: any) => ({
      profile_id: profile.id,
      account_number: template.account_number,
      template_account_number: template.account_number,
      account_type: template.account_type,
      account_detail: template.account_detail,
      display_name: template.display_name,
      class: template.class,
      current_balance: 0,
      is_active: false,
      is_user_created: false,
      icon: template.icon,
      color: template.color,
      parent_account_id: null,
    }));

    const { error: chartError } = await supabaseAdmin
      .from('user_chart_of_accounts')
      .insert(chartAccountsToInsert);

    if (chartError) {
      throw new Error(`Failed to create chart of accounts: ${chartError.message}`);
    }

    const { error: updateChildProfileError } = await supabaseAdmin
      .from('child_profiles')
      .update({
        user_id: childUserId,
        is_active: true,
      })
      .eq('id', childProfileId);

    if (updateChildProfileError) {
      throw new Error(`Failed to update child profile: ${updateChildProfileError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        childUserId,
        profileId: profile.id,
        message: 'Child authentication account created successfully',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
