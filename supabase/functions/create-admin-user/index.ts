
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Admin key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create the admin user
    console.log("Attempting to create admin user...");
    
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: 'info@drohnenvermessung-roofergaming.de',
      password: 'Whktx240482',
      email_confirm: true,
      user_metadata: {
        username: 'RooferGaming',
        is_admin: true,
      },
    });

    if (userError) {
      console.error("Error creating user:", userError);
      return new Response(
        JSON.stringify({ error: userError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Created user:", userData);

    // Verify that the profile was created via trigger
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (profileError) {
      console.error("Error verifying profile creation:", profileError);
      
      // If the profile wasn't created by the trigger, create it manually
      if (profileError.code === 'PGRST116') {
        console.log("Profile not found, creating manually...");
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userData.user.id,
            username: 'RooferGaming',
            is_admin: true
          });
          
        if (insertError) {
          console.error("Error creating profile manually:", insertError);
          return new Response(
            JSON.stringify({ error: "User created but profile creation failed: " + insertError.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
          );
        }
        
        console.log("Profile created manually successfully");
      } else {
        return new Response(
          JSON.stringify({ error: "Error verifying profile: " + profileError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    } else {
      console.log("Profile created successfully by trigger:", profileData);
    }

    return new Response(
      JSON.stringify({ message: "Admin user created successfully", user: userData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
