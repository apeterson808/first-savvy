import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

interface Contact {
  id: string;
  name: string;
  type?: string;
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
        JSON.stringify({ contactId: null, contactName: null, confidence: 'none' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      const suggestedContact = suggestContactFallback(description, contacts);
      return new Response(
        JSON.stringify({
          contactId: suggestedContact?.id || null,
          contactName: suggestedContact?.name || null,
          confidence: suggestedContact ? 'pattern' : 'none',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const contactList = contacts.map((c, idx) => `${idx + 1}. ${c.name}${c.type ? ` (${c.type})` : ''}`).join('\n');

    const prompt = `Analyze this transaction description and suggest which contact from the list is most likely involved.

Transaction description: "${description}"

Available contacts:
${contactList}

Instructions:
- Look for exact name matches or partial name matches in the description
- Consider common merchant name patterns and abbreviations
- For businesses, match company names even if abbreviated or with location codes
- For people, match first names, last names, or full names
- Return ONLY the exact contact name as it appears in the list above
- If no contact seems to match, respond with "NONE"

Examples:
- "WHOLEFDS MARKET #123" → "Whole Foods" (if that's a contact)
- "STARBUCKS STORE 456" → "Starbucks" (if that's a contact)
- "VENMO - JOHN SMITH" → "John Smith" (if that's a contact)
- "ACH TRANSFER JANE DOE" → "Jane Doe" (if that's a contact)

Respond with just the contact name or "NONE".`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error:', await response.text());
      const suggestedContact = suggestContactFallback(description, contacts);
      return new Response(
        JSON.stringify({
          contactId: suggestedContact?.id || null,
          contactName: suggestedContact?.name || null,
          confidence: suggestedContact ? 'pattern' : 'none',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    const suggestedName = data.content[0].text.trim();

    if (suggestedName === 'NONE') {
      const fallbackContact = suggestContactFallback(description, contacts);
      return new Response(
        JSON.stringify({
          contactId: fallbackContact?.id || null,
          contactName: fallbackContact?.name || null,
          confidence: fallbackContact ? 'pattern' : 'none',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const matchedContact = contacts.find(
      c => c.name.toLowerCase() === suggestedName.toLowerCase()
    );

    if (!matchedContact) {
      const fallbackContact = suggestContactFallback(description, contacts);
      return new Response(
        JSON.stringify({
          contactId: fallbackContact?.id || null,
          contactName: fallbackContact?.name || null,
          confidence: fallbackContact ? 'pattern' : 'none',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        contactId: matchedContact.id,
        contactName: matchedContact.name,
        confidence: 'ai',
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