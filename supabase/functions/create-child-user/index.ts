import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateChildRequest {
  childEmail: string;
  childPassword: string;
  childName: string;
  permissionLevel: number;
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

    const { childEmail, childPassword, childName, permissionLevel }: CreateChildRequest = await req.json();

    if (!childEmail || !childPassword || !childName) {
      throw new Error('Missing required fields');
    }

    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: childEmail,
      password: childPassword,
      email_confirm: true,
      user_metadata: {
        full_name: childName,
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

    const { data: parentProfile } = await supabaseAdmin
      .from('profile_memberships')
      .select('profile_id')
      .eq('user_id', parentUser.id)
      .eq('role', 'owner')
      .single();

    if (!parentProfile) {
      throw new Error('Parent profile not found');
    }

    const { error: childProfileError } = await supabaseAdmin
      .from('child_profiles')
      .insert({
        parent_profile_id: parentProfile.profile_id,
        user_id: childUserId,
        child_name: childName,
        current_permission_level: permissionLevel,
        is_active: true,
      });

    if (childProfileError) {
      throw new Error(`Failed to create child profile: ${childProfileError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        childUserId,
        profileId: profile.id,
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
