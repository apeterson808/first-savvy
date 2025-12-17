import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Contact {
  id: string;
  name: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { description, contacts } = await req.json();

    if (!description || !contacts || !Array.isArray(contacts)) {
      return new Response(
        JSON.stringify({ error: 'Description and contacts array are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (contacts.length === 0) {
      return new Response(
        JSON.stringify({ contact: null }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const suggestedContact = suggestContactFallback(description, contacts);

    return new Response(
      JSON.stringify({
        contactId: suggestedContact?.id || null,
        contactName: suggestedContact?.name || null,
        confidence: suggestedContact ? 'pattern' : 'none',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error suggesting contact:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to suggest contact',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function suggestContactFallback(description: string, contacts: Contact[]): Contact | null {
  const descLower = description.toLowerCase();
  
  for (const contact of contacts) {
    const contactNameLower = contact.name.toLowerCase();
    const contactWords = contactNameLower.split(/\s+/);
    
    if (descLower.includes(contactNameLower)) {
      return contact;
    }
    
    const firstWord = contactWords[0];
    const lastWord = contactWords[contactWords.length - 1];
    
    if (firstWord && firstWord.length > 2 && descLower.includes(firstWord)) {
      return contact;
    }
    
    if (lastWord && lastWord.length > 2 && descLower.includes(lastWord)) {
      return contact;
    }
  }
  
  return null;
}
